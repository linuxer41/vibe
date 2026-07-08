import { get } from 'svelte/store';
import {
  socket, user, token, authStep, chats, contacts, calls, posts,
  messages, activeChat, typingText, channels, communities, products,
  memes, myOrders, wishlists, flashDeals, vibeBalance, notifications,
  tasks, games, stickerPacks, myStickers, showToast
} from './stores';
import type { User, Chat, Message, Post } from './types';
import { showNotif } from '$lib/notifications';
import { emit } from '$lib/socket';

const AVATAR_BASE = 'https://i.pravatar.cc/80';

export function applyThemeColors(theme: 'dark' | 'light') {
  const bgColor = theme === 'dark' ? '#0f0f0f' : '#ffffff';
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', bgColor);
  // Tauri window background handled via CSS / safe-area, no native import needed
}
function getStorageUrl(): string {
  if (typeof localStorage !== 'undefined') {
    const ls = localStorage.getItem('storage_url');
    if (ls && ls.startsWith('http')) return ls;
  }
  return import.meta.env.VITE_STORAGE_URL || 'http://localhost:3002';
}
export function extractFileName(url: string): string {
  if (!url) return '';
  const parts = url.split('/');
  const file = parts[parts.length - 1] || '';
  return decodeURIComponent(file.split('?')[0]);
}
export function getBackendUrl(): string {
  try {
    const raw = localStorage.getItem('wa_backend_config');
    if (raw) {
      const cfg = JSON.parse(raw);
      if (cfg.httpUrl) return cfg.httpUrl;
    }
  } catch {}
  const mode = import.meta.env.VITE_BACKEND || 'node';
  return mode === 'rust' ? 'http://localhost:2001' : 'http://localhost:2000';
}

let _apiUrl: string | null = null;
export function getApiUrl(): string {
  if (!_apiUrl) {
    _apiUrl = import.meta.env.VITE_API_URL || getBackendUrl();
  }
  return _apiUrl;
}

