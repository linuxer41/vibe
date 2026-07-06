<script lang="ts">
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import { avatarUrl, loadPosts, uploadViaSocket } from '$lib/helpers';
  import { user, socket, postInput, showToast } from '$lib/stores';
  import UploadProgress from '$lib/components/UploadProgress.svelte';
  import type { User } from '$lib/types';

  let usr: User | null = $state(null);
  let sk: any = $state(null);
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
  let uploadProgress = $state(0);
  let uploadStatus: 'idle' | 'preparing' | 'uploading' | 'processing' | 'done' | 'error' = $state('idle');

  async function startCamera() {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
      if (videoEl) videoEl.srcObject = stream;
      cameraReady = true;
      mode = 'camera';
      capturedImage = null;
    } catch {
      showToast('No se pudo acceder a la cámara');
    }
  }

  function stopCamera() {
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
    stopCamera();
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

  async function createPost() {
    if (!sk) return;
    const txt = get(postInput);
    uploading = true;
    uploadStatus = 'preparing';
    uploadProgress = 0;

    const doUpload = (): Promise<{ url: string; mt: string }> => new Promise((resolve) => {
      if (capturedImage) {
        const raw = atob(capturedImage.split(',')[1] || '');
        const buf = new Uint8Array(raw.length);
        for (let i = 0; i < raw.length; i++) buf[i] = raw.charCodeAt(i);
        uploadViaSocket(sk, { name: 'upload.jpg', type: 'image/jpeg', data: buf.buffer }, (pct, st) => { uploadProgress = pct; uploadStatus = st as any; })
          .then(r => resolve({ url: r.ok ? r.url || '' : '', mt: 'image' }));
      } else if (selectedFile) {
        uploadViaSocket(sk, selectedFile, (pct, st) => { uploadProgress = pct; uploadStatus = st as any; })
          .then(r => {
            const mt = selectedFile!.type.startsWith('video/') ? 'video' : 'image';
            resolve({ url: r.ok ? r.url || '' : '', mt });
          });
      } else {
        resolve({ url: '', mt: 'text' });
      }
    });

    const { url: mediaUrl, mt } = await doUpload();
    sk.emit('create_post', { text: txt, media: mediaUrl, mediaType: mt }, (res: any) => {
      uploading = false;
      uploadStatus = 'idle';
      if (res?.ok) {
        postInput.set('');
        clearMedia();
        loadPosts();
        showToast('Post publicado');
        if (stream) stopCamera();
      } else {
        showToast('Error al publicar');
      }
    });
  }
</script>

<div class="create-view">
  <div class="create-preview">
    {#if mode === 'camera' && cameraReady}
      <video bind:this={videoEl} autoplay muted playsinline class="cam-video"></video>
      <div class="cam-actions">
        <button class="cam-btn" onclick={stopCamera}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
        <button class="cam-btn capture-btn" onclick={capturePhoto}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/></svg>
        </button>
        <div style="width:20px"></div>
      </div>
    {:else if mode === 'gallery' && selectedFilePreview}
      {#if fileType === 'video'}
        <video src={selectedFilePreview} controls class="cam-preview-media"></video>
      {:else}
        <img src={selectedFilePreview} alt="" class="cam-preview-media" />
      {/if}
      <button class="cam-clear-btn" onclick={clearMedia}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    {:else if capturedImage}
      <img src={capturedImage} alt="" class="cam-preview-media" />
      <button class="cam-clear-btn" onclick={clearMedia}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    {:else}
      <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" stroke-width="1.5"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="12" r="4"/></svg>
      <p>Crear post</p>
    {/if}
  </div>

  <div class="create-bar">
    <button class="media-btn" onclick={startCamera} title="Cámara">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="12" r="4"/></svg>
    </button>
    <label class="media-btn" title="Galería">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
      <input type="file" accept="image/*,video/*" class="file-input" onchange={handleFileSelect} />
    </label>
    <input type="text" bind:value={$postInput} placeholder="¿Qué estás pensando?" onkeydown={(e) => e.key === 'Enter' && createPost()} />
    <button class="small-btn" onclick={createPost} disabled={uploading}>{uploading ? '...' : 'Publicar'}</button>
  </div>

  <UploadProgress progress={uploadProgress} status={uploadStatus} fileName={selectedFile?.name || 'Foto'} fileSize={selectedFile?.size || 0} />
</div>

<canvas bind:this={canvasEl} style="display:none"></canvas>

<style>
  .create-view { flex: 1; overflow-y: auto; }
  .create-preview {
    display: flex; flex-direction: column; align-items: center;
    justify-content: center; padding: 0; gap: 8px;
    background: #000; margin: 12px; border-radius: 16px;
    overflow: hidden; min-height: 200px; position: relative;
  }
  .create-preview svg { opacity: 0.4; }
  .create-preview p { color: var(--text-3); font-size: 14px; opacity: 0.4; }
  .cam-video { width: 100%; max-height: 300px; object-fit: cover; transform: scaleX(-1); }
  .cam-preview-media { width: 100%; max-height: 300px; object-fit: contain; }
  .cam-actions { display: flex; align-items: center; justify-content: space-around; width: 100%; padding: 12px; }
  .cam-btn { width: 44px; height: 44px; border-radius: 50%; border: none; background: rgba(255,255,255,0.2); color: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(4px); }
  .capture-btn { width: 60px; height: 60px; background: rgba(255,255,255,0.3); }
  .cam-clear-btn { position: absolute; top: 8px; right: 8px; width: 32px; height: 32px; border-radius: 50%; border: none; background: rgba(0,0,0,0.5); color: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center; }
  .create-bar { display: flex; align-items: center; gap: 8px; padding: 10px 12px; background: var(--bg-2); margin: 0 12px 12px; border-radius: 12px; }
  .create-bar input { flex: 1; background: none; border: none; outline: none; color: var(--text); font-size: 15px; min-width: 0; }
  .create-bar input::placeholder { color: var(--text-3); }
  .media-btn { background: none; border: none; cursor: pointer; padding: 6px; display: flex; align-items: center; flex-shrink: 0; }
  .file-input { display: none; }
  .small-btn { padding: 8px 16px; background: var(--accent); color: #000; font-weight: 600; border: none; border-radius: 8px; font-size: 13px; cursor: pointer; white-space: nowrap; flex-shrink: 0; }
  .small-btn:disabled { opacity: 0.5; }
</style>
