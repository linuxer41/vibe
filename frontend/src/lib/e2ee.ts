const KEY_NAME = 'vibe_e2e_key';

async function getKey(): Promise<CryptoKey | null> {
  const stored = localStorage.getItem(KEY_NAME);
  if (stored) {
    try {
      const raw = Uint8Array.from(atob(stored), (c) => c.charCodeAt(0));
      return await crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
    } catch {}
  }
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
  const exported = await crypto.subtle.exportKey('raw', key);
  localStorage.setItem(KEY_NAME, btoa(String.fromCharCode(...new Uint8Array(exported))));
  return key;
}

export async function encrypt(text: string): Promise<string> {
  const key = await getKey();
  if (!key) return text;
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(text);
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);
  return btoa(String.fromCharCode(...combined));
}

export async function decrypt(data: string): Promise<string> {
  try {
    const key = await getKey();
    if (!key) return data;
    const combined = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
    const iv = combined.slice(0, 12);
    const encrypted = combined.slice(12);
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, encrypted);
    return new TextDecoder().decode(decrypted);
  } catch {
    return data;
  }
}

export async function encryptMessage(text: string): Promise<string> {
  if (!text) return text;
  return '🔒' + await encrypt(text);
}

export async function decryptMessage(text: string): Promise<string> {
  if (!text.startsWith('🔒')) return text;
  return decrypt(text.slice(1));
}
