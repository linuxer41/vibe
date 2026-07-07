import { get } from 'svelte/store';
import { user } from './stores';
import { getApiUrl } from './helpers';

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - base64.length % 4) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export async function requestPushSubscription() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array('BDf8mWvXmWvXmWvXmWvXmWvXmWvXmWvXmWvXmWvXmWvXmWvXmWvXmWvXmWvXmWvXmWvXmWvXmWvXmWvXmWvX'),
    });
    const usr = get(user);
    if (usr) {
      await fetch(`${getApiUrl()}/push/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: usr.id, subscription: sub.toJSON() }),
      });
    }
  } catch {}
}
