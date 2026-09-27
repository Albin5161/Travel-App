import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

// Three short sounds for the moments that matter, never for ordinary taps: places found, saved,
// and a group locking in its plan. Soft mallet-on-glass notes synthesised for Xplore
// (scripts/synth-sounds.py), so there is nothing to license; a few KB each as AAC.
const SOURCES = {
  found: require('@/assets/sounds/found.m4a'),
  saved: require('@/assets/sounds/saved.m4a'),
  together: require('@/assets/sounds/together.m4a'),
} as const;

export type Cue = keyof typeof SOURCES;

// One player per sound, created on first use and kept.
const players: Partial<Record<Cue, AudioPlayer>> = {};
let mode: Promise<void> | null = null;

function prepare(cue: Cue) {
  // Sound effects obey the silent switch and never pause someone's music. expo-audio's default
  // plays through silent mode (playsInSilentMode: true), so both rules are stated here.
  mode ??= setAudioModeAsync({ playsInSilentMode: false, interruptionMode: 'mixWithOthers' }).catch(() => {});
  players[cue] ??= createAudioPlayer(SOURCES[cue]);
  return mode;
}

/** Pair each with haptic.success(): the sound is the extra, not the signal. */
export const sound = {
  /** Load ahead of the moment, so the sound lands on the frame the work finishes. */
  preload: (...cues: Cue[]) => {
    cues.forEach((c) => void prepare(c));
  },
  play: async (cue: Cue) => {
    await prepare(cue);
    const player = players[cue];
    if (!player) return;
    try {
      await player.seekTo(0);
      player.play();
    } catch {
      // A failed sound is never worth an error on screen.
    }
  },
};
