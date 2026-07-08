<script lang="ts">
  import { goto } from '$app/navigation';
  import { avatarUrl, mediaUrl, uploadViaSocket } from '$lib/helpers';
  import { showToast } from '$lib/stores';
  import type { User } from '$lib/types';
  import Icon from '$lib/icon/Icon.svelte';
  import type { IconName } from '$lib/icon/icons';

  let { sk, usr, onclose, onpost, onstory }: {
    sk: any;
    usr: User | null;
    onclose?: () => void;
    onpost?: () => void;
    onstory?: () => void;
  } = $props();

  let createSwipeIdx = $state(1);
  let createStream: MediaStream | null = $state(null);
  let createVideoEl: HTMLVideoElement | undefined = $state();
  let capturedPhoto: string | null = $state(null);
  let capturedVideo: string | null = $state(null);
  let showPostOptions = $state(false);
  let textContent = $state('');
  let createFacing: 'user' | 'environment' = $state('user');
  let camMode: 'photo' | 'video' = $state('photo');
  let videoDuration: number = $state(15);
  let recording = $state(false);
  let recordedChunks: Blob[] = $state([]);
  let mediaRecorder: MediaRecorder | null = $state(null);
  let recordingTimer: number | null = $state(null);
  let recordingStart = $state(0);
  let camFilterIdx = $state(0);

  const CAM_FILTERS = [
    { name: 'Normal', css: '' },
    { name: 'Clareo', css: 'brightness(1.2) contrast(1.1)' },
    { name: 'Cálido', css: 'sepia(0.4) saturate(1.3)' },
    { name: 'Frío', css: 'hue-rotate(200deg) saturate(0.8)' },
    { name: 'Vintage', css: 'sepia(0.6) contrast(0.9) brightness(0.9)' },
    { name: 'Noir', css: 'grayscale(1) contrast(1.2)' },
    { name: 'Drama', css: 'contrast(1.4) brightness(0.8) saturate(1.1)' },
    { name: 'Pastel', css: 'saturate(0.6) brightness(1.1) hue-rotate(10deg)' },
    { name: 'Neón', css: 'saturate(2) hue-rotate(30deg) brightness(1.1)' },
    { name: 'Sépia', css: 'sepia(0.8) saturate(0.7)' },
  ];
  const VIDEO_DURATIONS: Record<number, string> = { 3: '3s', 15: '15s', 60: '60s', 180: '3min' };

  let recordingProgress = $derived(recording ? Math.min((Date.now() - recordingStart) / (videoDuration * 1000) * 100, 100) : 0);

  async function startCreateCamera(facing: 'user' | 'environment' = 'user') {
    stopCreateCamera();
    try {
      let s: MediaStream;
      const wantsAudio = camMode === 'video';
      try {
        s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing }, audio: wantsAudio });
      } catch {
        s = await navigator.mediaDevices.getUserMedia({ video: true });
      }
      createStream = s;
      createFacing = facing;
    } catch {
      showToast('No se pudo acceder a la cámara');
    }
  }

  function stopCreateCamera() {
    if (createStream) { createStream.getTracks().forEach(t => t.stop()); createStream = null; }
  }

  function flipCreateCamera() {
    const newFacing = createFacing === 'user' ? 'environment' : 'user';
    startCreateCamera(newFacing);
  }

  function capturePhoto() {
    if (!createStream || !createVideoEl) return;
    const canvas = document.createElement('canvas');
    canvas.width = createVideoEl.videoWidth || 720;
    canvas.height = createVideoEl.videoHeight || 1280;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.filter = CAM_FILTERS[camFilterIdx].css;
    ctx.drawImage(createVideoEl, 0, 0);
    capturedPhoto = canvas.toDataURL('image/jpeg', 0.9);
    showPostOptions = true;
    stopCreateCamera();
  }

  function startRecording() {
    if (!createStream || recording) return;
    recordedChunks = [];
    recordingStart = Date.now();
    recording = true;
    try {
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9'
        : MediaRecorder.isTypeSupported('video/webm;codecs=vp8') ? 'video/webm;codecs=vp8' : 'video/webm';
      const mr = new MediaRecorder(createStream, { mimeType });
      mediaRecorder = mr;
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunks = [...recordedChunks, e.data];
      };
      mr.onstop = () => {
        const blob = new Blob(recordedChunks, { type: mimeType });
        capturedVideo = URL.createObjectURL(blob);
        recording = false;
        showPostOptions = true;
        stopCreateCamera();
      };
      mr.start(100);
      recordingTimer = window.setTimeout(() => {
        if (mediaRecorder?.state === 'recording') mediaRecorder.stop();
      }, videoDuration * 1000);
    } catch {
      showToast('Error al iniciar grabación');
      recording = false;
    }
  }

  function stopRecording() {
    if (mediaRecorder?.state === 'recording') {
      mediaRecorder.stop();
      if (recordingTimer) clearTimeout(recordingTimer);
    }
  }

  function retakeMedia() {
    capturedPhoto = null;
    capturedVideo = null;
    showPostOptions = false;
    startCreateCamera();
  }

  async function publishAsPost() {
    if (!capturedPhoto && !capturedVideo) return;
    showToast('Publicando...');
    try {
      if (capturedPhoto) {
        const raw = atob(capturedPhoto.split(',')[1] || '');
        const buf = new Uint8Array(raw.length);
        for (let i = 0; i < raw.length; i++) buf[i] = raw.charCodeAt(i);
        const r = await uploadViaSocket(sk!, { name: 'post.jpg', type: 'image/jpeg', data: buf.buffer }, () => {});
        if (r?.ok && r.url) {
          sk?.emit('create_post', { text: textContent, media: r.url, mediaType: 'image' }, (res: any) => {
            if (res?.ok) {
              showToast('Post publicado');
              resetAndClose();
              onpost?.();
            } else { showToast('Error al publicar'); }
          });
        } else { showToast('Error al subir imagen'); }
      } else if (capturedVideo) {
        const resp = await fetch(capturedVideo);
        const blob = await resp.blob();
        const r = await uploadViaSocket(sk!, { name: 'post.webm', type: 'video/webm', data: await blob.arrayBuffer() }, () => {});
        if (r?.ok && r.url) {
          sk?.emit('create_post', { text: textContent, media: r.url, mediaType: 'video' }, (res: any) => {
            if (res?.ok) {
              showToast('Video publicado');
              resetAndClose();
              onpost?.();
            } else { showToast('Error al publicar'); }
          });
        } else { showToast('Error al subir video'); }
      }
    } catch { showToast('Error al publicar'); }
  }

  async function publishAsStory() {
    if (!capturedPhoto && !capturedVideo) return;
    showToast('Subiendo story...');
    try {
      let mediaUrl: string | null = null;
      if (capturedPhoto) {
        const raw = atob(capturedPhoto.split(',')[1] || '');
        const buf = new Uint8Array(raw.length);
        for (let i = 0; i < raw.length; i++) buf[i] = raw.charCodeAt(i);
        const r = await uploadViaSocket(sk!, { name: 'story.jpg', type: 'image/jpeg', data: buf.buffer }, () => {});
        if (r?.ok && r.url) mediaUrl = r.url;
      } else if (capturedVideo) {
        const resp = await fetch(capturedVideo);
        const blob = await resp.blob();
        const r = await uploadViaSocket(sk!, { name: 'story.webm', type: 'video/webm', data: await blob.arrayBuffer() }, () => {});
        if (r?.ok && r.url) mediaUrl = r.url;
      }
      if (mediaUrl) {
        sk?.emit('create_story', { media: mediaUrl }, (res: any) => {
          if (res?.ok) {
            showToast('Story publicada');
            resetAndClose();
            onstory?.();
          } else { showToast('Error al crear story'); }
        });
      } else { showToast('Error al subir'); }
    } catch { showToast('Error al crear story'); }
  }

  function resetAndClose() {
    capturedPhoto = null;
    capturedVideo = null;
    showPostOptions = false;
    textContent = '';
    if (recording) stopRecording();
    stopCreateCamera();
    onclose?.();
  }

  function goLive() {
    resetAndClose();
    goto('/live', { noScroll: true });
  }

  async function publishTextPost() {
    if (!textContent.trim()) { showToast('Escribe algo'); return; }
    sk?.emit('create_post', { text: textContent, media: '', mediaType: 'text' }, (res: any) => {
      if (res?.ok) {
        showToast('Post publicado');
        textContent = '';
        resetAndClose();
        onpost?.();
      } else { showToast('Error al publicar'); }
    });
  }

  $effect(() => {
    if (createSwipeIdx === 1 && !createStream && !capturedPhoto && !capturedVideo) {
      startCreateCamera();
    }
    if (createVideoEl && createStream && createSwipeIdx === 1) {
      createVideoEl.srcObject = createStream;
      createVideoEl.play().catch(() => {});
    }
    if (createVideoEl) {
      createVideoEl.style.filter = CAM_FILTERS[camFilterIdx].css;
    }
  });
