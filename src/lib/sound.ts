import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

// One tiny player for the whole app, created on first use and kept: the chime is 0.6s of mono WAV,
// synthesised for Xplore (two soft bell notes rising a fourth), so there is nothing to license.
let player: AudioPlayer | null = null;
let ready: Promise<void> | null = null;

function prepare() {
  if (!ready) {
    // Sound effects obey the silent switch and never pause someone's music. expo-audio's default
    // plays through silent mode (playsInSilentMode: true), so both rules are stated here.
    ready = setAudioModeAsync({ playsInSilentMode: false, interruptionMode: 'mixWithOthers' }).catch(() => {});
    player = createAudioPlayer(require('@/assets/sounds/done.wav'));
  }
  return ready;
}

export const sound = {
  /** Load ahead of the moment, so the chime lands on the frame the work finishes. */
  preload: () => {
    void prepare();
  },
  /** The task-done chime. Pair it with haptic.success(); the sound is the extra, not the signal. */
  done: async () => {
    await prepare();
    if (!player) return;
    try {
      await player.seekTo(0);
      player.play();
    } catch {
      // A failed chime is never worth an error on screen.
    }
  },
};
