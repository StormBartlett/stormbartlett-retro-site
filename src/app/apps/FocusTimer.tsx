"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import styles from "./FocusTimer.module.css";

type Mode = "focus" | "break";
type TimerState = {
  mode: Mode;
  focusMinutes: number;
  breakMinutes: number;
  remainingMs: number;
  deadline: number | null;
  sessions: number;
  message: string;
};
type Action =
  | { type: "restore"; state: TimerState }
  | { type: "toggle"; now: number }
  | { type: "complete"; deadline: number; now: number }
  | { type: "reset" }
  | { type: "mode"; mode: Mode }
  | { type: "duration"; mode: Mode; minutes: number };

const STORAGE_KEY = "storm-os:focus-timer:v1";
const MINUTE = 60_000;
const INITIAL_STATE: TimerState = {
  mode: "focus",
  focusMinutes: 25,
  breakMinutes: 5,
  remainingMs: 25 * MINUTE,
  deadline: null,
  sessions: 0,
  message: "Pick one small thing. Make a little room for it.",
};

function duration(state: TimerState, mode = state.mode) {
  return (mode === "focus" ? state.focusMinutes : state.breakMinutes) * MINUTE;
}

function completeTimer(state: TimerState): TimerState {
  const finishedFocus = state.mode === "focus";
  const mode = finishedFocus ? "break" : "focus";
  return {
    ...state,
    mode,
    deadline: null,
    remainingMs: duration(state, mode),
    sessions: finishedFocus ? Math.min(Number.MAX_SAFE_INTEGER, state.sessions + 1) : state.sessions,
    message: finishedFocus
      ? "A little progress! Your tea break is ready."
      : "Tea break complete. Ready for a fresh start?",
  };
}

function reducer(state: TimerState, action: Action): TimerState {
  switch (action.type) {
    case "restore":
      return action.state;
    case "toggle":
      if (state.deadline !== null) {
        if (action.now >= state.deadline) return completeTimer(state);
        return {
          ...state,
          remainingMs: state.deadline - action.now,
          deadline: null,
          message: "Paused. Your place is saved.",
        };
      }
      return {
        ...state,
        deadline: action.now + state.remainingMs,
        message: state.mode === "focus" ? "One thing at a time. You've got this." : "Unclench your shoulders. Enjoy a little rest.",
      };
    case "complete":
      return state.deadline === action.deadline && action.now >= action.deadline ? completeTimer(state) : state;
    case "reset":
      return {
        ...state,
        deadline: null,
        remainingMs: duration(state),
        message: "A clean slate. Start when you're ready.",
      };
    case "mode":
      if (state.mode === action.mode) return state;
      return {
        ...state,
        mode: action.mode,
        deadline: null,
        remainingMs: duration(state, action.mode),
        message: action.mode === "focus" ? "Pick one small thing. Make a little room for it." : "A little rest is part of the work.",
      };
    case "duration": {
      if (state.deadline !== null) return state;
      const minutes = Math.max(1, Math.min(action.mode === "focus" ? 90 : 30, Math.round(action.minutes)));
      if (!Number.isFinite(minutes)) return state;
      return {
        ...state,
        [action.mode === "focus" ? "focusMinutes" : "breakMinutes"]: minutes,
        ...(state.mode === action.mode ? { remainingMs: minutes * MINUTE } : {}),
        message: "Time set. Find a pace that feels good.",
      };
    }
  }
}