export function mediaUrl(url: string | undefined | null, opts: { w?: number; h?: number; fit?: string; format?: string; q?: number } = {}): string {
  if (!url) return '';

  let filename = url;
  if (url.includes('/media/'))
    filename = url.split('/').pop() || url;
  else if (url.includes('/uploads/'))
    filename = url.split('/').pop() || url;
  else if (url.startsWith('http'))
    return url;

  const base = `${getStorageUrl()}/media/${filename}`;
  const params = new URLSearchParams();
  if (opts.w) params.set('w', String(opts.w));
  if (opts.h) params.set('h', String(opts.h));
  if (opts.fit) params.set('fit', opts.fit);
  if (opts.format) params.set('format', opts.format);
  if (opts.q) params.set('q', String(opts.q));
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

export function avatarUrl(id: number, avatar?: string | null) {
  if (avatar) return avatar;
  return `${AVATAR_BASE}?u=${id}`;
}

const CHUNK_SIZE = 65536;

export function uploadViaSocket(
  sk: any,
  file: File | { name: string; type: string; data: ArrayBuffer },
  onProgress?: (pct: number, status: string) => void
): Promise<{ ok: boolean; url?: string; metadata?: any; error?: string }> {
  return new Promise((resolve) => {
    const processBuf = (buf: ArrayBuffer, name: string, type: string) => {
      const totalChunks = Math.ceil(buf.byteLength / CHUNK_SIZE);
      onProgress?.(0, 'preparing');

      sk.emit('upload_start', { name, mime: type, size: buf.byteLength, totalChunks }, (startRes: any) => {
        if (!startRes?.ok) {
          onProgress?.(0, 'error');
          resolve({ ok: false, error: startRes?.error || 'Error al iniciar upload' });
          return;
        }
        const uploadId = startRes.uploadId;
        onProgress?.(0, 'uploading');
        let sent = 0;
        let idx = 0;

        const sendNext = () => {
          if (idx >= totalChunks) return;
          const start = idx * CHUNK_SIZE;
          const end = Math.min(start + CHUNK_SIZE, buf.byteLength);
          const chunk = buf.slice(start, end);
          sent += chunk.byteLength;

          // Convert chunk ArrayBuffer to base64 for JSON transport
          const chunkBytes = new Uint8Array(chunk);
          let binary = '';
          for (let i = 0; i < chunkBytes.length; i++) binary += String.fromCharCode(chunkBytes[i]);
          const chunkB64 = btoa(binary);

          sk.emit('upload_chunk', { uploadId, index: idx, data: chunkB64 }, (chunkRes: any) => {
            if (!chunkRes?.ok) {
              sk.emit('upload_cancel', { uploadId });
              onProgress?.(0, 'error');
              resolve({ ok: false, error: chunkRes?.error || 'Error en chunk' });
              return;
            }
            const pct = sent / buf.byteLength;
            onProgress?.(pct, 'uploading');
            idx++;
            if (idx >= totalChunks) {
              onProgress?.(1, 'done');
              resolve({ ok: chunkRes?.ok !== false, url: chunkRes?.url, metadata: chunkRes?.metadata });
            } else {
              sendNext();
            }
          });
        };
        sendNext();
      });
    };

    if (file instanceof File) {
      onProgress?.(0, 'preparing');
      file.arrayBuffer().then(buf => processBuf(buf, file.name, file.type)).catch(() => {
        onProgress?.(0, 'error');
        resolve({ ok: false, error: 'Error leyendo archivo' });
      });
    } else {
      processBuf(file.data, file.name, file.type);
    }
  });
}

export function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function formatDate(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return formatTime(iso);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Ayer';
  return d.toLocaleDateString();
}

export function formatDateHeader(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return 'Hoy';
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Ayer';
  return d.toLocaleDateString('es', { weekday: 'long', month: 'long', day: 'numeric' });
}

export function shouldShowDate(iso: string, index: number, arr: any[]): boolean {
  if (index === 0) return true;
  const prev = new Date(arr[index - 1].created_at);
  const curr = new Date(iso);
  return prev.toDateString() !== curr.toDateString();
}

export function formatDuration(secs: number) {
  if (!secs) return '';
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function scrollToBottom(el: HTMLElement | undefined) {
  requestAnimationFrame(() => {
    if (el) el.scrollTop = el.scrollHeight;
  });
}

export function initSocket(sk: any) {
  if (!sk) return;

  sk.on('new_message', (payload: any) => {
    const { message, ...chatData } = payload;
    if (!message) return;
    // Update chat list: replace entire chat object
    chats.update((list: any[]) => {
      const idx = list.findIndex((c: any) => c.id === chatData.id);
      if (idx === -1) return [chatData, ...list];
      const updated = list.filter((_: any, i: number) => i !== idx);
      updated.unshift(chatData);
      return updated;
    });
    const ac = get(activeChat);
    if (ac && message.chat_id === ac.id) {
      messages.update((m: Message[]) => [...m, message]);
      emit('mark_read', { messageId: message.id }).catch(() => {});
    } else if (message.chat_id !== ac?.id) {
      showNotif({ title: message.sender_name || 'Vibe', body: message.text || 'Nuevo mensaje', tag: `chat:${message.chat_id}` });
    }
    if (message.sender_id !== get(user)?.id) {
      emit('message_delivered', { messageId: message.id, senderId: message.sender_id }).catch(() => {});
    }
  });
  sk.on('message_status', ({ messageId, status }: any) => {
    messages.update((msgs: Message[]) => msgs.map((m) => m.id === messageId ? { ...m, status } : m));
  });
  sk.on('new_chat', (data: any) => {
    if (data?.chatId) emit('join_chat', { chatId: data.chatId }).catch(() => {});
  });
  sk.on('contact_added', () => {
    loadContacts();
    showNotif({ title: 'Vibe', body: 'Nuevo contacto agregado' });
  });
  sk.on('contact_status', ({ userId, online }: any) => {
    contacts.update((list: User[]) => list.map((c: User) => c.id === userId ? { ...c, online } : c));
  });
  sk.on('new_post', (post: any) => {
    loadPosts();
    if (post?.display_name) showNotif({ title: 'Vibe', body: `Nuevo post de ${post.display_name}` });
  });
  sk.on('new_video', () => {});
  sk.on('typing', ({ name }: any) => typingText.set(`${name} está escribiendo...`));
  sk.on('stop_typing', () => typingText.set(''));
  sk.on('new_poll', (poll: any) => {
    showToast('Nueva encuesta en el chat');
    showNotif({ title: 'Vibe', body: 'Nueva encuesta en el chat' });
  });
  sk.on('new_task', () => {
    loadTasks();
    showNotif({ title: 'Vibe', body: 'Nueva tarea' });
  });
  sk.on('new_meme', () => loadMemes());
  sk.on('focus_started', (fs: any) => {
    showToast('Modo ' + fs.mode + ' activado');
  });
  sk.on('focus_ended', () => {
    showToast('Sesión de enfoque finalizada');
  });
  sk.on('incoming_call', (call: any) => {
    showNotif({ title: 'Llamada entrante', body: call.callerName || 'Alguien te llama', tag: `call:${call.callId}` });
  });
  sk.on('new_notification', (notification: any) => {
    notifications.update((n: any[]) => [notification, ...n]);
    showToast(notification.message, 'info');
    showNotif({ title: 'Vibe', body: notification.message, tag: `notif:${notification.id}` });
  });
}

export async function loadInitialData() {
  await Promise.all([
    loadChats(),
    loadContacts(),
    loadPosts(),
    loadCalls(),
    loadChannels(),
    loadCommunities(),
    loadProducts(),
    loadMemes(),
    loadFlashDeals(),
    loadOrders(),
    loadWishlists(),
    loadVibeBalance(),
    loadNotifications(),
    loadGames(),
    loadStickerPacks(),
    loadMyStickers(),
  ]);
}

export async function loadChats() {
  try { const list = await emit<Chat[]>('get_chats'); chats.set(list || []); } catch {}
}
export async function loadContacts() {
  try { const list = await emit<User[]>('get_contacts'); contacts.set(list || []); } catch {}
}
export async function loadPosts() {
  try { const list = await emit<Post[]>('get_posts'); posts.set(list || []); } catch {}
}
export async function loadCalls() {
  try { const list = await emit<any[]>('get_calls'); calls.set(list || []); } catch {}
}
export async function loadChannels() {
  try { const list = await emit<any[]>('get_channels'); channels.set(list || []); } catch {}
}
export async function loadCommunities() {
  try { const list = await emit<any[]>('get_communities'); communities.set(list || []); } catch {}
}
export async function loadProducts(category = '') {
  try { const list = await emit<any[]>('get_products', { category }); products.set(list || []); } catch {}
}
export async function loadMemes() {
  try { const list = await emit<any[]>('get_memes', {}); memes.set(list || []); } catch {}
}
export async function loadFlashDeals() {
  try { const list = await emit<any[]>('get_flash_deals'); flashDeals.set(list || []); } catch {}
}
export async function loadOrders() {
  try { const list = await emit<any[]>('get_my_orders'); myOrders.set(list || []); } catch {}
}
export async function loadWishlists() {
  try { const list = await emit<any[]>('get_wishlists'); wishlists.set(list || []); } catch {}
}
export async function loadVibeBalance() {
  try { const data = await emit<any>('get_vibe_balance'); vibeBalance.set(data); } catch {}
}
export async function loadNotifications() {
  try { const list = await emit<any[]>('get_notifications'); notifications.set(list || []); } catch {}
}
export async function loadTasks() {
  const ac = get(activeChat);
  if (!ac) return;
  try { const list = await emit<any[]>('get_tasks', { chatId: ac.id }); tasks.set(list || []); } catch {}
}
export async function loadGames() {
  try { const list = await emit<any[]>('get_games'); games.set(list || []); } catch {}
}
export async function loadStickerPacks() {
  try { const list = await emit<any[]>('get_sticker_packs'); stickerPacks.set(list || []); } catch {}
}
export async function loadMyStickers() {
  try { const list = await emit<any[]>('get_my_stickers'); myStickers.set(list || []); } catch {}
}
export function formatPrice(price: number) {
  return '$' + parseFloat(String(price)).toFixed(2);
}

export function formatLastSeen(iso: string | undefined | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  if (diffMs < 60000) return 'ahora';
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return 'hoy a las ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'ayer a las ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString('es', { day: 'numeric', month: 'short' }) + ' a las ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
