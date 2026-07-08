import type { User, Live, LiveComment, LiveReaction, Post, PostComment, WatchSession } from './types';

export interface ServerEvents {
  new_post: (post: Post) => void;
  new_post_comment: (data: { postId: number; comment: PostComment }) => void;
  post_liked: (data: { postId: number; userId: number }) => void;
  new_live_comment: (data: { liveId: number; comment: LiveComment }) => void;
  new_live_reaction: (data: { liveId: number; reaction: LiveReaction }) => void;
  new_live_gift: (data: { liveId: number; gift: any }) => void;
  live_started: (live: Live) => void;
  live_ended: (data: { liveId: number }) => void;
  typing: (data: { chatId: number; userId: number; name: string }) => void;
  stop_typing: (data: { chatId: number; userId: number }) => void;
  contact_status: (data: { userId: number; online: boolean }) => void;
  broadcast_ended: (data: { broadcastId: number }) => void;
  broadcast_removed: (data: { broadcastId: number }) => void;
  call_ended: (data: { callId: number; reason: string }) => void;
  watch_synced: (data: { sessionId: number; playbackTime: number; isPlaying: number }) => void;
  session_updated: (session: WatchSession) => void;
}

export interface ClientEvents {
  [event: string]: (...args: any[]) => void;
}

export interface VibeSocket {
  id: string;
  connected: boolean;
  connect(): void;
  close(): void;
  disconnect(): void;
  emit(event: string, data?: any, callback?: (res: any) => void): void;
  on(event: string, handler: (...args: any[]) => void): void;
  off(event: string, handler: (...args: any[]) => void): void;
}

export type TypedSocket = VibeSocket;

export function typedSocket(sk: any): TypedSocket {
  return sk as TypedSocket;
}
