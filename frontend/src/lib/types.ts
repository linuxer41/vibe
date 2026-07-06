export interface User {
  id: number;
  phone: string;
  username: string;
  display_name: string;
  avatar: string;
  bio?: string;
  online?: boolean;
  country_code?: string;
}

export interface Chat {
  id: number;
  type: 'private' | 'group';
  name: string;
  avatar: string;
  last_message?: string;
  last_message_time?: string;
  members?: User[];
  unread?: number;
  pinned?: number;
}

export interface Message {
  id: number;
  chat_id: number;
  sender_id: number;
  sender_name: string;
  sender_avatar: string;
  text: string;
  type: 'text' | 'image' | 'system';
  created_at: string;
  reply_to_id?: number;
  forwarded?: number;
}

export interface Post {
  id: number;
  user_id: number;
  text: string;
  media: string;
  media_type: string;
  display_name?: string;
  avatar?: string;
  created_at: string;
  expires_at: string;
  views?: number;
  likes_count?: number;
  comments_count?: number;
}

export interface PostComment {
  id: number;
  post_id: number;
  user_id: number;
  text: string;
  parent_id?: number | null;
  created_at: string;
  display_name?: string;
  avatar?: string;
  username?: string;
}

export interface LiveComment {
  id: number;
  live_id: number;
  user_id: number;
  text: string;
  created_at: string;
  display_name?: string;
  avatar?: string;
  username?: string;
}

export interface LiveReaction {
  id: number;
  live_id: number;
  user_id: number;
  reaction: string;
  created_at: string;
  display_name?: string;
  avatar?: string;
  username?: string;
}

export interface Session {
  id: number;
  device_name: string;
  device_id: string;
  created_at: string;
  last_active: string;
}

export interface PrivacySettings {
  last_seen: string;
  profile_photo: string;
  bio: string;
  status: string;
  calls: string;
  read_receipts: number;
  message_history: number;
}

export interface TwoStepStatus {
  enabled: number;
  hint: string;
}

export interface ContactStatus {
  userId: number;
  online: boolean;
}

export interface Video {
  id: number;
  user_id: number;
  video_url: string;
  thumbnail: string;
  caption: string;
  likes_count: number;
  comments_count: number;
  created_at: string;
  display_name?: string;
  avatar?: string;
  username?: string;
}

export interface VideoComment {
  id: number;
  video_id: number;
  user_id: number;
  text: string;
  created_at: string;
  display_name?: string;
  avatar?: string;
  username?: string;
}

export interface Live {
  id: number;
  user_id: number;
  title: string;
  status: 'live' | 'ended';
  started_at: string;
  display_name?: string;
  avatar?: string;
  username?: string;
}

// NEW VIBE TYPES

export interface Channel {
  id: number;
  name: string;
  description: string;
  avatar: string;
  owner_id: number;
  subscribers?: number;
  display_name?: string;
  created_at: string;
}

export interface ChannelPost {
  id: number;
  channel_id: number;
  sender_id: number;
  text: string;
  media: string;
  media_type: string;
  likes_count: number;
  comments_count: number;
  display_name?: string;
  avatar?: string;
  created_at: string;
}

export interface Community {
  id: number;
  name: string;
  description: string;
  avatar: string;
  owner_id: number;
  display_name?: string;
  members_count?: number;
  created_at: string;
}

export interface Poll {
  id: number;
  chat_id: number;
  creator_id: number;
  question: string;
  multiple_choice: number;
  options: PollOption[];
  votes: PollVote[];
  created_at: string;
}

export interface PollOption {
  id: number;
  poll_id: number;
  text: string;
}

export interface PollVote {
  option_id: number;
  votes: number;
}

export interface Product {
  id: number;
  seller_id: number;
  name: string;
  description: string;
  price: number;
  currency: string;
  images: string;
  category: string;
  stock: number;
  display_name?: string;
  avatar?: string;
  created_at: string;
}

export interface Order {
  id: number;
  buyer_id: number;
  product_id: number;
  quantity: number;
  total: number;
  status: string;
  name?: string;
  images?: string;
  created_at: string;
}

export interface Wishlist {
  id: number;
  user_id: number;
  name: string;
  is_public: number;
  items?: any[];
  created_at: string;
}

export interface FlashDeal {
  id: number;
  product_id: number;
  discount_percent: number;
  starts_at: string;
  ends_at: string;
  max_quantity: number;
  sold: number;
  name?: string;
  price?: number;
  images?: string;
}

export interface Meme {
  id: number;
  user_id: number;
  image_url: string;
  caption: string;
  template: string;
  likes_count: number;
  display_name?: string;
  avatar?: string;
  created_at: string;
}

export interface StickerPack {
  id: number;
  name: string;
  author_id: number;
  price: number;
  display_name?: string;
  created_at: string;
}

export interface Sticker {
  id: number;
  pack_id: number;
  image_url: string;
  emoji: string;
  pack_name?: string;
  created_at: string;
}

export interface VibeBalance {
  messaging_minutes: number;
  feed_minutes: number;
  live_minutes: number;
  shop_minutes: number;
  games_minutes: number;
  calls_minutes: number;
}

export interface FocusSession {
  id: number;
  user_id: number;
  mode: 'focus' | 'work' | 'sleep';
  started_at: string;
  ended_at?: string;
  duration_minutes: number;
  active: number;
}

export interface SmartNotification {
  id: number;
  user_id: number;
  notification_type: string;
  message: string;
  priority: 'high' | 'normal' | 'low';
  read: number;
  created_at: string;
}

export interface SharedNote {
  id: number;
  chat_id: number;
  title: string;
  content: string;
  updated_by: number;
  updated_at: string;
}

export interface GroupTask {
  id: number;
  chat_id: number;
  title: string;
  assigned_to: number;
  created_by: number;
  due_date: string;
  completed: number;
  creator_name?: string;
  assignee_name?: string;
  created_at: string;
}

export interface WatchSession {
  id: number;
  chat_id: number;
  creator_id: number;
  video_url: string;
  playback_time: number;
  playing: number;
  created_at: string;
}

export interface Game {
  id: number;
  name: string;
  type: string;
  max_players: number;
}

export interface GameSession {
  id: number;
  game_id: number;
  chat_id: number;
  creator_id: number;
  status: string;
  winner_id?: number;
  created_at: string;
}
