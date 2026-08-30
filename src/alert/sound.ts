import { AudioPlayer, createAudioPlayer } from 'expo-audio';

let player: AudioPlayer | null = null;

function getPlayer(): AudioPlayer {
  if (!player) {
    player = createAudioPlayer(require('../../assets/alert-beep.wav'));
  }
  return player;
}

/**
 * Creates (and thus "unlocks") the audio player early, ideally right after
 * a real user gesture (e.g. entering the scan screen). Browsers can block
 * audio that isn't tied closely enough to user interaction — reusing one
 * already-unlocked player for every alert is more reliable than creating a
 * fresh one per alert, which some browsers silently refuse to play.
 */
export function primeAlertSound(): void {
  getPlayer();
}

export function playAlertSound(): void {
  try {
    const p = getPlayer();
    p.seekTo(0);
    p.play();
  } catch {
    // o som é um extra; nunca deve bloquear o alerta em si
  }
}
