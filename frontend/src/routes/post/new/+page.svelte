<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import { avatarUrl, loadPosts, API_URL } from '$lib/helpers';
  import { user, socket, showToast } from '$lib/stores';
  import { typedSocket } from '$lib/socket-types';
  import type { User } from '$lib/types';

  let usr: User | null = $state(null);
  let sk: ReturnType<typeof typedSocket> | null = $state(null);
  user.subscribe((v) => usr = v);
  socket.subscribe((v) => sk = v);

  let videoEl: HTMLVideoElement | undefined = $state();
  let canvasEl: HTMLCanvasElement | undefined = $state();
  let stream: MediaStream | null = $state(null);
  let cameraReady = $state(false);
  let capturedImage: string | null = $state(null);
  let selectedFile: File | null = $state(null);
  let selectedFilePreview: string | null = $state(null);
  let fileType: string | null = $state(null);
  let mode: 'text' | 'camera' | 'gallery' = $state('text');
  let uploading = $state(false);
  let text = $state('');
  let facingMode: 'user' | 'environment' = $state('user');
  let zoomLevel = $state(1);
  let minZoom = $state(1);
  let maxZoom = $state(5);

  onDestroy(() => {
    stopStream();
    if (publishTimeout) clearTimeout(publishTimeout);
  });

  let isCameraStarting = $state(false);

  $effect(() => {
    if (videoEl && stream && mode === 'camera') {
      videoEl.srcObject = stream;
      videoEl.play().catch(() => {});
    }
  });

  function stopStream() {
    if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
  }

  async function openCamera() {
    if (isCameraStarting) return;
    isCameraStarting = true;
    stopStream();
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
      stream = s;
      mode = 'camera';
      cameraReady = true;
      facingMode = 'user';
      capturedImage = null;
      const track = s.getVideoTracks()[0];
      const caps = track.getCapabilities?.();
      if (caps?.zoom) {
        minZoom = caps.zoom.min || 1;
        maxZoom = caps.zoom.max || 5;
        zoomLevel = 1;
        track.applyConstraints({ advanced: [{ zoom: 1 }] } as any).catch(() => {});
      }
    } catch {
      showToast('No se pudo acceder a la cámara');
    }
    isCameraStarting = false;
  }

  async function flipCamera() {
    if (isCameraStarting) return;
    isCameraStarting = true;
    const newFacing = facingMode === 'user' ? 'environment' : 'user';
    stopStream();
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: newFacing }, audio: false });
      stream = s;
      facingMode = newFacing;
      cameraReady = true;
    } catch {
      showToast('No se pudo cambiar cámara');
    }
    isCameraStarting = false;
  }

  function adjustZoom(delta: number) {
    const track = stream?.getVideoTracks()[0];
    if (!track) return;
    const newZoom = Math.min(maxZoom, Math.max(minZoom, zoomLevel + delta));
    zoomLevel = newZoom;
    try {
      (track.applyConstraints as any)({ advanced: [{ zoom: newZoom }] });
    } catch {}
  }

  function closeCamera() {
    if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
    cameraReady = false;
  }

  function capturePhoto() {
    if (!canvasEl || !videoEl) return;
    canvasEl.width = videoEl.videoWidth;
    canvasEl.height = videoEl.videoHeight;
    const ctx = canvasEl.getContext('2d');
    if (!ctx) return;
    ctx.save();
    ctx.scale(-1, 1);
    ctx.drawImage(videoEl, -canvasEl.width, 0);
    ctx.restore();
    capturedImage = canvasEl.toDataURL('image/jpeg', 0.8);
    closeCamera();
    mode = 'text';
  }

  function handleFileSelect(e: Event) {
    const input = e.target as HTMLInputElement;
    if (!input.files?.length) return;
    const file = input.files[0];
    selectedFile = file;
    fileType = file.type.startsWith('video/') ? 'video' : 'image';
    const reader = new FileReader();
    reader.onload = () => {
      selectedFilePreview = reader.result as string;
      mode = 'gallery';
    };
    reader.readAsDataURL(file);
    input.value = '';
  }

  function clearMedia() {
    capturedImage = null;
    selectedFile = null;
    selectedFilePreview = null;
    fileType = null;
  }

  let publishTimeout: ReturnType<typeof setTimeout> | null = $state(null);

  async function uploadMedia(dataUrl: string): Promise<string | null> {
    try {
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], 'upload.' + (fileType === 'video' ? 'mp4' : 'jpg'), { type: blob.type });
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`${API_URL}/upload`, { method: 'POST', body: form });
      const json = await res.json();
      return json.ok ? json.url : null;
    } catch {
      return null;
    }
  }

  async function publish() {
    if (!sk) { showToast('Sin conexión'); return; }
    const caption = text;
    uploading = true;
    publishTimeout = setTimeout(() => {
      uploading = false;
      showToast('El servidor no responde');
    }, 30000);
    try {
      let mediaUrl = '';
      let mediaType = 'text';
      if (capturedImage) {
        mediaUrl = await uploadMedia(capturedImage) || '';
        mediaType = 'image';
      } else if (selectedFilePreview) {
        mediaUrl = await uploadMedia(selectedFilePreview) || '';
        mediaType = fileType === 'video' ? 'video' : 'image';
      }
      if (mediaUrl === null) { showToast('Error al subir archivo'); uploading = false; if (publishTimeout) clearTimeout(publishTimeout); return; }
      if (caption.trim() || mediaUrl) {
        sk.emit('create_post', { text: caption, media: mediaUrl, mediaType }, (res: any) => {
          if (publishTimeout) clearTimeout(publishTimeout);
          uploading = false;
          if (res?.ok) {
            clearMedia();
            text = '';
            loadPosts();
            showToast('Post publicado');
            goto('/feed', { noScroll: true });
          } else {
            showToast('Error al publicar');
          }
        });
      } else {
        uploading = false;
        if (publishTimeout) clearTimeout(publishTimeout);
        showToast('Escribe algo o añade una foto');
      }
    } catch {
      uploading = false;
      if (publishTimeout) clearTimeout(publishTimeout);
      showToast('Error al publicar');
    }
  }

  let previewMedia = $derived(capturedImage || selectedFilePreview);
  let canPublish = $derived(text.trim().length > 0 || previewMedia !== null);
