<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import Icon from '$lib/icon/Icon.svelte';
  import { avatarUrl } from '$lib/helpers';
  import { user, socket, showToast } from '$lib/stores';
  import { typedSocket } from '$lib/socket-types';
  import type { User, LiveComment, LiveReaction } from '$lib/types';

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
  let filterTouchStartY = $state(0);
  let filterTouchMoved = $state(false);

  // Edit mode
  let capturedMedia: string | null = $state(null);
  let capturedIsVideo = $state(false);
  let activeTool: string | null = $state(null);

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
  const VIDEO_DURATIONS: Record<number, string> = { 3: '3s', 15: '15s', 60: '60s', 180: '3min' };

  let recordingProgress = $derived(recording ? Math.min(recordingElapsed / videoDuration * 100, 100) : 0);

  const TOOLS = [
    { id: 'music', icon: 'music', label: 'Música' },
    { id: 'text', icon: 'type', label: 'Texto' },
    { id: 'stickers', icon: 'sticker', label: 'Stickers' },
    { id: 'effects', icon: 'sparkles', label: 'Efectos' },
    { id: 'filter', icon: 'filter', label: 'Filtro' },
  ];

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
    if (myLiveId && sk) {
      sk.emit('leave_live', { liveId: myLiveId });
      sk.emit('end_live', { liveId: myLiveId });
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
    activeTool = null;
    startCreateCamera();
  }

  function toggleTool(toolId: string) {
    activeTool = activeTool === toolId ? null : toolId;
    if (toolId !== 'filter') {
      showToast('Próximamente: ' + TOOLS.find(t => t.id === toolId)?.label);
      activeTool = null;
    }
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

  function startLive() {
    if (!sk) { showToast('Sin conexión'); return; }
    sk.emit('start_live', { title: '' }, (res: any) => {
      if (res?.ok) {
        myLiveId = res.live.id;
        streamReactions = [];
        sk?.emit('join_live', { liveId: res.live.id });
        liveState = 'streaming';
        sk?.emit('get_user_stars', (r: any) => { userStars = r.stars; });
        showToast('Transmisión iniciada');
      } else { showToast('Error al iniciar transmisión'); }
    });
  }

  function stopLive() {
    if (myLiveId && sk) {
      sk.emit('leave_live', { liveId: myLiveId });
      sk.emit('end_live', { liveId: myLiveId }, (res: any) => {
        if (res?.ok) showToast('Transmisión finalizada');
      });
    }
    myLiveId = null;
    streamComments = [];
    streamReactions = [];
    liveState = 'off';
  }

  function sendGift() {
    if (!myLiveId || !usr || !sk) return;
    sk.emit('send_live_gift', { liveId: myLiveId, recipientId: usr.id, stars: 1 }, (res: any) => {
      if (res?.ok) { userStars = Math.max(0, userStars - 1); showToast('⭐ Estrella enviada'); }
      else { showToast(res?.error || 'Error'); }
    });
  }

  // --- UI ---
  function scrollFilter(delta: number) { camFilterIdx = (camFilterIdx + delta + CAM_FILTERS.length) % CAM_FILTERS.length; }
  function handleFilterWheel(e: WheelEvent) { e.preventDefault(); scrollFilter(e.deltaY > 0 ? 1 : -1); }
  function handleFilterTouchStart(e: TouchEvent) { filterTouchStartY = e.touches[0].clientY; filterTouchMoved = false; }
  function handleFilterTouchMove(e: TouchEvent) {
    const dy = e.touches[0].clientY - filterTouchStartY;
    if (Math.abs(dy) > 10) { filterTouchMoved = true; scrollFilter(dy > 0 ? -1 : 1); filterTouchStartY = e.touches[0].clientY; }
  }
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
    <div class="edit-mode">
      <div class="edit-media">
        {#if capturedIsVideo}
          <video src={capturedMedia} autoplay muted loop playsinline class="edit-video"></video>
        {:else}
          <img src={capturedMedia} alt="" class="edit-img" />
        {/if}
      </div>
      <div class="edit-topbar">
        <button class="edit-close-btn" onclick={retake}><Icon name="x" size={24} /></button>
      </div>
      <div class="edit-toolbar">
        {#each TOOLS as tool}
          <button class="tool-btn" onclick={() => toggleTool(tool.id)}>
            <Icon name={tool.icon} size={24} />
            <span class="tool-label">{tool.label}</span>
          </button>
        {/each}
      </div>
      <div class="edit-bottom">
        <button class="retake-text-btn" onclick={retake}>
          <Icon name="flip" size={16} /><span>Rehacer</span>
        </button>
        <button class="story-btn" onclick={goToStory}>
          <Icon name="plus-circle" size={22} />
          <span>Historia</span>
        </button>
        <button class="next-btn" onclick={goToNext}>
          <span>Siguiente</span><Icon name="chevron-right" size={20} />
        </button>
      </div>
    </div>
  </div>

{:else}
  <!-- ========== CAPTURE MODE ========== -->
  <div class="camera-page">
    <div class="cam-header">
      <button class="cam-header-btn" onclick={() => goto('/feed', { noScroll: true })}>
        <Icon name="x" />
      </button>
    </div>

    <div class="cam-view">
      {#if cameraError}
        <div class="cam-error">{cameraError}</div>
      {:else if !cameraReady}
        <div class="cam-loading">Iniciando cámara...</div>
      {/if}
      <video bind:this={videoEl} autoplay muted playsinline class="cam-video" class:hidden={!cameraReady}></video>

      <button class="cam-flip-btn" onclick={flipCamera}><Icon name="flip" /></button>

      {#if recording}
        <div class="rec-indicator">
          <div class="rec-progress" style="width: {recordingProgress}%"></div>
          <span class="rec-time">{recordingElapsed}s</span>
        </div>
      {/if}

      <div class="cam-bottom">
        {#if !recording}
          <div class="mode-toggle">
            <button class="mode-btn {camMode === 'photo' ? 'active' : ''}" onclick={() => updateMode('photo')}>Foto</button>
            <button class="mode-btn {camMode === 'video' ? 'active' : ''}" onclick={() => updateMode('video')}>Video</button>
          </div>
          {#if camMode === 'video'}
            <div class="duration-row">
              {#each Object.entries(VIDEO_DURATIONS) as [secs, label]}
                <button class="duration-btn {videoDuration === parseInt(secs) ? 'active' : ''}" onclick={() => videoDuration = parseInt(secs)}>{label}</button>
              {/each}
            </div>
          {/if}
          <div class="capture-row">
            {#if camMode === 'photo'}
              <button class="capture-btn" onclick={capturePhoto} disabled={!cameraReady}
                onwheel={handleFilterWheel} ontouchstart={handleFilterTouchStart} ontouchmove={handleFilterTouchMove}>
                <div class="capture-ring">
                  {#if camFilterIdx === 0}
                    <div class="capture-ring-bg"></div>
                  {:else}
                    <div class="filter-preview-inner" style="filter: {CAM_FILTERS[camFilterIdx].css}">
                      <img src={avatarUrl(usr?.id || 0)} alt="" class="filter-thumb-inner" />
                    </div>
                  {/if}
                </div>
              </button>
              <div class="filter-rail">
                {#each CAM_FILTERS as f, i}
                  <button class="filter-rail-item {i === camFilterIdx ? 'active' : ''}" onclick={() => camFilterIdx = i} title={f.name}>
                    <div class="filter-rail-thumb" style="filter: {f.css}">
                      <img src={avatarUrl(usr?.id || 0)} alt="" class="filter-rail-img" />
                    </div>
                  </button>
                {/each}
              </div>
            {:else}
              <button class="record-btn" onclick={recording ? stopRecording : startRecording} disabled={!cameraReady}>
                <div class="record-ring"></div>
              </button>
            {/if}
          </div>
        {:else}
          <div class="capture-row">
            <button class="record-btn recording-active" onclick={stopRecording}>
              <div class="record-ring"></div>
            </button>
          </div>
        {/if}
        <div class="cam-bottom-bar">
          <button class="gallery-btn" onclick={openGallery}><Icon name="image" size={22} /></button>
          <div class="bottom-tabs">
            <button class="bottom-tab {liveState !== 'off' ? 'active' : ''}" onclick={goLiveSetup}>Live</button>
            <button class="bottom-tab active" onclick={() => { liveState = 'off'; if (!cameraReady) startCreateCamera(); }}>Cámara</button>
          </div>
          <input type="file" accept="image/*,video/*" bind:this={fileInputEl} class="file-input" onchange={handleGalleryFile} />
        </div>
      </div>
    </div>
  </div>
{/if}

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

  /* ---- Capture mode ---- */
  .cam-view { flex: 1; position: relative; overflow: hidden; display: flex; align-items: center; justify-content: center; }
  .cam-video { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
  .cam-video.hidden { opacity: 0; }
  .cam-loading, .cam-error { color: rgba(255,255,255,0.5); font-size: 14px; z-index: 1; }
  .cam-error { color: #ff6b6b; }
  .filter-preview-inner { width: 100%; height: 100%; border-radius: 50%; overflow: hidden; display: flex; align-items: center; justify-content: center; }
  .filter-thumb-inner { width: 100%; height: 100%; object-fit: cover; }
  .capture-ring-bg { width: 100%; height: 100%; border-radius: 50%; background: #fff; }
  .capture-row { position: relative; display: flex; align-items: center; justify-content: center; width: 100%; }
  .capture-btn { width: 72px; height: 72px; border-radius: 50%; background: none; border: 4px solid rgba(255,255,255,0.8); cursor: pointer; display: flex; align-items: center; justify-content: center; position: relative; }
  .capture-btn:disabled { opacity: 0.3; }
  .capture-ring { width: 58px; height: 58px; border-radius: 50%; overflow: hidden; position: relative; }
  .filter-rail { position: absolute; left: calc(50% + 44px); display: flex; flex-direction: row; gap: 4px; overflow-x: auto; scrollbar-width: none; padding: 2px; max-width: calc(50vw - 60px); }
  .filter-rail::-webkit-scrollbar { display: none; }
  .filter-rail-item { width: 36px; height: 36px; border-radius: 50%; overflow: hidden; border: 2px solid transparent; background: rgba(255,255,255,0.15); cursor: pointer; padding: 0; flex-shrink: 0; transition: border-color 0.2s, transform 0.2s; opacity: 0.6; }
  .filter-rail-item.active { border-color: #fff; opacity: 1; transform: scale(1.1); }
  .filter-rail-thumb { width: 100%; height: 100%; overflow: hidden; }
  .filter-rail-img { width: 100%; height: 100%; object-fit: cover; }
  .cam-flip-btn { position: absolute; top: 50%; right: 16px; transform: translateY(-50%); background: rgba(0,0,0,0.4); border: none; color: #fff; width: 44px; height: 44px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; z-index: 3; }
  .rec-indicator { position: absolute; top: 60px; left: 50%; transform: translateX(-50%); z-index: 3; display: flex; align-items: center; gap: 8px; background: rgba(0,0,0,0.5); padding: 6px 16px; border-radius: 20px; }
  .rec-progress { width: 0%; height: 4px; background: #ff3040; border-radius: 2px; transition: width 0.3s; }
  .rec-time { font-size: 13px; font-weight: 600; font-variant-numeric: tabular-nums; }
  .cam-bottom { position: absolute; bottom: 0; left: 0; right: 0; z-index: 3; display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 12px 20px calc(20px + env(safe-area-inset-bottom, 0px)); background: linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 60%, transparent 100%); }
  .mode-toggle { display: flex; gap: 0; background: rgba(255,255,255,0.15); border-radius: 20px; padding: 3px; }
  .mode-btn { background: none; border: none; color: rgba(255,255,255,0.6); padding: 6px 20px; border-radius: 18px; font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit; }
  .mode-btn.active { background: #fff; color: #000; }
  .duration-row { display: flex; gap: 4px; }
  .duration-btn { background: rgba(255,255,255,0.1); border: none; color: rgba(255,255,255,0.5); padding: 4px 14px; border-radius: 12px; font-size: 12px; font-weight: 500; cursor: pointer; font-family: inherit; }
  .duration-btn.active { background: var(--accent); color: #000; font-weight: 700; }
  .record-btn { width: 72px; height: 72px; border-radius: 50%; background: none; border: 4px solid rgba(255,255,255,0.8); cursor: pointer; display: flex; align-items: center; justify-content: center; }
  .record-btn:disabled { opacity: 0.3; }
  .record-btn.recording-active { border-color: #ff3040; }
  .record-ring { width: 58px; height: 58px; border-radius: 50%; background: #ff3040; }
  .record-btn.recording-active .record-ring { width: 28px; height: 28px; border-radius: 6px; background: #ff3040; }
  .cam-bottom-bar { display: flex; align-items: center; justify-content: space-between; width: 100%; }
  .gallery-btn { background: none; border: none; color: #fff; cursor: pointer; padding: 8px; display: flex; align-items: center; justify-content: center; opacity: 0.8; }
  .gallery-btn:hover { opacity: 1; }
  .bottom-tabs { display: flex; gap: 0; background: rgba(255,255,255,0.12); border-radius: 20px; padding: 3px; }
  .bottom-tab { background: none; border: none; color: rgba(255,255,255,0.5); padding: 6px 16px; border-radius: 18px; font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit; white-space: nowrap; }
  .bottom-tab.active { background: #fff; color: #000; }
  .file-input { display: none; }
  .hidden { display: none; }

  /* ---- Edit mode ---- */
  .edit-mode { position: absolute; inset: 0; display: flex; flex-direction: column; background: #000; }
  .edit-media { flex: 1; display: flex; align-items: center; justify-content: center; overflow: hidden; }
  .edit-img, .edit-video { width: 100%; height: 100%; object-fit: cover; }
  .edit-topbar { position: absolute; top: 0; left: 0; right: 0; z-index: 10; display: flex; align-items: center; padding: 8px 12px; padding-top: env(safe-area-inset-top, 8px); }
  .edit-close-btn { background: rgba(0,0,0,0.4); border: none; color: #fff; width: 36px; height: 36px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; }
  .edit-toolbar { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); z-index: 10; display: flex; flex-direction: column; gap: 6px; }
  .tool-btn { background: rgba(0,0,0,0.5); border: none; color: #fff; width: 48px; height: 48px; border-radius: 50%; cursor: pointer; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; }
  .tool-btn:active { transform: scale(0.9); }
  .tool-label { font-size: 9px; line-height: 1; }
  .edit-bottom { position: absolute; bottom: 0; left: 0; right: 0; z-index: 10; display: flex; align-items: center; justify-content: space-between; padding: 12px 16px calc(32px + env(safe-area-inset-bottom, 0px)); background: linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 100%); }
  .retake-text-btn { background: none; border: none; color: rgba(255,255,255,0.7); cursor: pointer; display: flex; align-items: center; gap: 6px; font-size: 14px; padding: 8px; font-family: inherit; }
  .story-btn { background: none; border: none; color: var(--accent); cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 2px; font-size: 11px; font-family: inherit; padding: 4px; }
  .next-btn { background: var(--accent); color: #000; border: none; padding: 10px 20px; border-radius: 24px; font-size: 15px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 4px; font-family: inherit; }
  .next-btn:active { opacity: 0.8; }

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
