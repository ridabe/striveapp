import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import * as Haptics from 'expo-haptics';
import Constants from 'expo-constants';
import { Vibration, Platform } from 'react-native';

// ─── Detecção de ambiente ─────────────────────────────────────────────────────
// O import estático de expo-notifications dispara inicialização da lib no
// momento que o módulo é carregado — mesmo antes de qualquer if/guard.
// Para evitar o ERROR no Expo Go, usamos require() lazy (só executado quando
// a função é chamada), verificando o ambiente antes de carregar a lib.
const IS_EXPO_GO = Constants.appOwnership === 'expo';

// Tipo auxiliar para o módulo de notificações (evita any)
type NotificationsModule = typeof import('expo-notifications');

let _notifModule: NotificationsModule | null = null;
let _notifHandlerSet = false;

function getNotifications(): NotificationsModule | null {
  if (IS_EXPO_GO) return null;
  if (_notifModule) return _notifModule;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    _notifModule = require('expo-notifications') as NotificationsModule;

    // Configura o handler apenas uma vez (mostra alerta em primeiro plano)
    if (!_notifHandlerSet) {
      _notifModule.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
          shouldShowBanner: true,
          shouldShowList:   true,
        }),
      });
      _notifHandlerSet = true;
    }

    return _notifModule;
  } catch {
    return null;
  }
}

// ─── Notificações ─────────────────────────────────────────────────────────────
let _scheduledNotifId: string | null = null;

export async function requestNotificationPermission(): Promise<boolean> {
  const N = getNotifications();
  if (!N) return false;
  try {
    const { status } = await N.requestPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
}

export async function scheduleRestEndNotification(delaySecs: number) {
  const N = getNotifications();
  if (!N) return;
  try {
    if (_scheduledNotifId) {
      await N.cancelScheduledNotificationAsync(_scheduledNotifId).catch(() => {});
      _scheduledNotifId = null;
    }
    _scheduledNotifId = await N.scheduleNotificationAsync({
      content: {
        title: '⏰ Pausa encerrada!',
        body:  'Hora da próxima série. Vamos lá! 💪',
        sound:   true,
        vibrate: [0, 300, 130, 300, 130, 500],
        priority: N.AndroidNotificationPriority.MAX,
      },
      trigger: {
        seconds: delaySecs,
        type: N.SchedulableTriggerInputTypes.TIME_INTERVAL,
      },
    });
  } catch {
    // fail silently — som + haptic ainda funcionam
  }
}

export async function cancelRestNotification() {
  const N = getNotifications();
  if (!N || !_scheduledNotifId) return;
  try {
    await N.cancelScheduledNotificationAsync(_scheduledNotifId);
    _scheduledNotifId = null;
  } catch {}
}

// ─── WAV beep generator ───────────────────────────────────────────────────────
function generateBeepWav(freqHz: number, durationMs: number, sampleRate: number): string {
  const numSamples    = Math.floor((sampleRate * durationMs) / 1000);
  const bitsPerSample = 16;
  const byteRate      = sampleRate * bitsPerSample / 8;
  const dataSize      = numSamples * 2;
  const totalSize     = 44 + dataSize;

  const buf  = new ArrayBuffer(totalSize);
  const view = new DataView(buf);
  const wStr = (off: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(off + i, str.charCodeAt(i));
  };

  wStr(0, 'RIFF'); view.setUint32(4, totalSize - 8, true);
  wStr(8, 'WAVE'); wStr(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true); view.setUint32(28, byteRate, true);
  view.setUint16(32, 2, true); view.setUint16(34, bitsPerSample, true);
  wStr(36, 'data'); view.setUint32(40, dataSize, true);

  const fadeIn  = Math.floor(sampleRate * 0.02);
  const fadeOut = Math.floor(sampleRate * 0.04);
  for (let i = 0; i < numSamples; i++) {
    const env = Math.min(1, i / fadeIn) * Math.min(1, (numSamples - i) / fadeOut);
    view.setInt16(
      44 + i * 2,
      Math.round(0.75 * env * 32767 * Math.sin(2 * Math.PI * freqHz * i / sampleRate)),
      true,
    );
  }

  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

// ─── Sound cache ──────────────────────────────────────────────────────────────
let _sound: Audio.Sound | null = null;
const BEEP_PATH = (FileSystem.cacheDirectory ?? '') + 'strive_rest_beep.wav';

async function ensureBeepReady(): Promise<Audio.Sound | null> {
  try {
    if (!(await FileSystem.getInfoAsync(BEEP_PATH)).exists) {
      await FileSystem.writeAsStringAsync(BEEP_PATH, generateBeepWav(880, 380, 8000), {
        encoding: FileSystem.EncodingType.Base64,
      });
    }
    if (!_sound) {
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, staysActiveInBackground: false });
      const { sound } = await Audio.Sound.createAsync({ uri: BEEP_PATH });
      _sound = sound;
    }
    return _sound;
  } catch {
    return null;
  }
}

export async function preloadRestBeep() {
  await ensureBeepReady();
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Dispara o alerta de fim de pausa:
 *  1. Som de beep (expo-av) — funciona no Expo Go e em builds reais
 *  2. Haptic notification — funciona no Expo Go e em builds reais
 *  3. Vibração Android — funciona no Expo Go e em builds reais
 *  4. Notificação local imediata — apenas em builds reais (para alertar o relógio)
 */
export async function playRestEndAlert() {
  cancelRestNotification().catch(() => {});

  // 1. Som
  try {
    const sound = await ensureBeepReady();
    if (sound) { await sound.setPositionAsync(0); await sound.playAsync(); }
  } catch {}

  // 2. Haptic
  try { await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}

  // 3. Vibração (Android)
  Vibration.vibrate(Platform.OS === 'android' ? [0, 300, 130, 300, 130, 500] : []);

  // 4. Notificação imediata para o relógio (apenas fora do Expo Go)
  const N = getNotifications();
  if (N) {
    try {
      await N.scheduleNotificationAsync({
        content: {
          title: '⏰ Pausa encerrada!',
          body:  'Próxima série! 💪',
          sound:   false,
          vibrate: [0, 200, 100, 400],
          priority: N.AndroidNotificationPriority.MAX,
        },
        trigger: null,
      });
    } catch {}
  }
}

export async function releaseRestBeep() {
  try {
    if (_sound) { await _sound.unloadAsync(); _sound = null; }
  } catch {}
  cancelRestNotification().catch(() => {});
}
