"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./SoundLab.module.css";

const STEPS = 8;
const STORAGE_KEY = "storm-sound-lab-v1";
const NOTES = [
  { name: "C5", frequency: 523.25 },
  { name: "A4", frequency: 440 },
  { name: "G4", frequency: 392 },
  { name: "E4", frequency: 329.63 },
  { name: "D4", frequency: 293.66 },
  { name: "C4", frequency: 261.63 },
];

type Pattern = boolean[][];
type PresetName = "Daydream" | "Arcade" | "Night bus";

const PRESETS: Record<PresetName, number[][]> = {
  Daydream: [[5], [3], [2], [1], [2], [3], [4], [3, 5]],
  Arcade: [[5, 2], [3], [2], [0], [1], [2], [3], [4]],
  "Night bus": [[5, 3], [], [4], [2], [5, 3], [], [1], [2]],
};

function presetPattern(name: PresetName): Pattern {
  return NOTES.map((_, row) => PRESETS[name].map((chord) => chord.includes(row)));
}

function isPattern(value: unknown): value is Pattern {
  return Array.isArray(value) && value.length === NOTES.length && value.every(
    (row) => Array.isArray(row) && row.length === STEPS && row.every((cell) => typeof cell === "boolean"),
  );
}

function writeNote(
  context: BaseAudioContext,
  output: AudioNode,
  frequency: number,
  when: number,
  duration: number,
  voices: number,
): OscillatorNode {
  const oscillator = context.createOscillator();
  const envelope = context.createGain();
  oscillator.type = "square";
  oscillator.frequency.value = frequency;
  envelope.gain.setValueAtTime(0, when);
  envelope.gain.linearRampToValueAtTime(0.13 / Math.sqrt(voices), when + 0.008);
  envelope.gain.exponentialRampToValueAtTime(0.001, when + duration);
  oscillator.connect(envelope);
  envelope.connect(output);
  oscillator.start(when);
  oscillator.stop(when + duration + 0.02);
  oscillator.onended = () => {
    oscillator.disconnect();
    envelope.disconnect();
  };
  return oscillator;
}

