<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import Icon from '$lib/icon/Icon.svelte';
  import { user, socket, showToast } from '$lib/stores';
  import { typedSocket } from '$lib/socket-types';
  import { emit } from '$lib/socket';
  import type { User, LiveComment, LiveReaction } from '$lib/types';
  import MinimalLayout from '$lib/layouts/MinimalLayout.svelte';
  import CameraView from './components/CameraView.svelte';
  import CaptureControls from './components/CaptureControls.svelte';
  import PreviewPanel from './components/PreviewPanel.svelte';
  import ModeSelector from './components/ModeSelector.svelte';

  let usr: User | null = $state(null);
  let sk: ReturnType<typeof typedSocket> | null = $state(null);
  user.subscribe((v) => usr = v);
  socket.subscribe((v) => sk = v);

  // Camera
  let videoEl: HTMLVideoElement | undefined = $state();
  let stream: MediaStream | null = $state(null);
  let cameraReady = $state(false);
  let cameraError = $state('');
  let facingMode: 'user' | 'environment' = $state('user');
  let camMode: 'photo' | 'video' = $state('photo');
  let videoDuration: number = $state(15);
  let recording = $state(false);
  let recordedChunks: Blob[] = $state([]);
  let mediaRecorder: MediaRecorder | null = $state(null);
  let recordingTimer: number | null = $state(null);
  let recordingTick: number | null = $state(null);
  let recordingStart = $state(0);
  let recordingElapsed = $state(0);
  let camFilterIdx = $state(0);
  let fileInputEl: HTMLInputElement | undefined = $state();

  // Post mode
  let postMode: 'story' | 'post' | 'both' = $state('story');

  // Edit mode
  let capturedMedia: string | null = $state(null);
  let capturedIsVideo = $state(false);

  // Live mode
  type LiveState = 'off' | 'setup' | 'streaming';
  let liveState: LiveState = $state('off');
  let myLiveId: number | null = $state(null);
  let streamComments: LiveComment[] = $state([]);
  let streamReactions: LiveReaction[] = $state([]);
  let incomingGifts: any[] = $state([]);
  let userStars = $state(0);

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

  let recordingProgress = $derived(recording ? Math.min(recordingElapsed / videoDuration * 100, 100) : 0);

  onMount(() => {
    sk?.on('new_live_gift', ({ liveId, gift }: any) => {
      if (liveId === myLiveId) {
        incomingGifts = [...incomingGifts, gift];
        setTimeout(() => { incomingGifts = incomingGifts.filter(g => g.id !== gift.id); }, 3000);
      }
    });
    sk?.on('new_live_comment', ({ liveId, comment }: any) => {
      if (liveId === myLiveId) streamComments = [...streamComments, comment];
    });
    sk?.on('new_live_reaction', ({ liveId, reaction }: any) => {
      if (liveId === myLiveId) {
        streamReactions = [...streamReactions.filter(r => r.user_id !== reaction.user_id), reaction];
        setTimeout(() => { streamReactions = streamReactions.filter(r => r.user_id !== reaction.user_id); }, 3000);
      }
    });
    sk?.on('live_ended', ({ liveId }: any) => {
      if (liveId === myLiveId) stopLive();
    });
    startCreateCamera();
  });

  onDestroy(() => {
    if (myLiveId) {
      emit('leave_live', { liveId: myLiveId });
      emit('end_live', { liveId: myLiveId });
    }
    stopCreateCamera();
  });

  async function startCreateCamera(facing: 'user' | 'environment' = 'user') {
    if (stream && cameraReady) return;
    cameraReady = false;
    cameraError = '';
    try {
      let s: MediaStream;
      try {
        s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing }, audio: true });
      } catch {
        s = await navigator.mediaDevices.getUserMedia({ video: true });
      }
      stream = s;
      facingMode = facing;
      cameraReady = true;
      if (videoEl) { videoEl.srcObject = s; videoEl.play().catch(() => {}); }
    } catch { cameraError = 'No se pudo acceder a la cámara'; }
  }

  function stopCreateCamera() {
    if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
    cameraReady = false;
    if (videoEl) videoEl.srcObject = null;
  }

  $effect(() => {
    if (videoEl && stream && cameraReady) {
      videoEl.srcObject = stream;
      videoEl.play().catch(() => {});
    }
    if (videoEl && liveState === 'off') videoEl.style.filter = CAM_FILTERS[camFilterIdx].css;
  });

  function flipCamera() {
    const newFacing = facingMode === 'user' ? 'environment' : 'user';
    startCreateCamera(newFacing);
  }

  // --- Capture ---
  function capturePhoto() {
    if (!stream || !videoEl) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoEl.videoWidth || 720;
    canvas.height = videoEl.videoHeight || 1280;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.filter = CAM_FILTERS[camFilterIdx].css;
    ctx.drawImage(videoEl, 0, 0);
    capturedMedia = canvas.toDataURL('image/jpeg', 0.9);
    capturedIsVideo = false;
    stopCreateCamera();
  }

  function startRecording() {
    if (!stream || recording) return;
    recordedChunks = [];
    recordingStart = Date.now();
    recording = true;
    try {
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9'
        : MediaRecorder.isTypeSupported('video/webm;codecs=vp8') ? 'video/webm;codecs=vp8' : 'video/webm';
      const mr = new MediaRecorder(stream, { mimeType });
      mediaRecorder = mr;
      mr.ondataavailable = (e) => { if (e.data.size > 0) recordedChunks = [...recordedChunks, e.data]; };
      mr.onstop = () => {
        if (recordingTick) { clearInterval(recordingTick); recordingTick = null; }
        const blob = new Blob(recordedChunks, { type: mimeType });
        capturedMedia = URL.createObjectURL(blob);
        capturedIsVideo = true;
        recording = false;
        stopCreateCamera();
      };
      mr.start(100);
      recordingTick = window.setInterval(() => {
      recordingElapsed = Math.floor((Date.now() - recordingStart) / 1000);
    }, 200);
    recordingTimer = window.setTimeout(() => {
      if (mediaRecorder?.state === 'recording') mediaRecorder.stop();
    }, videoDuration * 1000);
    } catch { showToast('Error al iniciar grabación'); recording = false; }
  }

  function stopRecording() {
    if (mediaRecorder?.state === 'recording') {
      mediaRecorder.stop();
      if (recordingTimer) clearTimeout(recordingTimer);
      if (recordingTick) { clearInterval(recordingTick); recordingTick = null; }
    }
  }

  function goToStory() {
    if (!capturedMedia) return;
    const key = capturedIsVideo ? 'vid' : 'img';
    goto(`/story/new?${key}=${encodeURIComponent(capturedMedia)}`, { noScroll: true });
  }

  function goToNext() {
    if (!capturedMedia) return;
    const key = capturedIsVideo ? 'vid' : 'img';
    goto(`/post/new?${key}=${encodeURIComponent(capturedMedia)}`, { noScroll: true });
  }

  function retake() {
    capturedMedia = null;
    capturedIsVideo = false;
    startCreateCamera();
  }

  // --- Live ---
  function goLiveSetup() {
    if (!stream || !cameraReady) { showToast('Cámara no disponible'); return; }
    streamComments = [];
    streamReactions = [];
    incomingGifts = [];
    liveState = 'setup';
  }

  function cancelLive() {
    liveState = 'off';
  }

  async function startLive() {
    const res = await emit('start_live', { title: '' });
    if (res?.ok) {
      myLiveId = res.live.id;
      streamReactions = [];
      emit('join_live', { liveId: res.live.id });
      liveState = 'streaming';
      const starsRes = await emit('get_user_stars');
      userStars = starsRes?.stars || 0;
      showToast('Transmisión iniciada');
    } else { showToast('Error al iniciar transmisión'); }
  }

  async function stopLive() {
    if (myLiveId) {
      emit('leave_live', { liveId: myLiveId });
      const res = await emit('end_live', { liveId: myLiveId });
      if (res?.ok) showToast('Transmisión finalizada');
    }
    myLiveId = null;
    streamComments = [];
    streamReactions = [];
    liveState = 'off';
  }

  async function sendGift() {
    if (!myLiveId || !usr) return;
    const res = await emit('send_live_gift', { liveId: myLiveId, recipientId: usr.id, stars: 1 });
    if (res?.ok) { userStars = Math.max(0, userStars - 1); showToast('⭐ Estrella enviada'); }
    else { showToast(res?.error || 'Error'); }
  }

  // --- UI ---
  function updateMode(mode: 'photo' | 'video') { if (recording) return; camMode = mode; }
  function openGallery() { fileInputEl?.click(); }

  function handleGalleryFile(e: Event) {
    const input = e.target as HTMLInputElement;
    if (!input.files?.length) return;
    const file = input.files[0];
    const isVideo = file.type.startsWith('video/');
    const reader = new FileReader();
    reader.onload = () => {
      capturedMedia = reader.result as string;
      capturedIsVideo = isVideo;
      stopCreateCamera();
    };
    reader.readAsDataURL(file);
    input.value = '';
  }