function loadTimer(): { state: TimerState; unavailable: boolean } {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { state: INITIAL_STATE, unavailable: false };
    const saved: unknown = JSON.parse(raw);
    if (!saved || typeof saved !== "object") return { state: INITIAL_STATE, unavailable: false };
    const value = saved as Record<string, unknown>;
    if (value.version !== 1) return { state: INITIAL_STATE, unavailable: false };
    const validMinutes = (minutes: unknown, fallback: number, max: number) =>
      typeof minutes === "number" && Number.isInteger(minutes) && minutes >= 1 && minutes <= max ? minutes : fallback;
    const state: TimerState = {
      ...INITIAL_STATE,
      mode: value.mode === "break" ? "break" : "focus",
      focusMinutes: validMinutes(value.focusMinutes, 25, 90),
      breakMinutes: validMinutes(value.breakMinutes, 5, 30),
      sessions: typeof value.sessions === "number" && Number.isSafeInteger(value.sessions) && value.sessions >= 0 ? value.sessions : 0,
    };
    const fullDuration = duration(state);
    state.remainingMs = typeof value.remainingMs === "number" && Number.isFinite(value.remainingMs) && value.remainingMs > 0
      ? Math.min(value.remainingMs, fullDuration)
      : fullDuration;
    const now = Date.now();
    if (typeof value.deadline === "number" && Number.isFinite(value.deadline) && value.deadline > 0) {
      state.deadline = Math.min(value.deadline, now + fullDuration);
      if (state.deadline <= now) return { state: completeTimer(state), unavailable: false };
      state.message = "Welcome back. Your little timer kept going.";
    } else if (state.remainingMs < fullDuration) {
      state.message = "Welcome back. Your place is saved.";
    }
    return { state, unavailable: false };
  } catch {
    return { state: INITIAL_STATE, unavailable: true };
  }
}

function chime(context: AudioContext) {
  if (context.state !== "running") return;
  [659.25, 783.99, 987.77].forEach((frequency, index) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const start = context.currentTime + index * 0.13;
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.035, start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.35);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + 0.36);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
    };
  });
}

function Tomato({ resting }: { resting: boolean }) {
  return (
    <svg className={styles.mascot} viewBox="0 0 96 76" aria-hidden="true" shapeRendering="crispEdges">
      <path d="M15 68h66v3H15z" fill="#d9d8ce" />
      {resting ? (
        <>
          <path d="M31 5h3v6h-3v6h-3v-6h3zm15 0h3v6h-3v6h-3v-6h3zm15 0h3v6h-3v6h-3v-6h3z" fill="#b7b4a5" />
          <path d="M22 24h50v7h12v25H72v7h-7v5H29v-5h-7z" fill="#20221d" />
          <path d="M26 28h42v32h-7v4H33v-4h-7z" fill="#fffdf3" />
          <path d="M72 35h8v17h-8z" fill="#fffdf3" />
          <path d="M29 31h36v5H29z" fill="#d3b983" />
          <path d="M36 44h4v6h-4zm19 0h4v6h-4zm-10 9h8v3h-8z" fill="#20221d" />
          <path d="M30 51h7v3h-7zm29 0h6v3h-6z" fill="#e8aaa0" />
        </>
      ) : (
        <>
          <path d="M31 23h34v4h10v7h6v22h-6v7H65v4H31v-4H21v-7h-6V34h6v-7h10z" fill="#20221d" />
          <path d="M32 27h32v4h10v7h3v14h-6v7h-9v4H34v-4h-9v-7h-6V38h3v-7h10z" fill="#e79484" />
          <path d="M26 34h9v5h-9v10h-4V38h4z" fill="#f9c7b7" />
          <path d="M45 9h7v12h14v5H55v6h-7v-5H36v-5h9z" fill="#20221d" />
          <path d="M48 12h2v12h11v1H52v3h-2v-3H41v-1h7z" fill="#83a387" />
          <path d="M34 40h4v7h-4zm24 0h4v7h-4zm-15 11h10v3H43z" fill="#20221d" />
          <path d="M29 48h8v3h-8zm30 0h8v3h-8z" fill="#f4b5a3" />
        </>
      )}
    </svg>
  );
}