</script>

<div class="post-create">
  <div class="create-header">
    <button class="back-btn" onclick={() => goto('/feed', { noScroll: true })}>
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="15 18 9 12 15 6"/></svg>
    </button>
    <span class="create-title">Nuevo Post</span>
  </div>

  <div class="media-area">
    {#if mode === 'camera' && cameraReady}
      <div class="cam-close-overlay">
        <button class="cam-close-btn" onclick={closeCamera} title="Cerrar">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <video bind:this={videoEl} autoplay muted playsinline class="cam-feed"></video>
      <div class="cam-fab-group">
        <button class="cam-fab" onclick={flipCamera} title="Cambiar cámara">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M1 12h4l3-3 3 3M23 12h-4l-3-3-3 3"/><path d="M21 16v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2"/></svg>
        </button>
        <button class="cam-fab" onclick={() => adjustZoom(0.5)} title="Acercar">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35M8 11h6"/></svg>
        </button>
        <button class="cam-fab" onclick={() => adjustZoom(-0.5)} title="Alejar">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35M11 8v6"/></svg>
        </button>
      </div>
      <div class="cam-capture-row">
        <button class="cam-capture-btn" onclick={capturePhoto}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="5" fill="currentColor"/></svg>
        </button>
      </div>
    {:else if mode === 'gallery' && selectedFilePreview}
      {#if fileType === 'video'}
        <video src={selectedFilePreview} controls class="media-preview"></video>
      {:else}
        <img src={selectedFilePreview} alt="" class="media-preview" />
      {/if}
      <button class="clear-media-btn" onclick={clearMedia}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    {:else if capturedImage}
      <img src={capturedImage} alt="" class="media-preview" />
      <button class="clear-media-btn" onclick={clearMedia}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    {:else}
      <div class="media-placeholder">
        <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" stroke-width="1.2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="12" r="4"/></svg>
        <p>Añade una foto o video</p>
      </div>
    {/if}
  </div>

  <div class="media-tools">
    <button class="tool-btn" onclick={openCamera}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="12" r="4"/></svg>
      <span>Cámara</span>
    </button>
    <label class="tool-btn">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
      <span>Galería</span>
      <input type="file" accept="image/*,video/*" class="file-input" onchange={handleFileSelect} />
    </label>
  </div>

  <div class="text-area">
    <textarea bind:value={text} placeholder="¿Qué estás pensando?" class="caption-input" maxlength="2000"></textarea>
  </div>

  <div class="bottom-bar">
    <div class="char-count">{text.length}/2000</div>
    <button class="publish-btn" onclick={publish} disabled={!canPublish || uploading}>
      {uploading ? 'Publicando...' : 'Publicar'}
    </button>
  </div>
</div>

<canvas bind:this={canvasEl} style="display:none"></canvas>

<style>
  .post-create {
    position: fixed; inset: 0; z-index: 200;
    background: var(--bg); display: flex; flex-direction: column;
  }
  .create-header {
    display: flex; align-items: center; gap: 12px; padding: 16px;
    background: var(--bg-2); border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }
  .back-btn {
    background: none; border: none; color: var(--text); cursor: pointer;
    padding: 4px; display: flex; border-radius: 50%;
  }
  .back-btn:hover { background: var(--bg-3); }
  .create-title { font-size: 17px; font-weight: 600; color: var(--text); }

  .media-area {
    flex: 1; display: flex; align-items: center; justify-content: center;
    background: #000; margin: 0; overflow: hidden; position: relative;
    min-height: 300px;
  }
  .media-area:has(.cam-feed) { min-height: 0; }
  .media-placeholder {
    display: flex; flex-direction: column; align-items: center; gap: 12px;
  }
  .media-placeholder p { color: var(--text-3); font-size: 14px; margin: 0; }
  .cam-feed {
    width: 100%; height: 100%; object-fit: cover;
    position: absolute; inset: 0;
  }
  .cam-close-overlay {
    position: absolute; top: 12px; left: 12px; z-index: 10;
  }
  .cam-close-btn {
    width: 36px; height: 36px; border-radius: 50%; border: none;
    background: rgba(0,0,0,0.5); color: #fff; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    backdrop-filter: blur(6px); transition: background 0.15s;
  }
  .cam-close-btn:hover { background: rgba(0,0,0,0.7); }
  .cam-close-btn:active { transform: scale(0.9); }
  .media-preview { width: 100%; height: 100%; object-fit: contain; }

  .cam-fab-group {
    position: absolute; bottom: 90px; right: 16px; z-index: 10;
    display: flex; flex-direction: column; gap: 10px;
  }
  .cam-fab {
    width: 48px; height: 48px; border-radius: 50%; border: none;
    background: rgba(0,0,0,0.5); color: #fff; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    backdrop-filter: blur(6px); box-shadow: 0 2px 12px rgba(0,0,0,0.3);
    transition: background 0.15s, transform 0.1s;
  }
  .cam-fab:hover { background: rgba(0,0,0,0.7); }
  .cam-fab:active { transform: scale(0.9); }

  .cam-capture-row {
    position: absolute; bottom: 20px; left: 0; right: 0; z-index: 10;
    display: flex; align-items: center; justify-content: center;
  }
  .cam-capture-btn {
    width: 72px; height: 72px; border-radius: 50%; border: none;
    background: rgba(255,255,255,0.25); color: #fff; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    backdrop-filter: blur(4px); transition: background 0.15s;
  }
  .cam-capture-btn:hover { background: rgba(255,255,255,0.35); }
  .cam-capture-btn:active { transform: scale(0.95); }
  .clear-media-btn {
    position: absolute; top: 12px; right: 12px;
    width: 34px; height: 34px; border-radius: 50%; border: none;
    background: rgba(0,0,0,0.5); color: #fff; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
  }

  .media-tools {
    display: flex; gap: 8px; padding: 12px 16px;
    background: var(--bg-2); border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }
  .tool-btn {
    display: flex; align-items: center; gap: 8px;
    padding: 10px 16px; background: var(--bg-3); border: none;
    border-radius: 10px; color: var(--text); font-size: 14px;
    font-weight: 500; cursor: pointer; font-family: inherit;
    transition: background 0.15s;
  }
  .tool-btn:hover { background: var(--bg-1); }
  .file-input { display: none; }

  .text-area {
    flex: 1; padding: 12px 16px;
    background: var(--bg);
  }
  .caption-input {
    width: 100%; height: 100%; min-height: 120px;
    background: none; border: none; outline: none;
    color: var(--text); font-size: 16px; line-height: 1.5;
    resize: none; font-family: inherit;
  }
  .caption-input::placeholder { color: var(--text-3); }

  .bottom-bar {
    display: flex; align-items: center; justify-content: space-between;
    padding: 12px 16px 32px; background: var(--bg-2);
    border-top: 1px solid var(--border); flex-shrink: 0;
  }
  .char-count { font-size: 12px; color: var(--text-3); }
  .publish-btn {
    padding: 12px 28px; background: var(--accent); color: #000;
    border: none; border-radius: 12px; font-size: 15px;
    font-weight: 700; cursor: pointer; font-family: inherit;
    transition: opacity 0.15s;
  }
  .publish-btn:disabled { opacity: 0.35; cursor: not-allowed; }
  .publish-btn:not(:disabled):active { transform: scale(0.97); }
</style>