</script>

<MinimalLayout>
{#if liveState === 'setup'}
  <!-- ========== LIVE SETUP ========== -->
  <div class="camera-page">
    <div class="setup-header">
      <button class="cam-header-btn" onclick={cancelLive}>
        <Icon name="chevron-left" size={24} />
      </button>
      <span class="live-badge">EN VIVO</span>
    </div>

    <video bind:this={videoEl} autoplay muted playsinline class="setup-video"></video>

    <div class="cam-bottom">
      <button class="live-start-btn" onclick={startLive}>
        <span class="live-start-inner"></span>
      </button>
    </div>
  </div>

{:else if liveState === 'streaming'}
  <!-- ========== LIVE STREAMING ========== -->
  <div class="camera-page streaming-view">
    <div class="stream-header">
      <span class="live-badge pulsating">EN VIVO</span>
      <span class="stream-title">Transmisión en vivo</span>
      <button class="stop-live-btn" onclick={stopLive}>
        <Icon name="stop" size={16} variant="filled" style="color: #fff" />
        Finalizar
      </button>
    </div>

    <video bind:this={videoEl} autoplay muted playsinline class="stream-video-full"></video>

    <div class="stream-reactions-overlay">
      {#each streamReactions as r}
        <span class="stream-reaction-bubble" style="left: {10 + Math.random() * 60}%; animation-delay: {Math.random() * 0.5}s">{r.reaction}</span>
      {/each}
    </div>

    <div class="stream-comments-overlay">
      {#each streamComments.slice(-5) as comment}
        <div class="stream-comment-bubble">
          <span class="sc-author">{comment.display_name || comment.username}</span>
          <span class="sc-text">{comment.text}</span>
        </div>
      {/each}
    </div>

    <div class="stream-footer">
      <button class="star-btn" onclick={sendGift}>
        <Icon name="star" size={18} variant="filled" />
        <span>{userStars}</span>
      </button>
    </div>

    {#each incomingGifts as gift}
      <div class="gift-animation">
        <Icon name="star" size={24} variant="filled" style="color: gold" />
        <span class="gift-name">{gift.sender_name}</span>
        <span class="gift-stars">+{gift.stars}</span>
      </div>
    {/each}
  </div>

{:else if capturedMedia}
  <!-- ========== EDIT MODE ========== -->
  <div class="camera-page">
    <PreviewPanel
      {capturedMedia}
      {capturedIsVideo}
      onretake={retake}
      onpost={goToNext}
      onstory={goToStory}
    />
  </div>

{:else}
  <!-- ========== CAPTURE MODE ========== -->
  <div class="camera-page">
    <div class="cam-header">
      <button class="cam-header-btn" onclick={() => goto('/feed', { noScroll: true })}>
        <Icon name="x" />
      </button>
    </div>

    <CameraView bind:videoEl {cameraReady} {cameraError} onflip={flipCamera}>
      {#if recording}
        <div class="rec-indicator">
          <div class="rec-progress" style="width: {recordingProgress}%"></div>
          <span class="rec-time">{recordingElapsed}s</span>
        </div>
      {/if}
      <div class="cam-bottom">
        <CaptureControls
          {camMode}
          {cameraReady}
          {recording}
          {recordingProgress}
          {recordingElapsed}
          {videoDuration}
          {camFilterIdx}
          {CAM_FILTERS}
          {usr}
          onmodechange={updateMode}
          ondurationchange={(v) => videoDuration = v}
          oncapture={capturePhoto}
          onrecordstart={startRecording}
          onrecordstop={stopRecording}
          onfilterchange={(v) => camFilterIdx = v}
        />
        <ModeSelector
          bind:fileInputEl
          selectedMode={postMode}
          onchange={(m) => postMode = m}
          onlive={goLiveSetup}
          oncamera={() => { liveState = 'off'; if (!cameraReady) startCreateCamera(); }}
          ongallery={openGallery}
          onfilechange={handleGalleryFile}
        />
      </div>
    </CameraView>
  </div>
{/if}
</MinimalLayout>

<style>
  .camera-page {
    position: fixed; inset: 0; z-index: 100;
    background: #000; display: flex; flex-direction: column;
    color: #fff;
  }
  .cam-header {
    position: absolute; top: 0; left: 0; right: 0; z-index: 10;
    display: flex; align-items: center; padding: 8px 12px;
    padding-top: env(safe-area-inset-top, 8px);
  }
  .cam-header-btn { background: none; border: none; color: #fff; cursor: pointer; padding: 8px; }

  .rec-indicator { position: absolute; top: 60px; left: 50%; transform: translateX(-50%); z-index: 3; display: flex; align-items: center; gap: 8px; background: rgba(0,0,0,0.5); padding: 6px 16px; border-radius: 20px; }
  .rec-progress { width: 0%; height: 4px; background: #ff3040; border-radius: 2px; transition: width 0.3s; }
  .rec-time { font-size: 13px; font-weight: 600; font-variant-numeric: tabular-nums; }
  .cam-bottom { position: absolute; bottom: 0; left: 0; right: 0; z-index: 3; display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 12px 20px calc(20px + env(safe-area-inset-bottom, 0px)); background: linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 60%, transparent 100%); }

  /* ---- Live Setup ---- */
  .setup-header { position: absolute; top: 0; left: 0; right: 0; z-index: 10; display: flex; align-items: center; gap: 12px; padding: 8px 12px; padding-top: env(safe-area-inset-top, 8px); background: linear-gradient(to bottom, rgba(0,0,0,0.7), transparent); }
  .live-badge { background: #ff3040; color: #fff; font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 4px; letter-spacing: 0.5px; }
  .pulsating { animation: pulse 1.5s infinite; }
  @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }
  .setup-video { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
  .live-start-btn {
    width: 72px; height: 72px; border-radius: 50%;
    background: none; border: 4px solid rgba(255,255,255,0.8);
    cursor: pointer; display: flex; align-items: center; justify-content: center;
  }
  .live-start-inner {
    width: 58px; height: 58px; border-radius: 50%;
    background: #ff3040; display: flex; align-items: center; justify-content: center;
  }
  .live-start-inner::after {
    content: ''; display: block;
    width: 0; height: 0;
    border-left: 14px solid #fff;
    border-top: 10px solid transparent;
    border-bottom: 10px solid transparent;
    margin-left: 4px;
  }

  /* ---- Live Streaming ---- */
  .streaming-view { position: fixed; inset: 0; z-index: 100; background: #000; }
  .stream-header { position: absolute; top: 0; left: 0; right: 0; z-index: 10; display: flex; align-items: center; gap: 12px; padding: 12px 16px; padding-top: env(safe-area-inset-top, 12px); background: linear-gradient(to bottom, rgba(0,0,0,0.7), transparent); }
  .stream-title { flex: 1; font-size: 14px; font-weight: 600; color: #fff; }
  .stop-live-btn { background: rgba(255,255,255,0.15); border: none; color: #fff; padding: 8px 14px; border-radius: 20px; font-size: 13px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 6px; font-family: inherit; }
  .stream-video-full { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
  .stream-reactions-overlay { position: absolute; top: 60px; right: 16px; z-index: 5; display: flex; flex-direction: column; gap: 8px; }
  .stream-reaction-bubble { font-size: 28px; animation: floatUp 2s ease-out forwards; position: absolute; }
  @keyframes floatUp { 0% { opacity: 1; transform: translateY(0) scale(0.5); } 100% { opacity: 0; transform: translateY(-120px) scale(1.2); } }
  .stream-comments-overlay { position: absolute; bottom: 100px; left: 16px; right: 80px; z-index: 5; display: flex; flex-direction: column; gap: 6px; }
  .stream-comment-bubble { background: rgba(0,0,0,0.6); border-radius: 18px; padding: 8px 14px; display: flex; flex-direction: column; gap: 2px; word-break: break-word; }
  .sc-author { font-size: 11px; font-weight: 700; color: rgba(255,255,255,0.8); }
  .sc-text { font-size: 13px; color: #fff; }
  .stream-footer { position: absolute; bottom: 32px; right: 16px; z-index: 10; }
  .star-btn { background: rgba(255,255,255,0.15); border: none; color: #fff; padding: 10px 16px; border-radius: 24px; cursor: pointer; display: flex; align-items: center; gap: 6px; font-size: 14px; font-family: inherit; }
  .gift-animation { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 15; display: flex; align-items: center; gap: 8px; background: rgba(0,0,0,0.7); padding: 12px 20px; border-radius: 16px; animation: giftPop 3s ease-out forwards; }
  @keyframes giftPop { 0% { opacity: 0; transform: translate(-50%, -50%) scale(0.5); } 20% { opacity: 1; transform: translate(-50%, -50%) scale(1); } 80% { opacity: 1; } 100% { opacity: 0; } }
  .gift-name { font-size: 14px; font-weight: 600; }
  .gift-stars { font-size: 16px; font-weight: 700; color: gold; }
</style>