function wavFile(buffer: AudioBuffer): Blob {
  const samples = buffer.getChannelData(0);
  const data = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(data);
  const label = (offset: number, text: string) => {
    for (let index = 0; index < text.length; index++) view.setUint8(offset + index, text.charCodeAt(index));
  };
  label(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  label(8, "WAVE");
  label(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  label(36, "data");
  view.setUint32(40, samples.length * 2, true);
  samples.forEach((sample, index) => {
    const limited = Math.max(-1, Math.min(1, sample));
    view.setInt16(44 + index * 2, limited < 0 ? limited * 32768 : limited * 32767, true);
  });
  return new Blob([data], { type: "audio/wav" });
}

export default function SoundLab() {
  const [pattern, setPattern] = useState<Pattern>(() => presetPattern("Daydream"));
  const [preset, setPreset] = useState<PresetName | null>("Daydream");
  const [tempo, setTempo] = useState(112);
  const [volume, setVolume] = useState(45);
  const [muted, setMuted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [step, setStep] = useState(-1);
  const [ready, setReady] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState("Make a tiny tune. No musical talent required.");
  const contextRef = useRef<AudioContext | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const visualTimers = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  const oscillators = useRef<Set<OscillatorNode>>(new Set());
  const playingRef = useRef(false);
  const playbackGeneration = useRef(0);
  const mounted = useRef(true);
  const values = useRef({ pattern, tempo, volume, muted });

  useEffect(() => {
    values.current = { pattern, tempo, volume, muted };
    const context = contextRef.current;
    if (context && gainRef.current && context.state !== "closed") {
      gainRef.current.gain.setTargetAtTime(muted ? 0 : volume / 100, context.currentTime, 0.015);
    }
  }, [pattern, tempo, volume, muted]);

  const stop = useCallback((hidden = false) => {
    playbackGeneration.current += 1;
    playingRef.current = false;
    if (timerRef.current !== null) clearInterval(timerRef.current);
    timerRef.current = null;
    visualTimers.current.forEach(clearTimeout);
    visualTimers.current.clear();
    oscillators.current.forEach((oscillator) => {
      try { oscillator.stop(); } catch { /* The note may have already ended. */ }
    });
    oscillators.current.clear();
    const context = contextRef.current;
    if (context?.state === "running") void context.suspend().catch(() => {});
    if (mounted.current) {
      setPlaying(false);
      setStep(-1);
      if (hidden) setMessage("Playback paused. Press play when you return.");
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (saved?.version === 1 && isPattern(saved.pattern)) {
        setPattern(saved.pattern);
        setPreset(null);
        if (Number.isFinite(saved.tempo)) setTempo(Math.max(60, Math.min(180, Math.round(saved.tempo))));
        if (Number.isFinite(saved.volume)) setVolume(Math.max(0, Math.min(100, Math.round(saved.volume))));
        if (typeof saved.muted === "boolean") setMuted(saved.muted);
        setMessage("Your last mixtape is ready to play.");
      }
    } catch { /* Storage can be unavailable or contain an older composition. */ }
    setReady(true);
    const onVisibility = () => { if (document.hidden) stop(true); };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      mounted.current = false;
      document.removeEventListener("visibilitychange", onVisibility);
      stop();
      const context = contextRef.current;
      contextRef.current = null;
      gainRef.current = null;
      if (context && context.state !== "closed") void context.close().catch(() => {});
    };
  }, [stop]);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, pattern, tempo, volume, muted }));
    } catch { /* Making music still works with storage disabled. */ }
  }, [pattern, tempo, volume, muted, ready]);

  const play = async () => {
    if (playingRef.current) { stop(); return; }
    const generation = ++playbackGeneration.current;
    playingRef.current = true;
    try {
      let context = contextRef.current;
      if (!context || context.state === "closed") {
        const AudioConstructor = window.AudioContext || (window as typeof window & {
          webkitAudioContext?: typeof AudioContext;
        }).webkitAudioContext;
        if (!AudioConstructor) throw new Error("Audio unavailable");
        context = new AudioConstructor();
        contextRef.current = context;
        const gain = context.createGain();
        gain.gain.value = values.current.muted ? 0 : values.current.volume / 100;
        gain.connect(context.destination);
        gainRef.current = gain;
      }
      await context.resume();
      if (generation !== playbackGeneration.current || !mounted.current) return;
      if (!playingRef.current || document.hidden) { stop(document.hidden); return; }
      setPlaying(true);
      setMessage("On a loop. Edit notes while it plays.");
      let nextStep = 0;
      let nextTime = context.currentTime + 0.04;
      const audio = context;
      const schedule = () => {
        if (!playingRef.current || audio.state !== "running" || !gainRef.current) return;
        if (nextTime < audio.currentTime - 0.1) nextTime = audio.currentTime + 0.01;
        while (nextTime < audio.currentTime + 0.1) {
          const currentStep = nextStep;
          const current = values.current;
          const duration = Math.min(0.25, 60 / current.tempo / 2 * 0.85);
          const pitches = NOTES.filter((_, row) => current.pattern[row][currentStep]);
          pitches.forEach((note) => {
            const oscillator = writeNote(audio, gainRef.current!, note.frequency, nextTime, duration, pitches.length);
            oscillators.current.add(oscillator);
            oscillator.addEventListener("ended", () => oscillators.current.delete(oscillator), { once: true });
          });
          const visualTimer = setTimeout(() => {
            visualTimers.current.delete(visualTimer);
            if (mounted.current && playingRef.current) setStep(currentStep);
          }, Math.max(0, (nextTime - audio.currentTime) * 1000));
          visualTimers.current.add(visualTimer);
          nextTime += 60 / current.tempo / 2;
          nextStep = (nextStep + 1) % STEPS;
        }
      };
      schedule();
      timerRef.current = setInterval(schedule, 25);
    } catch {
      if (generation !== playbackGeneration.current) return;
      stop();
      if (mounted.current) setMessage("Sound could not start. Try pressing play again.");
    }
  };

  const toggleNote = (row: number, column: number) => {
    setPattern((current) => current.map((notes, rowIndex) => rowIndex === row
      ? notes.map((enabled, stepIndex) => stepIndex === column ? !enabled : enabled)
      : notes));
    setPreset(null);
  };

  const exportLoop = async () => {
    setExporting(true);
    try {
      const beat = 60 / tempo / 2;
      const context = new OfflineAudioContext(1, Math.ceil((STEPS * beat + 0.3) * 44100), 44100);
      const output = context.createGain();
      output.gain.value = volume / 100;
      output.connect(context.destination);
      for (let column = 0; column < STEPS; column++) {
        const pitches = NOTES.filter((_, row) => pattern[row][column]);
        pitches.forEach((note) => writeNote(context, output, note.frequency, column * beat, Math.min(0.25, beat * 0.85), pitches.length));
      }
      const buffer = await context.startRendering();
      if (!mounted.current) return;
      const url = URL.createObjectURL(wavFile(buffer));
      const link = document.createElement("a");
      link.href = url;
      link.download = "sound-lab-mixtape.wav";
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage("One tiny mixtape, exported as a WAV file.");
    } catch {
      if (mounted.current) setMessage("Export is unavailable in this browser.");
    } finally {
      if (mounted.current) setExporting(false);
    }
  };

  return (
    <section className={styles.lab} aria-label="Sound Lab chiptune sequencer">
      <div className={styles.heading}>
        <strong>Sound Lab</strong>
        <span className={styles.badge}>POCKET SYNTH / 01</span>
      </div>

      <div className={`${styles.cassette} ${playing ? styles.spinning : ""}`} aria-hidden="true">
        <div className={styles.tapeLabel}>
          <span className={styles.side}>A</span>
          <div><span className={styles.labelSmall}>HOMEMADE & HIGH FIDELITY-ISH</span><strong>{preset || "Your mixtape"}</strong></div>
          <span className={styles.time}>C–60</span>
        </div>
        <div className={styles.tapeWindow}>
          <span className={styles.reel} /><span className={styles.tapeBridge}>8 BIT<br />GOOD TIMES</span><span className={styles.reel} />
        </div>
        <div className={styles.tapeBase}><span /> <i /> <i /> <span /></div>
      </div>

      <div className={styles.presets} aria-label="Choose a pattern">
        {(Object.keys(PRESETS) as PresetName[]).map((name) => (
          <button key={name} type="button" aria-pressed={preset === name} onClick={() => {
            setPattern(presetPattern(name)); setPreset(name); setMessage(`${name} loaded. Make it your own.`);
          }}>{name}</button>
        ))}
      </div>

      <div className={styles.gridCaption}><span>TAP IN A MELODY</span><span>C MAJOR · 8 STEPS</span></div>
      <div className={styles.sequence} aria-label="Note pattern">
        <div className={styles.steps} aria-hidden="true">
          <span />{Array.from({ length: STEPS }, (_, column) => <span key={column} className={step === column ? styles.currentStep : ""}>{column + 1}</span>)}
        </div>
        {NOTES.map((note, row) => (
          <div className={styles.noteRow} key={note.name}>
            <span className={styles.noteName} aria-hidden="true">{note.name}</span>
            {pattern[row].map((enabled, column) => (
              <button
                type="button"
                key={column}
                aria-label={`${note.name}, step ${column + 1}`}
                aria-pressed={enabled}
                className={`${styles.cell} ${enabled ? styles.active : ""} ${step === column ? styles.playhead : ""}`}
                onClick={() => toggleNote(row, column)}
              ><span aria-hidden="true">{enabled ? "●" : ""}</span></button>
            ))}
          </div>
        ))}
      </div>

      <div className={styles.transport}>
        <button className={styles.playButton} type="button" aria-pressed={playing} onClick={() => void play()}>
          <span aria-hidden="true">{playing ? "■" : "▶"}</span> {playing ? "Stop tape" : "Play tape"}
        </button>
        <label className={styles.tempo}>
          <span>TEMPO <output>{tempo}</output></span>
          <input aria-label="Tempo in beats per minute" type="range" min="60" max="180" value={tempo} onChange={(event) => setTempo(Number(event.target.value))} />
        </label>
      </div>

      <div className={styles.volumeRow}>
        <button type="button" className={styles.muteButton} aria-label={muted ? "Unmute audio" : "Mute audio"} aria-pressed={muted} onClick={() => setMuted(!muted)}>{muted ? "Muted" : "Sound on"}</button>
        <input aria-label="Volume" type="range" min="0" max="100" value={volume} onChange={(event) => setVolume(Number(event.target.value))} />
        <output className={styles.volumeValue}>{volume}%</output>
      </div>

      <div className={styles.footer}>
        <button type="button" disabled={exporting} onClick={() => void exportLoop()}>{exporting ? "Recording…" : "Export .wav ↗"}</button>
        <button type="button" onClick={() => { setPattern(NOTES.map(() => Array(STEPS).fill(false))); setPreset(null); setMessage("Pattern cleared."); }}>Clear tape</button>
      </div>
      <div className={styles.status} role="status">{message}</div>
      <div className={styles.saveNote}>Saved on this device</div>
    </section>
  );
}
