/**
 * Back-office notification sounds.
 *
 * Synthesised with the Web Audio API so the app ships no binary assets and the
 * chime still works offline. Browsers block audio until the page has received a
 * gesture, so `unlockNotificationAudio()` is called from a click/keydown handler
 * and `playSupportChime()` stays silent (never throws) if audio is unavailable.
 */

const SOUND_PREF_KEY = "nbc_support_sound_v1";

type AudioWindow = Window & { webkitAudioContext?: typeof AudioContext };

let context: AudioContext | null = null;
let unlocked = false;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AudioCtor = window.AudioContext ?? (window as AudioWindow).webkitAudioContext;
  if (!AudioCtor) return null;
  if (!context) {
    try {
      context = new AudioCtor();
    } catch {
      return null;
    }
  }
  return context;
}

/** Call from a user gesture (click, keypress) so later chimes are allowed. */
export function unlockNotificationAudio(): void {
  const ctx = getContext();
  if (!ctx) return;
  if (ctx.state === "suspended") {
    void ctx.resume().catch(() => undefined);
  }
  unlocked = ctx.state === "running";
}

export function isNotificationAudioReady(): boolean {
  const ctx = getContext();
  return Boolean(ctx && ctx.state === "running");
}

export function isSupportSoundEnabled(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const raw = window.localStorage.getItem(SOUND_PREF_KEY);
    return raw === null ? true : raw === "on";
  } catch {
    return true;
  }
}

export function setSupportSoundEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SOUND_PREF_KEY, enabled ? "on" : "off");
  } catch {
    // Preferences are best-effort; the console still works without storage.
  }
}

function tone(ctx: AudioContext, frequency: number, startAt: number, duration: number, peak: number) {
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();

  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(frequency, startAt);

  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(peak, startAt + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.start(startAt);
  oscillator.stop(startAt + duration + 0.02);
}

/**
 * Short two-note "new message" chime (E6 → A6), the kind used by messaging
 * desks. Respects the mute preference and is a no-op on unsupported browsers.
 */
export function playSupportChime(): void {
  if (!isSupportSoundEnabled()) return;
  const ctx = getContext();
  if (!ctx || ctx.state !== "running") return;

  try {
    const now = ctx.currentTime + 0.01;
    tone(ctx, 1318.5, now, 0.16, 0.12);
    tone(ctx, 1760, now + 0.13, 0.28, 0.1);
    unlocked = true;
  } catch {
    // Never let a notification break the console.
  }
}

/** Optional spoken-style "pop" used when the desk sends a reply. */
export function playSupportSentCue(): void {
  if (!isSupportSoundEnabled()) return;
  const ctx = getContext();
  if (!ctx || ctx.state !== "running") return;
  try {
    const now = ctx.currentTime + 0.01;
    tone(ctx, 880, now, 0.09, 0.06);
  } catch {
    // ignore
  }
}

export function hasUnlockedAudio(): boolean {
  return unlocked;
}