</script>

<div class="create-overlay">
  <div class="create-header">
    <button class="create-close" onclick={resetAndClose}>
      <Icon name="x" size={24} />
    </button>
    <div class="create-tabs">
      <button class="create-tab {createSwipeIdx === 0 ? 'active' : ''}" onclick={() => { createSwipeIdx = 0; stopCreateCamera(); capturedPhoto = null; capturedVideo = null; showPostOptions = false; }}>Live</button>
      <button class="create-tab {createSwipeIdx === 1 ? 'active' : ''}" onclick={() => { createSwipeIdx = 1; }}>Cámara</button>
      <button class="create-tab {createSwipeIdx === 2 ? 'active' : ''}" onclick={() => { createSwipeIdx = 2; stopCreateCamera(); capturedPhoto = null; capturedVideo = null; showPostOptions = false; }}>Texto</button>
    </div>
  </div>

  <div class="create-swipe" style="transform: translateX(-{createSwipeIdx * 100}%)">
    <!-- Live -->
    <div class="create-panel">
      <div class="live-preview-placeholder">
        <Icon name="play" size={60} strokeWidth={1.5} style="color: rgba(255,255,255,0.3)" />
        <p class="live-placeholder-text">Transmite en vivo</p>
        <button class="go-live-btn" onclick={goLive}>
          <span class="live-dot"></span> Ir a Live
        </button>
      </div>
    </div>

    <!-- Camera -->
    <div class="create-panel camera-panel">
      {#if !capturedPhoto && !capturedVideo}
        <video bind:this={createVideoEl} autoplay muted playsinline class="create-video"></video>
        {#if createStream}
          <button class="filter-btn" onclick={() => camFilterIdx = (camFilterIdx + 1) % CAM_FILTERS.length}>
            <Icon name="filter" size={22} style="color: #fff" />
            <span class="filter-label">{CAM_FILTERS[camFilterIdx].name}</span>
          </button>
          <button class="flip-btn" onclick={flipCreateCamera}>
            <Icon name="flip" size={28} style="color: #fff" />
          </button>
          {#if recording}
            <div class="recording-indicator">
              <div class="recording-progress-ring" style="--progress: {recordingProgress}%"></div>
              <span class="recording-time">{Math.floor((Date.now() - recordingStart) / 1000)}s</span>
            </div>
          {/if}
          <div class="cam-bottom">
            <div class="mode-toggle">
              <button class="mode-btn {camMode === 'photo' ? 'active' : ''}" onclick={() => { if (!recording) { camMode = 'photo'; startCreateCamera(); } }}>Foto</button>
              <button class="mode-btn {camMode === 'video' ? 'active' : ''}" onclick={() => { if (!recording) { camMode = 'video'; startCreateCamera(); } }}>Video</button>
            </div>
            {#if camMode === 'video' && !recording}
              <div class="duration-selector">
                {#each Object.entries(VIDEO_DURATIONS) as [secs, label]}
                  <button class="duration-btn {videoDuration === parseInt(secs) ? 'active' : ''}" onclick={() => videoDuration = parseInt(secs)}>{label}</button>
                {/each}
              </div>
            {/if}
            {#if camMode === 'photo'}
              <button class="capture-btn" onclick={capturePhoto}>
                <div class="capture-ring"></div>
              </button>
            {:else}
              <button class="record-btn {recording ? 'recording-active' : ''}" onclick={recording ? stopRecording : startRecording}>
                <div class="record-ring"></div>
              </button>
            {/if}
          </div>
        {:else}
          <div class="camera-loading">Iniciando cámara...</div>
        {/if}
      {:else}
        {#if capturedPhoto}
          <img src={capturedPhoto} alt="" class="captured-preview" />
        {:else if capturedVideo}
          <video src={capturedVideo} autoplay muted loop playsinline class="captured-preview"></video>
        {/if}
        <div class="post-options">
          <button class="retake-btn" onclick={retakeMedia}>
            <Icon name="flip" size={22} style="color: #fff" />
          </button>
          <button class="option-btn" onclick={publishAsPost}>
            <Icon name="imageplus" size={28} />
            <span>Post</span>
          </button>
          <button class="option-btn story-option" onclick={publishAsStory}>
            <Icon name="plus-circle" size={28} />
            <span>Historia</span>
          </button>
        </div>
      {/if}
    </div>

    <!-- Text -->
    <div class="create-panel text-panel">
      <div class="text-create-area">
        <textarea bind:value={textContent} placeholder="¿Qué estás pensando?" class="text-input" maxlength="500"></textarea>
        <button class="publish-text-btn" onclick={publishTextPost} disabled={!textContent.trim()}>Publicar</button>
      </div>
    </div>
  </div>
</div>

<style>
  .create-overlay {
    position: fixed; inset: 0; z-index: 50;
    background: #000; display: flex; flex-direction: column;
    animation: fadeIn 0.2s ease-out;
  }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  .create-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 8px 12px; padding-top: env(safe-area-inset-top, 8px);
    z-index: 2;
  }
  .create-close { background: none; border: none; color: #fff; cursor: pointer; padding: 8px; }
  .create-tabs { display: flex; gap: 0; position: absolute; left: 50%; transform: translateX(-50%); }
  .create-tab {
    background: none; border: none; color: rgba(255,255,255,0.4);
    font-size: 15px; font-weight: 600; cursor: pointer;
    padding: 8px 16px; font-family: inherit;
    transition: color 0.2s;
  }
  .create-tab.active { color: #fff; }
  .create-swipe {
    display: flex; width: 300%; flex: 1;
    transition: transform 0.3s ease-out;
  }
  .create-panel {
    width: 100%; flex-shrink: 0;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
  }
  .live-preview-placeholder { display: flex; flex-direction: column; align-items: center; gap: 16px; }
  .live-placeholder-text { color: rgba(255,255,255,0.5); font-size: 16px; }
  .go-live-btn {
    display: flex; align-items: center; gap: 8px;
    background: #ff3040; color: #fff; border: none;
    padding: 12px 28px; border-radius: 24px;
    font-size: 16px; font-weight: 700; cursor: pointer;
    font-family: inherit;
  }
  .live-dot {
    width: 8px; height: 8px; border-radius: 50%;
    background: #fff; animation: pulse 1.5s infinite;
  }
  @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
  .filter-btn {
    position: absolute; top: 16px; left: 16px; z-index: 3;
    display: flex; flex-direction: column; align-items: center; gap: 2px;
    background: rgba(0,0,0,0.4); border: none; color: #fff;
    padding: 8px; border-radius: 8px; cursor: pointer;
  }
  .filter-label { font-size: 9px; font-weight: 600; }
  .cam-bottom {
    position: absolute; bottom: 0; left: 0; right: 0;
    display: flex; flex-direction: column; align-items: center;
    padding: 20px 20px calc(40px + env(safe-area-inset-bottom, 0px));
    background: linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 100%);
    z-index: 2;
  }
  .mode-toggle {
    display: flex; gap: 0; margin-bottom: 16px;
    background: rgba(255,255,255,0.15); border-radius: 20px; padding: 3px;
  }
  .mode-btn {
    background: none; border: none; color: rgba(255,255,255,0.6);
    padding: 6px 20px; border-radius: 18px; font-size: 13px;
    font-weight: 600; cursor: pointer; font-family: inherit;
    transition: all 0.2s;
  }
  .mode-btn.active { background: #fff; color: #000; }
  .duration-selector { display: flex; gap: 4px; margin-bottom: 16px; }
  .duration-btn {
    background: rgba(255,255,255,0.1); border: none; color: rgba(255,255,255,0.5);
    padding: 4px 14px; border-radius: 12px; font-size: 12px;
    font-weight: 500; cursor: pointer; font-family: inherit;
    transition: all 0.2s;
  }
  .duration-btn.active { background: var(--accent); color: #000; font-weight: 700; }
  .capture-btn {
    width: 72px; height: 72px; border-radius: 50%;
    background: none; border: 4px solid rgba(255,255,255,0.8);
    cursor: pointer; display: flex; align-items: center; justify-content: center;
  }
  .capture-ring { width: 58px; height: 58px; border-radius: 50%; background: rgba(255,255,255,0.9); }
  .record-btn {
    width: 72px; height: 72px; border-radius: 50%;
    background: none; border: 4px solid rgba(255,255,255,0.8);
    cursor: pointer; display: flex; align-items: center; justify-content: center;
    transition: all 0.2s;
  }
  .record-btn.recording-active { border-color: #ff3040; }
  .record-ring { width: 58px; height: 58px; border-radius: 50%; background: #ff3040; }
  .record-btn.recording-active .record-ring { width: 28px; height: 28px; border-radius: 6px; background: #ff3040; }
  .recording-indicator {
    position: absolute; top: 60px; left: 50%; transform: translateX(-50%);
    z-index: 3; display: flex; align-items: center; gap: 8px;
    background: rgba(0,0,0,0.5); padding: 6px 16px; border-radius: 20px;
  }
  .recording-progress-ring {
    width: 40px; height: 4px; background: rgba(255,255,255,0.3); border-radius: 2px; overflow: hidden;
    position: relative;
  }
  .recording-progress-ring::after {
    content: ''; position: absolute; left: 0; top: 0; height: 100%;
    width: var(--progress); background: #ff3040; border-radius: 2px;
    transition: width 0.3s;
  }
  .recording-time { color: #fff; font-size: 13px; font-weight: 600; font-variant-numeric: tabular-nums; }
  .flip-btn {
    position: absolute; top: 50%; right: 20px; transform: translateY(-50%);
    background: rgba(0,0,0,0.4); border: none; color: #fff;
    width: 44px; height: 44px; border-radius: 50%;
    cursor: pointer; display: flex; align-items: center; justify-content: center;
    z-index: 2;
  }
  .camera-panel { position: relative; overflow: hidden; }
  .create-video { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
  .camera-loading { color: rgba(255,255,255,0.5); font-size: 14px; }
  .captured-preview { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
  .post-options {
    position: absolute; bottom: 40px; left: 50%; transform: translateX(-50%);
    display: flex; gap: 24px; align-items: center; z-index: 2;
  }
  .retake-btn {
    width: 44px; height: 44px; border-radius: 50%;
    background: rgba(255,255,255,0.2); border: none; color: #fff;
    cursor: pointer; display: flex; align-items: center; justify-content: center;
  }
  .option-btn {
    display: flex; flex-direction: column; align-items: center; gap: 4px;
    background: none; border: none; color: #fff; cursor: pointer;
    font-size: 12px; font-family: inherit;
  }
  .option-btn svg { filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5)); }
  .story-option svg { stroke: var(--accent); }
  .text-panel { padding: 40px 20px; align-items: stretch; }
  .text-create-area { display: flex; flex-direction: column; gap: 16px; flex: 1; padding-top: 40px; }
  .text-input {
    flex: 1; background: rgba(255,255,255,0.05); border: none;
    border-radius: 12px; padding: 16px; color: #fff;
    font-size: 16px; resize: none; outline: none;
    font-family: inherit; min-height: 200px;
  }
  .text-input::placeholder { color: rgba(255,255,255,0.3); }
  .publish-text-btn {
    padding: 14px; background: var(--accent); color: #000;
    font-weight: 700; border: none; border-radius: 12px;
    font-size: 16px; cursor: pointer; font-family: inherit;
  }
  .publish-text-btn:disabled { opacity: 0.4; cursor: default; }
</style>