function Garden({ sessions }: { sessions: number }) {
  return (
    <svg className={styles.plant} viewBox="0 0 52 54" aria-hidden="true" shapeRendering="crispEdges">
      <path d="M11 35h30v5H11zm4 5h22v10H15zm4 10h14v3H19z" fill="#20221d" />
      <path d="M15 37h22v2H15zm3 5h16v6H18zm4 7h8v1h-8z" fill="#e2c4a4" />
      {sessions === 0 ? <path d="M24 31h5v4h-5z" fill="#8c6b4d" /> : (
        <>
          <path d={`M25 ${sessions >= 3 ? 15 : 24}h3v20h-3z`} fill="#20221d" />
          <path d="M15 24h8v3h3v6h-7v-3h-4zM29 20h9v7h-5v3h-6v-7h2z" fill="#20221d" />
          <path d="M18 27h4v3h-3v-1h-1zm12-4h5v2h-4v2h-2v-2h1z" fill="#88a284" />
          {sessions >= 2 && <><path d="M14 14h7v3h6v8h-7v-4h-6z" fill="#20221d" /><path d="M17 17h4v3h3v2h-3v-3h-4z" fill="#88a284" /></>}
          {sessions >= 3 && <><path d="M22 3h9v4h5v9h-5v5h-9v-5h-5V7h5z" fill="#20221d" /><path d="M24 6h5v4h4v4h-4v4h-5v-4h-4v-4h4z" fill="#e8aaa0" /><path d="M25 10h3v4h-3z" fill="#ead69b" /></>}
        </>
      )}
    </svg>
  );
}

