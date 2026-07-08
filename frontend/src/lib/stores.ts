import { writable, derived } from 'svelte/store';
import type { TypedSocket } from './socket-types';
import type {
  User, Chat, Message, Post, Session, PrivacySettings, TwoStepStatus,
  Channel, ChannelPost, Community, Poll, Product, Order, Wishlist, FlashDeal,
  Meme, StickerPack, Sticker, VibeBalance, FocusSession, SmartNotification,
  SharedNote, GroupTask, WatchSession, Game, GameSession
} from './types';

export const socket = writable<any>(null);
export const user = writable<User | null>(null);
export const token = writable<string>('');
export const authStep = writable<'loading' | 'phone' | 'verify' | 'setup' | 'main'>('loading');
export const phone = writable('');
export const code = writable('');
export const authError = writable('');

export const chats = writable<Chat[]>([]);
export const messages = writable<Message[]>([]);
export const activeChat = writable<Chat | null>(null);
export const chatInput = writable('');
export const typingText = writable('');

export const contacts = writable<User[]>([]);
export const calls = writable<any[]>([]);
export const posts = writable<Post[]>([]);
export const viewingPost = writable<Post | null>(null);
export const postInput = writable('');

export const searchQuery = writable('');
export const searchResults = writable<User[]>([]);
export const showNewChat = writable(false);
export const showCreateGroup = writable(false);
export const groupName = writable('');
export const selectedMembers = writable<User[]>([]);

export const subTab = writable<'pinned' | 'chats' | 'groups'>('chats');

export const theme = writable<'dark' | 'light'>('dark');

export const backend = writable<'node' | 'rust'>('node');
export const backendOptions = ['node', 'rust'] as const;

export const setupName = writable('');
export const setupUser = writable('');
export const setupBio = writable('');

export const displayName = writable('');
export const username = writable('');
export const bio = writable('');

export const pinnedChats = derived(chats, ($c) => $c.filter((c: any) => c.pinned));
export const regularChats = derived(chats, ($c) => $c.filter((c: any) => !c.pinned && c.type === 'private'));
export const groupChats = derived(chats, ($c) => $c.filter((c: any) => c.type === 'group'));
export const totalUnread = derived(chats, ($c) => $c.reduce((sum: number, c: any) => sum + (c.unread || 0), 0));

// Security & Privacy stores
export const twoStepStatus = writable<TwoStepStatus>({ enabled: 0, hint: '' });
export const blockedUsers = writable<User[]>([]);
export const sessions = writable<Session[]>([]);
export const privacySettings = writable<PrivacySettings>({
  last_seen: 'everyone', profile_photo: 'everyone',
  bio: 'everyone', status: 'contacts', calls: 'everyone',
  read_receipts: 1, message_history: 1
});
export const accountDeletion = writable<string | null>(null);

// Passcode Lock
export interface PasscodeSettings {
  enabled: boolean;
  passcodeHash: string;
  timeout: number;
}
export const passcodeSettings = writable<PasscodeSettings>({ enabled: false, passcodeHash: '', timeout: 1 });
export const appLocked = writable<boolean>(false);

// Toast
export type ToastType = 'success' | 'error' | 'info';
export interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}
export const toasts = writable<ToastItem[]>([]);
let toastId = 0;
export function showToast(message: string, type: ToastType = 'info') {
  const id = ++toastId;
  toasts.update((t) => [...t, { id, message, type }]);
  setTimeout(() => {
    toasts.update((t) => t.filter((x) => x.id !== id));
  }, 3000);
}
export function dismissToast(id: number) {
  toasts.update((t) => t.filter((x) => x.id !== id));
}

// Active Call (WebRTC)
export interface ActiveCall {
  callId: number;
  peerId: number;
  peerName: string;
  type: 'audio' | 'video';
  direction: 'incoming' | 'outgoing';
  status: 'ringing' | 'connecting' | 'active' | 'ended';
  startTime?: number;
  muted: boolean;
  speakerOn: boolean;
}
export const activeCall = writable<ActiveCall | null>(null);

// NEW VIBE STORES

// Channels
export const channels = writable<Channel[]>([]);
export const activeChannel = writable<Channel | null>(null);
export const channelPosts = writable<ChannelPost[]>([]);

// Communities
export const communities = writable<Community[]>([]);

// Polls
export const polls = writable<Poll[]>([]);

// Shop
export const products = writable<Product[]>([]);
export const myOrders = writable<Order[]>([]);

// Wishlist
export const wishlists = writable<Wishlist[]>([]);

// Flash Deals
export const flashDeals = writable<FlashDeal[]>([]);

// Memes
export const memes = writable<Meme[]>([]);

// Stickers
export const stickerPacks = writable<StickerPack[]>([]);
export const myStickers = writable<Sticker[]>([]);

// Avatar 3D
export const avatarCustomization = writable<any>({});

// Vibe Balance
export const vibeBalance = writable<VibeBalance>({
  messaging_minutes: 0, feed_minutes: 0, live_minutes: 0,
  shop_minutes: 0, games_minutes: 0, calls_minutes: 0
});
export const focusSession = writable<FocusSession | null>(null);
export const notifications = writable<SmartNotification[]>([]);

// Notes & Tasks
export const sharedNote = writable<SharedNote | null>(null);
export const tasks = writable<GroupTask[]>([]);

// Watch Together
export const watchSession = writable<WatchSession | null>(null);

// Games
export const games = writable<Game[]>([]);
export const gameSession = writable<GameSession | null>(null);

// Derived: total smart notifications unread
export const unreadNotifications = derived(notifications, ($n) => $n.filter((n) => !n.read).length);

// Derived: total orders count
export const ordersCount = derived(myOrders, ($o) => $o.length);
