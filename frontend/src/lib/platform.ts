export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI__' in window;
}

export function isMobile(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

// ── Clipboard ──

export async function copyToClipboard(text: string): Promise<boolean> {
  if (isTauri()) {
    try {
      const { writeText } = await import('@tauri-apps/plugin-clipboard-manager');
      await writeText(text);
      return true;
    } catch {
      // fallback to Web API
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for older browsers
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      return true;
    } catch {
      return false;
    } finally {
      document.body.removeChild(ta);
    }
  }
}

// ── Share ──

export interface ShareData {
  title?: string;
  text?: string;
  url?: string;
}

export async function shareContent(data: ShareData): Promise<boolean> {
  if (isTauri()) {
    try {
      const { share } = await import('@vnidrop/tauri-plugin-share');
      await share(data);
      return true;
    } catch {
      // fallback to Web Share API
    }
  }
  try {
    if (navigator.share) {
      await navigator.share(data);
      return true;
    }
  } catch {
    // User cancelled or not available
  }
  return false;
}

// ── Camera ──

export async function takePictureTauri(): Promise<string | null> {
  if (!isTauri()) return null;
  try {
    const { takePicture } = await import('tauri-plugin-camera');
    const result = await takePicture();
    return result?.imageData ?? null;
  } catch {
    return null;
  }
}

export async function recordVideoTauri(): Promise<string | null> {
  if (!isTauri()) return null;
  try {
    const { recordVideo } = await import('tauri-plugin-camera');
    const result = await recordVideo();
    return result?.imageData ?? null;
  } catch {
    return null;
  }
}

// ── Camera ──

export interface CameraOptions {
  facingMode?: 'user' | 'environment';
  audio?: boolean;
  zoom?: number;
}

export async function getCameraStream(options: CameraOptions = {}): Promise<MediaStream | null> {
  const { facingMode = 'user', audio = false, zoom } = options;
  try {
    const constraints: MediaStreamConstraints = {
      video: { facingMode },
      audio,
    };
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    // Apply digital zoom if requested
    if (zoom && zoom > 1) {
      const track = stream.getVideoTracks()[0];
      const capabilities = track.getCapabilities();
      if (capabilities.zoom) {
        const min = capabilities.zoom.min ?? 1;
        const max = capabilities.zoom.max ?? 1;
        const level = Math.min(Math.max(zoom, min), max);
        try {
          await track.applyConstraints({ advanced: [{ zoom: level }] } as any);
        } catch {}
      }
    }
    return stream;
  } catch {
    return null;
  }
}

export function stopMediaStream(stream: MediaStream | null) {
  if (!stream) return;
  stream.getTracks().forEach((t) => t.stop());
}

export function capturePhotoFromStream(
  stream: MediaStream,
  opts: { width?: number; height?: number; format?: string; quality?: number; mirror?: boolean } = {}
): string | null {
  const { width = 640, height = 480, format = 'image/jpeg', quality = 0.8, mirror = true } = opts;
  const video = document.createElement('video');
  video.srcObject = stream;
  video.play();
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  if (mirror) {
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(video, 0, 0, width, height);
  video.pause();
  video.srcObject = null;
  return canvas.toDataURL(format, quality);
}