export default function FocusTimer() {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
  const [now, setNow] = useState(() => Date.now());
  const [hydrated, setHydrated] = useState(false);
  const [storageUnavailable, setStorageUnavailable] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const audio = useRef<AudioContext | null>(null);
  const lastChimedDeadline = useRef<number | null>(null);

  useEffect(() => {
    const saved = loadTimer();
    dispatch({ type: "restore", state: saved.state });
    setStorageUnavailable(saved.unavailable);
    setNow(Date.now());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
        version: 1,
        mode: state.mode,
        focusMinutes: state.focusMinutes,
        breakMinutes: state.breakMinutes,
        remainingMs: state.remainingMs,
        deadline: state.deadline,
        sessions: state.sessions,
      }));
      setStorageUnavailable(false);
    } catch {
      setStorageUnavailable(true);
    }
  }, [hydrated, state.mode, state.focusMinutes, state.breakMinutes, state.remainingMs, state.deadline, state.sessions]);

  useEffect(() => {
    const deadline = state.deadline;
    if (deadline === null) return;
    const tick = () => {
      const timestamp = Date.now();
      setNow(timestamp);
      if (timestamp >= deadline) {
        if (soundEnabled && audio.current && lastChimedDeadline.current !== deadline) {
          lastChimedDeadline.current = deadline;
          chime(audio.current);
        }
        dispatch({ type: "complete", deadline, now: timestamp });
      }
    };
    tick();
    const interval = window.setInterval(tick, 250);
    document.addEventListener("visibilitychange", tick);
    window.addEventListener("pageshow", tick);
    window.addEventListener("focus", tick);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", tick);
      window.removeEventListener("pageshow", tick);
      window.removeEventListener("focus", tick);
    };
  }, [state.deadline, soundEnabled]);

  useEffect(() => () => {
    if (audio.current && audio.current.state !== "closed") void audio.current.close().catch(() => {});
  }, []);

  const running = state.deadline !== null;
  const remaining = Math.max(0, state.deadline !== null ? state.deadline - now : state.remainingMs);
  const seconds = Math.ceil(remaining / 1000);
  const time = `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
  const progress = Math.max(0, Math.min(100, (1 - remaining / duration(state)) * 100));
  const paused = !running && state.remainingMs < duration(state);

  const toggleSound = async () => {
    if (soundEnabled) {
      setSoundEnabled(false);
      return;
    }
    try {
      if (!audio.current || audio.current.state === "closed") audio.current = new AudioContext();
      await audio.current.resume();
      setSoundEnabled(true);
      chime(audio.current);
    } catch {
      setSoundEnabled(false);
    }
  };

  return (
    <section className={styles.timer} aria-label="Focus timer">
      <div className={styles.heading}>
        <span className={styles.tinySquare} aria-hidden="true" />
        <span>A LITTLE FOCUS CLUB</span>
        <span className={styles.headingLines} aria-hidden="true" />
      </div>

      <div className={styles.modeSwitch} role="group" aria-label="Timer mode">
        <button type="button" aria-pressed={state.mode === "focus"} onClick={() => dispatch({ type: "mode", mode: "focus" })} disabled={!hydrated}>
          Focus
        </button>
        <button type="button" aria-pressed={state.mode === "break"} onClick={() => dispatch({ type: "mode", mode: "break" })} disabled={!hydrated}>
          Tea break
        </button>
      </div>

      <div className={styles.clockFace}>
        <Tomato resting={state.mode === "break"} />
        <div className={styles.clock} role="timer" aria-label={`${state.mode === "focus" ? "Focus" : "Break"} time remaining`} aria-live="off">{time}</div>
        <div className={styles.clockCaption}>{running ? "a little time, well spent" : paused ? "take your time" : state.mode === "focus" ? "one small thing at a time" : "rest is productive, too"}</div>
      </div>

      <div className={styles.progress} aria-hidden="true"><span style={{ width: `${progress}%` }} /></div>

      <div className={styles.controls}>
        <button className={styles.primary} type="button" disabled={!hydrated} onClick={() => {
          const timestamp = Date.now();
          setNow(timestamp);
          dispatch({ type: "toggle", now: timestamp });
        }}>
          <span aria-hidden="true">{running ? "Ⅱ" : "▶"}</span> {running ? "Pause" : paused ? "Resume" : "Start"}
        </button>
        <button className={styles.reset} type="button" disabled={!hydrated} onClick={() => dispatch({ type: "reset" })}>Reset</button>
      </div>

      <div className={styles.message} role="status">{state.message}</div>

      <div className={styles.settings}>
        {(["focus", "break"] as const).map((mode) => (
          <div className={styles.duration} key={mode}>
            <span className={styles.durationLabel}>{mode === "focus" ? "Focus" : "Break"} <span>min</span></span>
            <div className={styles.stepper}>
              <button type="button" aria-label={`Decrease ${mode} minutes`} disabled={!hydrated || running || (mode === "focus" ? state.focusMinutes : state.breakMinutes) <= 1} onClick={() => dispatch({ type: "duration", mode, minutes: (mode === "focus" ? state.focusMinutes : state.breakMinutes) - 1 })}>−</button>
              <output aria-label={`${mode === "focus" ? "Focus" : "Break"} duration in minutes`}>{mode === "focus" ? state.focusMinutes : state.breakMinutes}</output>
              <button type="button" aria-label={`Increase ${mode} minutes`} disabled={!hydrated || running || (mode === "focus" ? state.focusMinutes : state.breakMinutes) >= (mode === "focus" ? 90 : 30)} onClick={() => dispatch({ type: "duration", mode, minutes: (mode === "focus" ? state.focusMinutes : state.breakMinutes) + 1 })}>+</button>
            </div>
          </div>
        ))}
      </div>

      <div className={styles.garden}>
        <Garden sessions={state.sessions} />
        <div className={styles.gardenCopy}>
          <strong>{state.sessions.toLocaleString()} {state.sessions === 1 ? "little win" : "little wins"}</strong>
          <span>{state.sessions === 0 ? "No sessions yet." : state.sessions < 3 ? "Sessions completed." : "Sessions completed."}</span>
        </div>
      </div>

      <div className={styles.footer}>
        <span>{storageUnavailable ? "Saved for this visit" : "Saved on this device"}</span>
        <button type="button" aria-pressed={soundEnabled} aria-label={`End chime ${soundEnabled ? "on; turn off" : "off; turn on and preview"}`} onClick={() => void toggleSound()}>
          Chime: {soundEnabled ? "on" : "off"}
        </button>
      </div>
    </section>
  );
}
