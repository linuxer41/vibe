import { get } from 'svelte/store';
import { user } from './stores';

type NotifPayload = {
  title: string;
  body?: string;
  icon?: string;
  tag?: string;
};

let tauriGranted = false;
let tauriReady = false;

async function ensureTauri() {
  if (tauriReady) return true;
  try {
    const mod = await import('@tauri-apps/plugin-notification');
    tauriGranted = await mod.isPermissionGranted();
    tauriReady = true;
    return true;
  } catch { return false; }
}

async function requestTauriPerm() {
  try {
    const mod = await import('@tauri-apps/plugin-notification');
    const perm = await mod.requestPermission();
    tauriGranted = perm === 'granted';
    return tauriGranted;
  } catch { return false; }
}

function hasFocus(): boolean {
  return typeof document !== 'undefined' && document.visibilityState === 'visible' && document.hasFocus();
}

function showWebNotification({ title, body, icon, tag }: NotifPayload) {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'granted') {
    new Notification(title, { body, icon, tag });
  } else if (Notification.permission !== 'denied') {
    Notification.requestPermission().then((p) => {
      if (p === 'granted') new Notification(title, { body, icon, tag });
    });
  }
}

async function showTauriNotification(payload: NotifPayload) {
  const ok = await ensureTauri();
  if (!ok) return;
  try {
    const mod = await import('@tauri-apps/plugin-notification');
    mod.sendNotification(payload);
  } catch {}
}

export async function requestNotifPermission() {
  if (typeof window === 'undefined') return;

  // Tauri
  const hasTauri = await ensureTauri();
  if (hasTauri) {
    if (!tauriGranted) await requestTauriPerm();
    return;
  }

  // Web
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

export async function showNotif(payload: NotifPayload) {
  if (hasFocus()) return;

  const usr = get(user);
  const avatar = usr?.avatar
    ? `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/uploads/${usr.avatar}`
    : undefined;

  const full: NotifPayload = {
    icon: payload.icon || avatar || '/favicon.png',
    ...payload,
  };

  // Try Tauri first
  if (typeof window !== 'undefined' && '__TAURI__' in window) {
    await ensureTauri();
    if (tauriGranted) {
      await showTauriNotification(full);
      return;
    }
  }

  // Fallback to Web
  showWebNotification(full);
}
