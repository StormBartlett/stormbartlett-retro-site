/** Quiet, gesture-started interface feedback. Opt-in in Control Panel. */
export function installDesktopSounds() {
  let audio: AudioContext | null = null;
  let last = 0;
  const click = (event: MouseEvent) => {
    if (document.documentElement.dataset.desktopSound !== "on" || document.hidden) return;
    const target = event.target as HTMLElement;
    if (!target.closest("button") || target.closest(".app-sound-lab")) return;
    const now = performance.now();
    if (now - last < 70) return;
    last = now;
    try {
      audio ??= new AudioContext();
      if(audio.state === "suspended") void audio.resume().catch(() => {});
      const tone = audio.createOscillator(), gain = audio.createGain();
      tone.type = "sine"; tone.frequency.setValueAtTime(680, audio.currentTime);
      tone.frequency.exponentialRampToValueAtTime(420, audio.currentTime + .035);
      gain.gain.setValueAtTime(.025,audio.currentTime);
      gain.gain.exponentialRampToValueAtTime(.001,audio.currentTime + .04);
      tone.connect(gain); gain.connect(audio.destination);
      tone.onended = () => { tone.disconnect(); gain.disconnect(); };
      tone.start(); tone.stop(audio.currentTime + .045);
    } catch { /* A browser may decline audio. The desktop still works. */ }
  };
  document.addEventListener("click",click);
  return () => { document.removeEventListener("click",click); if(audio) void audio.close().catch(() => {}); };
}
