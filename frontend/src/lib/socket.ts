import { io } from 'socket.io-client';
import { FORMAT_JSON, FORMAT_FLATBUFFERS, type WireFormat, detectFormat, encodeEvent, decodeEvent } from './format';
import type { TypedSocket } from './socket-types';

function getBackend(): string {
  if (typeof localStorage !== 'undefined') {
    const ls = localStorage.getItem('wa_backend');
    if (ls === 'rust' || ls === 'node') return ls;
  }
  return import.meta.env.VITE_BACKEND || 'node';
}

function getSocketUrl(): string {
  if (import.meta.env.VITE_SOCKET_URL) return import.meta.env.VITE_SOCKET_URL;
  return getBackend() === 'rust' ? 'http://localhost:3001' : 'http://localhost:3000';
}

const SOCKET_URL = getSocketUrl();

let activeFormat: WireFormat = FORMAT_JSON;

export function getActiveFormat(): WireFormat {
  return activeFormat;
}

export function setFormat(f: WireFormat) {
  activeFormat = f;
}

export function createSocket(token?: string, format?: WireFormat): TypedSocket {
  const fmt = format || activeFormat;
  activeFormat = fmt;
  const socket = io(SOCKET_URL, {
    autoConnect: false,
    auth: { token, format: fmt }
  }) as TypedSocket;
  return socket;
}

export function emitFormatted(socket: TypedSocket, event: string, data: unknown, format?: WireFormat) {
  const fmt = format || activeFormat;
  const payload = encodeEvent(event, data, fmt);
  if (fmt === FORMAT_FLATBUFFERS) {
    socket.emit(event, payload as ArrayBuffer);
  } else {
    socket.emit(event, payload);
  }
}