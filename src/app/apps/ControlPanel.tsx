"use client";

import { useEffect, useState, type CSSProperties } from "react";
import {
  ACCENTS,
  DEFAULT_DESKTOP_PREFERENCES,
  DESKTOP_PREFERENCES_EVENT,
  WALLPAPERS,
  hydrateDesktopPreferences,
  isDesktopPreferenceStorageAvailable,
  systemPrefersReducedMotion,
  updateDesktopPreferences,
  type DesktopPreferences,
} from "./desktopPreferences";
import styles from "./ControlPanel.module.css";

export { hydrateDesktopPreferences } from "./desktopPreferences";

export default function ControlPanel() {
  const [settings, setSettings] = useState<DesktopPreferences>({ ...DEFAULT_DESKTOP_PREFERENCES });
  const [systemMotion, setSystemMotion] = useState(false);
  const [canSave, setCanSave] = useState(true);

  useEffect(() => {
    const sync = (event: Event) => {
      setSettings((event as CustomEvent<DesktopPreferences>).detail);
      setSystemMotion(systemPrefersReducedMotion());
      setCanSave(isDesktopPreferenceStorageAvailable());
    };
    window.addEventListener(DESKTOP_PREFERENCES_EVENT, sync);
    hydrateDesktopPreferences();
    return () => window.removeEventListener(DESKTOP_PREFERENCES_EVENT, sync);
  }, []);

  const update = (patch: Partial<DesktopPreferences>) => updateDesktopPreferences(patch);
  const wallpaper = WALLPAPERS[settings.wallpaper];
  const previewStyle = {
    "--preview-color": wallpaper.color,
    "--preview-image": wallpaper.image,
    "--preview-size": wallpaper.size,
    "--preview-accent": ACCENTS[settings.accent].color,
  } as CSSProperties;

  return (
    <div className={styles.panel}>
      <div className={styles.intro}>
        <span className={styles.pixelSliders} aria-hidden="true">☷</span>
        <div><strong>Your desktop, your rules.</strong><p>A little personal computing.</p></div>
      </div>

      <div className={styles.preview} style={previewStyle} aria-label={`${wallpaper.label} wallpaper preview`} role="img">
        <div className={styles.previewScreen} data-scanlines={settings.scanlines && !settings.reduceEffects}>
          <div className={styles.previewMenu}><span>◆</span><span>File</span><span>Edit</span><span>View</span></div>
          <div className={styles.previewFile}><i /><span>hello.txt</span></div>
          <div className={styles.previewWindow}><div /><p>Hello, world.<br />Make yourself at home.</p><span /></div>
        </div>
        <span className={styles.previewStand} />
      </div>

      <fieldset className={styles.fieldset}>
        <legend>Wallpaper</legend>
        <div className={styles.wallpapers}>
          {(Object.keys(WALLPAPERS) as Array<DesktopPreferences["wallpaper"]>).map((id) => {
            const option = WALLPAPERS[id];
            return (
              <button key={id} type="button" className={styles.wallpaperOption} aria-pressed={settings.wallpaper === id}
                onClick={() => update({ wallpaper: id })} aria-label={`${option.label} wallpaper`}>
                <span className={styles.swatch} style={{ backgroundColor: option.color, backgroundImage: option.image, backgroundSize: option.size }} />
                <span>{option.label}</span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend>Accent</legend>
        <div className={styles.accents}>
          {(Object.keys(ACCENTS) as Array<DesktopPreferences["accent"]>).map((id) => (
            <button key={id} type="button" className={styles.accentOption} aria-pressed={settings.accent === id}
              onClick={() => update({ accent: id })}>
              <span className={styles.accentDot} style={{ backgroundColor: ACCENTS[id].color }} aria-hidden="true" />
              <span>{ACCENTS[id].label}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <div className={styles.toggles}>
        <label className={styles.toggle}>
          <input type="checkbox" checked={settings.scanlines} disabled={settings.reduceEffects}
            onChange={(event) => update({ scanlines: event.target.checked })} />
          <span><strong>Scanlines</strong><small>{settings.reduceEffects ? "Paused while effects are reduced" : "A touch of CRT nostalgia"}</small></span>
        </label>
        <label className={styles.toggle}>
          <input type="checkbox" checked={settings.reduceEffects} disabled={systemMotion}
            onChange={(event) => update({ reduceEffects: event.target.checked })} />
          <span><strong>Reduce effects</strong><small>{systemMotion ? "Following your device preference" : "Less motion, a calmer screen"}</small></span>
        </label>
        <label className={styles.toggle}>
          <input type="checkbox" checked={settings.sound}
            onChange={(event) => update({ sound: event.target.checked })} />
          <span><strong>Interface sounds</strong><small>Optional little bleeps</small></span>
        </label>
      </div>
      <div className={styles.footer} role="status"><span aria-hidden="true">{canSave ? "◆" : "◇"}</span>{canSave ? "Applied instantly. Saved on this device." : "Applied for this visit. Storage unavailable."}</div>
    </div>
  );
}
