import { get } from 'svelte/store';
import {
  socket, user, token, authStep, chats, contacts, calls, posts,
  messages, activeChat, typingText, channels, communities, products,
  memes, myOrders, wishlists, flashDeals, vibeBalance, notifications,
  tasks, games, stickerPacks, myStickers, showToast
} from './stores';
import type { User, Chat, Message, Post } from './types';

const AVATAR_BASE = 'https://i.pravatar.cc/80';
const STORAGE_URL = 'http://localhost:3002';
function getBackendUrl(): string {
  if (typeof localStorage !== 'undefined') {
    const ls = localStorage.getItem('wa_backend');
    if (ls === 'node') return 'http://localhost:3000';
    if (ls === 'rust') return 'http://localhost:3001';
    if (ls && ls.startsWith('http')) return ls;
  }
  const mode = import.meta.env.VITE_BACKEND || 'node';
  return mode === 'rust' ? 'http://localhost:3001' : 'http://localhost:3000';
}
export const API_URL = import.meta.env.VITE_API_URL || getBackendUrl();

export function mediaUrl(url: string | undefined | null, opts: { w?: number; h?: number; fit?: string; format?: string; q?: number } = {}): string {
  if (!url) return '';

  // Extract filename from any URL format
  let filename = url;
  if (url.startsWith('http://localhost:3001/uploads/') || url.startsWith('http://localhost:3000/uploads/'))
    filename = url.split('/').pop() || url;
  else if (url.startsWith('/uploads/') || url.startsWith('uploads/'))
    filename = url.split('/').pop() || url;
  else if (url.startsWith(STORAGE_URL))
    filename = url.split('/').pop() || url;
  else if (url.startsWith('http'))
    return url;

  const base = `${STORAGE_URL}/media/${filename}`;
  const params = new URLSearchParams();
  if (opts.w) params.set('w', String(opts.w));
  if (opts.h) params.set('h', String(opts.h));
  if (opts.fit) params.set('fit', opts.fit);
  if (opts.format) params.set('format', opts.format);
  if (opts.q) params.set('q', String(opts.q));
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

export function avatarUrl(id: number) {
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

          sk.emit('upload_chunk', { uploadId, index: idx, data: chunk }, (chunkRes: any) => {
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
              onProgress?.(1, 'processing');
              // Last chunk response includes the final result
              if (chunkRes.url) {
                onProgress?.(1, 'done');
                resolve({ ok: true, url: chunkRes.url, metadata: chunkRes.metadata });
              }
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

  sk.on('new_message', (msg: Message) => {
    const ac = get(activeChat);
    if (ac && msg.chat_id === ac.id) {
      messages.update((m: Message[]) => [...m, msg]);
      sk.emit('mark_read', { messageId: msg.id });
    }
    loadChats();
  });
  sk.on('new_chat', () => loadChats());
  sk.on('contact_added', () => loadContacts());
  sk.on('contact_status', ({ userId, online }: any) => {
    contacts.update((list: User[]) => list.map((c: User) => c.id === userId ? { ...c, online } : c));
  });
  sk.on('new_post', () => loadPosts());
  sk.on('new_video', () => {});
  sk.on('typing', ({ name }: any) => typingText.set(`${name} está escribiendo...`));
  sk.on('stop_typing', () => typingText.set(''));
  sk.on('new_poll', (poll: any) => {
    showToast('Nueva encuesta en el chat');
  });
  sk.on('new_task', () => loadTasks());
  sk.on('new_meme', () => loadMemes());
  sk.on('focus_started', (fs: any) => {
    showToast('Modo ' + fs.mode + ' activado');
  });
  sk.on('focus_ended', () => {
    showToast('Sesión de enfoque finalizada');
  });

  loadChats();
  loadContacts();
  loadPosts();
  loadCalls();
  loadChannels();
  loadCommunities();
  loadProducts();
  loadMemes();
  loadFlashDeals();
  loadOrders();
  loadWishlists();
  loadVibeBalance();
  loadNotifications();
  loadGames();
  loadStickerPacks();
  loadMyStickers();
}

export function loadChats() {
  const sk = get(socket) as any;
  sk?.emit('get_chats', null, (list: Chat[]) => chats.set(list));
}
export function loadContacts() {
  const sk = get(socket) as any;
  sk?.emit('get_contacts', null, (list: User[]) => contacts.set(list));
}
export function loadPosts() {
  const sk = get(socket) as any;
  sk?.emit('get_posts', null, (list: Post[]) => posts.set(list));
}
export function loadCalls() {
  const sk = get(socket) as any;
  sk?.emit('get_calls', null, (list: any[]) => calls.set(list));
}
export function loadChannels() {
  const sk = get(socket) as any;
  sk?.emit('get_channels', (list: any[]) => channels.set(list || []));
}
export function loadCommunities() {
  const sk = get(socket) as any;
  sk?.emit('get_communities', (list: any[]) => communities.set(list || []));
}
export function loadProducts(category = '') {
  const sk = get(socket) as any;
  sk?.emit('get_products', { category }, (list: any[]) => products.set(list || []));
}
export function loadMemes() {
  const sk = get(socket) as any;
  sk?.emit('get_memes', {}, (list: any[]) => memes.set(list || []));
}
export function loadFlashDeals() {
  const sk = get(socket) as any;
  sk?.emit('get_flash_deals', (list: any[]) => flashDeals.set(list || []));
}
export function loadOrders() {
  const sk = get(socket) as any;
  sk?.emit('get_my_orders', (list: any[]) => myOrders.set(list || []));
}
export function loadWishlists() {
  const sk = get(socket) as any;
  sk?.emit('get_wishlists', (list: any[]) => wishlists.set(list || []));
}
export function loadVibeBalance() {
  const sk = get(socket) as any;
  sk?.emit('get_vibe_balance', (data: any) => vibeBalance.set(data));
}
export function loadNotifications() {
  const sk = get(socket) as any;
  sk?.emit('get_notifications', (list: any[]) => notifications.set(list || []));
}
export function loadTasks() {
  const sk = get(socket) as any;
  const ac = get(activeChat);
  if (ac) sk?.emit('get_tasks', { chatId: ac.id }, (list: any[]) => tasks.set(list || []));
}
export function loadGames() {
  const sk = get(socket) as any;
  sk?.emit('get_games', (list: any[]) => games.set(list || []));
}
export function loadStickerPacks() {
  const sk = get(socket) as any;
  sk?.emit('get_sticker_packs', (list: any[]) => stickerPacks.set(list || []));
}
export function loadMyStickers() {
  const sk = get(socket) as any;
  sk?.emit('get_my_stickers', (list: any[]) => myStickers.set(list || []));
}
export function formatPrice(price: number) {
  return '$' + parseFloat(String(price)).toFixed(2);
}
