import type { Socket } from 'socket.io-client';
import type { User, Live, LiveComment, LiveReaction, Post, PostComment } from './types';

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
}

export interface ClientEvents {
  [event: string]: (...args: any[]) => void;
}

export type TypedSocket = Socket<ServerEvents, ClientEvents>;

export function typedSocket(sk: any): TypedSocket {
  return sk as TypedSocket;
}
