<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { avatarUrl, formatDate } from '$lib/helpers';
  import { user, socket, showToast } from '$lib/stores';
  import { typedSocket } from '$lib/socket-types';
  import type { User, Live, LiveComment, LiveReaction } from '$lib/types';

  let usr: User | null = $state(null);
  let sk: ReturnType<typeof typedSocket> | null = $state(null);
  user.subscribe((v) => usr = v);
  socket.subscribe((v) => sk = v);

  let activeLives: Live[] = $state([]);
  let myLiveId: number | null = $state(null);
  let myLiveUserId: number | null = $state(null);
  let liveTitle = $state('');
  let videoEl: HTMLVideoElement | undefined = $state();
  let stream: MediaStream | null = $state(null);
  let facingMode: 'user' | 'environment' = $state('user');
  let zoomLevel = $state(1);
  let minZoom = $state(1);
  let maxZoom = $state(5);
  let userStars = $state(0);
  let incomingGifts: any[] = $state([]);

  let viewingLive: Live | null = $state(null);
  let liveComments: LiveComment[] = $state([]);
  let liveReactions: LiveReaction[] = $state([]);
  let liveGifts: any[] = $state([]);
  let commentText = $state('');
  let watchingGifts: any[] = $state([]);

  let streamComments: LiveComment[] = $state([]);
  let streamReactions: LiveReaction[] = $state([]);

  const REACTIONS = ['❤️', '👍', '😂', '😮', '😢', '🙏'];

  type Page = 'browse' | 'setup' | 'streaming' | 'watching';
  let page: Page = $state('browse');

  onMount(() => {
    loadLives();
    sk?.on('new_live_gift', ({ liveId, gift }: any) => {
      if (liveId === myLiveId) {
        incomingGifts = [...incomingGifts, gift];
        setTimeout(() => { incomingGifts = incomingGifts.filter(g => g.id !== gift.id); }, 3000);
      }
      if (liveId === viewingLive?.id) {
        watchingGifts = [...watchingGifts, gift];
        setTimeout(() => { watchingGifts = watchingGifts.filter(g => g.id !== gift.id); }, 3000);
      }
    });
    sk?.on('new_live_comment', ({ liveId, comment }: any) => {
      if (liveId === viewingLive?.id) {
        liveComments = [...liveComments, comment];
      }
      if (liveId === myLiveId) {
        streamComments = [...streamComments, comment];
      }
    });
    sk?.on('new_live_reaction', ({ liveId, reaction }: any) => {
      if (liveId === viewingLive?.id) {
        liveReactions = [...liveReactions.filter(r => r.user_id !== reaction.user_id), reaction];
      }
      if (liveId === myLiveId) {
        streamReactions = [...streamReactions.filter(r => r.user_id !== reaction.user_id), reaction];
        setTimeout(() => { streamReactions = streamReactions.filter(r => r.user_id !== reaction.user_id); }, 3000);
      }
    });
    sk?.on('live_ended', ({ liveId }: any) => {
      if (liveId === viewingLive?.id) {
        showToast('La transmisión ha finalizado');
        leaveWatching();
      }
      activeLives = activeLives.filter(l => l.id !== liveId);
    });
    sk?.on('live_started', (live: Live) => {
      activeLives = [live, ...activeLives].sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime());
    });
  });

  onDestroy(() => {
    stopStream();
    if (viewingLive?.id) {
      sk?.emit('leave_live', { liveId: viewingLive.id });
    }
  });

  $effect(() => {
    if (videoEl && stream) {
      videoEl.srcObject = stream;
      videoEl.play().catch(() => {});
    }
  });

  function stopStream() {
    if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
  }

  function loadLives() {
    sk?.emit('get_active_lives', (list: Live[]) => {
      activeLives = list.sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime());
    });
  }

  async function startCamera(facing: 'user' | 'environment' = 'user') {
    stopStream();
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing }, audio: true });
      stream = s;
      facingMode = facing;
      const track = s.getVideoTracks()[0];
      if (track) {
        const caps = track.getCapabilities?.();
        if (caps?.zoom) {
          minZoom = caps.zoom.min || 1;
          maxZoom = caps.zoom.max || 5;
          zoomLevel = 1;
          track.applyConstraints({ advanced: [{ zoom: 1 }] } as any).catch(() => {});
        }
      }
      return true;
    } catch {
      showToast('No se pudo acceder a la cámara/micrófono');
      return false;
    }
  }

  async function goSetup() {
    if (await startCamera('user')) {
      page = 'setup';
    }
  }

  async function flipCamera() {
    const newFacing = facingMode === 'user' ? 'environment' : 'user';
    if (await startCamera(newFacing)) {
      zoomLevel = 1;
    }
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

  async function startLive() {
    if (!liveTitle.trim()) { showToast('Escribe un título'); return; }
    try {
      sk?.emit('start_live', { title: liveTitle }, (res: any) => {
        if (res?.ok) {
          myLiveId = res.live.id;
          myLiveUserId = usr?.id;
          streamComments = [];
          streamReactions = [];
          sk?.emit('join_live', { liveId: res.live.id });
          page = 'streaming';
          sk?.emit('get_user_stars', (r: any) => { userStars = r.stars; });
          showToast('Transmisión iniciada');
          loadLives();
        }
      });
    } catch {
      showToast('Error al iniciar transmisión');
    }
  }

  function stopLive() {
    if (myLiveId && sk) {
      sk.emit('leave_live', { liveId: myLiveId });
      sk.emit('end_live', { liveId: myLiveId }, (res: any) => {
        if (res?.ok) showToast('Transmisión finalizada');
      });
    }
    stopStream();
    myLiveId = null;
    myLiveUserId = null;
    liveTitle = '';
    streamComments = [];
    streamReactions = [];
    page = 'browse';
    loadLives();
  }

  function goBack() {
    stopStream();
    liveTitle = '';
    page = 'browse';
  }

  function sendGift() {
    if (!myLiveId || !myLiveUserId || !sk) return;
    sk.emit('send_live_gift', { liveId: myLiveId, recipientId: myLiveUserId, stars: 1 }, (res: any) => {
      if (res?.ok) {
        userStars = Math.max(0, userStars - 1);
        showToast('⭐ Estrella enviada');
      } else {
        showToast(res?.error || 'Error al enviar estrella');
      }
    });
  }

  // --- WATCHING MODE ---

  function watchLive(live: Live) {
    viewingLive = live;
    liveComments = [];
    liveReactions = [];
    liveGifts = [];
    watchingGifts = [];
    commentText = '';
    page = 'watching';
    sk?.emit('join_live', { liveId: live.id });
    sk?.emit('get_live_comments', { liveId: live.id }, (list: LiveComment[]) => { liveComments = list.reverse(); });
    sk?.emit('get_live_reactions', { liveId: live.id }, (list: LiveReaction[]) => { liveReactions = list; });
    sk?.emit('get_live_gifts', { liveId: live.id }, (list: any[]) => { liveGifts = list; });
    sk?.emit('get_user_stars', (r: any) => { userStars = r.stars; });
  }

  function leaveWatching() {
    if (viewingLive?.id) {
      sk?.emit('leave_live', { liveId: viewingLive.id });
    }
    viewingLive = null;
    liveComments = [];
    liveReactions = [];
    liveGifts = [];
    watchingGifts = [];
    page = 'browse';
  }

  function sendComment() {
    if (!commentText.trim() || !viewingLive || !sk) return;
    const text = commentText.trim();
    commentText = '';
    sk.emit('add_live_comment', { liveId: viewingLive.id, text }, (res: any) => {
      if (!res?.ok) showToast('Error al enviar comentario');
    });
  }

  function sendReaction(reaction: string) {
    if (!viewingLive || !sk) return;
    sk.emit('add_live_reaction', { liveId: viewingLive.id, reaction }, (res: any) => {
      if (!res?.ok) showToast('Error al enviar reacción');
    });
  }

  function sendWatchingGift() {
    if (!viewingLive || !sk) return;
    const recipientId = viewingLive.user_id;
    sk.emit('send_live_gift', { liveId: viewingLive.id, recipientId, stars: 1 }, (res: any) => {
      if (res?.ok) {
        userStars = Math.max(0, userStars - 1);
        showToast('⭐ Estrella enviada');
      } else {
        showToast(res?.error || 'Error al enviar estrella');
      }
    });
  }
</script>

{#if page === 'browse'}
  <div class="browse-view">
    <div class="lives-grid">
      {#each activeLives as live}
        <div class="live-card" onclick={() => watchLive(live)}>
          <div class="live-thumb">
            <img src={avatarUrl(live.user_id)} alt="" class="live-card-avatar" />
            <div class="live-badge-sm">EN VIVO</div>
          </div>
          <div class="live-card-info">
            <span class="live-card-name">{live.display_name || live.username}</span>
            {#if live.title}
              <span class="live-card-title">{live.title}</span>
            {/if}
            <span class="live-card-time">{formatDate(live.started_at)}</span>
          </div>
        </div>
      {/each}
      {#if activeLives.length === 0}
        <div class="empty-state">
          <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" stroke-width="1"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/></svg>
          <p>Nadie está transmitiendo</p>
          <span>Toca el botón para empezar</span>
        </div>
      {/if}
    </div>

    <button class="fab-start" onclick={goSetup}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/></svg>
      Iniciar Live
    </button>
  </div>
{:else if page === 'setup'}
  <div class="fullscreen-view">
    <div class="setup-header">
      <button class="back-btn" onclick={goBack}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="15 18 9 12 15 6"/></svg>
      </button>
      <span class="live-badge">EN VIVO</span>
      <span class="setup-title-label">{liveTitle || 'Live'}</span>
    </div>

    <video bind:this={videoEl} autoplay muted playsinline class="setup-video"></video>

    <div class="setup-title-bar">
      <input type="text" bind:value={liveTitle} placeholder="Título de tu transmisión..." class="setup-title" maxlength="60" />
    </div>

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

    <button class="start-live-fab" onclick={startLive} disabled={!liveTitle.trim()}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polygon points="8 5 19 12 8 19 8 5"/></svg>
      Iniciar
    </button>
  </div>
{:else if page === 'streaming'}
  <div class="fullscreen-view streaming-view">
    <div class="stream-header">
      <span class="live-badge pulsating">EN VIVO</span>
      <span class="stream-title-label">{liveTitle}</span>
      <button class="stop-live-btn" onclick={stopLive}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>
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

    <div class="cam-fab-group">
      <button class="cam-fab" onclick={flipCamera} title="Cambiar cámara">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M1 12h4l3-3 3 3M23 12h-4l-3-3-3 3"/><path d="M21 16v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2"/></svg>
      </button>
      <button class="cam-fab" onclick={() => adjustZoom(0.5)} title="Acercar">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35M8 11h6"/></svg>
      </button>
      <button class="cam-fab" onclick={() => adjustZoom(-0.5)} title="Alejar">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35M11 8v6"/></svg>
      </button>
    </div>

    <div class="stream-footer">
      <span class="viewer-count">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
        En vivo
      </span>
      <button class="star-btn" onclick={sendGift} title="Enviar estrella">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1"><polygon points="12 2 15 9 22 9 16 14 18 21 12 17 6 21 8 14 2 9 9 9"/></svg>
        <span>{userStars}</span>
      </button>
    </div>

    {#each incomingGifts as gift}
      <div class="gift-animation">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="gold" stroke="gold" stroke-width="1"><polygon points="12 2 15 9 22 9 16 14 18 21 12 17 6 21 8 14 2 9 9 9"/></svg>
        <span class="gift-name">{gift.sender_name}</span>
        <span class="gift-stars">+{gift.stars}</span>
      </div>
    {/each}
  </div>
{:else if page === 'watching'}
  <div class="fullscreen-view watching-view">
    <div class="watch-header">
      <button class="back-btn" onclick={leaveWatching}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="15 18 9 12 15 6"/></svg>
      </button>
      <img src={avatarUrl(viewingLive?.user_id)} alt="" class="watch-host-avatar" />
      <div class="watch-host-info">
        <span class="watch-host-name">{viewingLive?.display_name || viewingLive?.username}</span>
        <div class="watch-meta">
          <span class="live-badge-sm">EN VIVO</span>
          {#if viewingLive?.title}
            <span class="watch-title">{viewingLive.title}</span>
          {/if}
        </div>
      </div>
    </div>

    <div class="watch-video-area">
      <div class="watch-video-placeholder">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="1"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8" fill="rgba(255,255,255,0.3)"/></svg>
        <p>Cargando transmisión...</p>
      </div>
    </div>

    <div class="watch-reactions-row">
      {#each REACTIONS as emoji}
        <button class="reaction-btn" onclick={() => sendReaction(emoji)}>{emoji}</button>
      {/each}
    </div>

    <div class="watch-comments-area">
      <div class="watch-comments-list">
        {#each liveComments as comment}
          <div class="watch-comment">
            <span class="wc-author">{comment.display_name || comment.username}</span>
            <span class="wc-text">{comment.text}</span>
          </div>
        {/each}
        {#if liveComments.length === 0}
          <div class="wc-empty">Sin comentarios aún</div>
        {/if}
      </div>

      <div class="watch-input-row">
        <input
          type="text"
          bind:value={commentText}
          placeholder="Escribe un comentario..."
          class="watch-input"
          onkeydown={(e) => { if (e.key === 'Enter') sendComment(); }}
        />
        <button class="watch-send-btn" onclick={sendComment} disabled={!commentText.trim()}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        </button>
        <button class="watch-star-btn" onclick={sendWatchingGift} title="Enviar estrella">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="gold" stroke="gold" stroke-width="1"><polygon points="12 2 15 9 22 9 16 14 18 21 12 17 6 21 8 14 2 9 9 9"/></svg>
          <span>{userStars}</span>
        </button>
      </div>
    </div>

    {#each watchingGifts as gift}
      <div class="gift-animation">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="gold" stroke="gold" stroke-width="1"><polygon points="12 2 15 9 22 9 16 14 18 21 12 17 6 21 8 14 2 9 9 9"/></svg>
        <span class="gift-name">{gift.sender_name}</span>
        <span class="gift-stars">+{gift.stars}</span>
      </div>
    {/each}
  </div>
{/if}

<style>
  .browse-view { flex: 1; overflow-y: auto; padding-bottom: 100px; }

  .lives-grid { padding: 8px 12px; display: flex; flex-direction: column; gap: 10px; }
  .live-card {
    display: flex; align-items: center; gap: 12px;
    padding: 12px; background: var(--bg-2); border-radius: 14px;
    cursor: pointer; transition: background 0.15s;
  }
  .live-card:hover { background: var(--bg-3); }
  .live-card:active { transform: scale(0.98); }
  .live-thumb { position: relative; width: 72px; height: 72px; flex-shrink: 0; }
  .live-card-avatar { width: 100%; height: 100%; border-radius: 14px; object-fit: cover; }
  .live-badge-sm {
    position: absolute; bottom: 2px; left: 50%; transform: translateX(-50%);
    background: #ef4444; color: #fff; font-size: 8px; font-weight: 700;
    padding: 2px 8px; border-radius: 4px; letter-spacing: 0.5px;
    white-space: nowrap;
  }
  .live-card-info { flex: 1; display: flex; flex-direction: column; gap: 3px; }
  .live-card-name { font-size: 15px; font-weight: 600; color: var(--text); }
  .live-card-title { font-size: 13px; color: var(--text-2); }
  .live-card-time { font-size: 11px; color: var(--text-3); }

  .empty-state {
    display: flex; flex-direction: column; align-items: center; gap: 8px;
    padding: 64px 24px; text-align: center;
  }
  .empty-state p { color: var(--text-2); font-size: 16px; font-weight: 500; margin: 0; }
  .empty-state span { color: var(--text-3); font-size: 13px; }

  .fab-start {
    position: fixed; bottom: 100px; right: 20px;
    display: flex; align-items: center; gap: 8px;
    padding: 14px 22px; background: var(--accent); color: #fff;
    border: none; border-radius: 28px; font-size: 15px; font-weight: 600;
    cursor: pointer; box-shadow: 0 4px 16px rgba(0,0,0,0.25);
    transition: transform 0.15s, box-shadow 0.15s; z-index: 100;
    font-family: inherit;
  }
  .fab-start:active { transform: scale(0.95); box-shadow: 0 2px 8px rgba(0,0,0,0.2); }

  .fullscreen-view {
    position: fixed; inset: 0; z-index: 200;
    background: #000; display: flex; flex-direction: column;
  }

  .setup-header {
    position: absolute; top: 0; left: 0; right: 0; z-index: 10;
    display: flex; align-items: center; gap: 12px;
    padding: 16px; background: linear-gradient(to bottom, rgba(0,0,0,0.5), transparent);
  }
  .back-btn {
    background: none; border: none; color: #fff; cursor: pointer;
    padding: 4px; display: flex; border-radius: 50%;
  }
  .back-btn:hover { background: rgba(255,255,255,0.1); }
  .live-badge {
    background: #ef4444; color: #fff; font-size: 11px; font-weight: 700;
    padding: 4px 10px; border-radius: 4px; letter-spacing: 0.5px;
  }
  .pulsating { animation: pulse 1.5s infinite; }
  @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
  .setup-title-label { color: rgba(255,255,255,0.6); font-size: 13px; flex: 1; }

  .setup-video { flex: 1; width: 100%; object-fit: cover; }

  .setup-title-bar {
    position: absolute; bottom: 0; left: 0; right: 0; z-index: 10;
    padding: 16px 16px 32px;
    background: linear-gradient(to top, rgba(0,0,0,0.6), transparent);
  }
  .setup-title {
    width: 100%; padding: 14px 18px; box-sizing: border-box;
    border: none; border-radius: 14px;
    background: rgba(255,255,255,0.15); color: #fff;
    font-size: 16px; font-weight: 500; outline: none;
    backdrop-filter: blur(10px); font-family: inherit;
  }
  .setup-title::placeholder { color: rgba(255,255,255,0.5); }

  .cam-fab-group {
    position: absolute; bottom: 120px; right: 16px; z-index: 10;
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

  .start-live-fab {
    position: absolute; bottom: 32px; left: 50%; transform: translateX(-50%); z-index: 10;
    display: flex; align-items: center; gap: 8px;
    padding: 14px 32px; background: #ef4444; color: #fff;
    border: none; border-radius: 28px; font-size: 16px; font-weight: 700;
    cursor: pointer; box-shadow: 0 4px 20px rgba(239,68,68,0.5);
    font-family: inherit; transition: opacity 0.2s;
  }
  .start-live-fab:disabled { opacity: 0.4; cursor: not-allowed; }
  .start-live-fab:not(:disabled):active { transform: translateX(-50%) scale(0.96); }

  .streaming-view { background: #000; }
  .stream-header {
    position: absolute; top: 0; left: 0; right: 0; z-index: 10;
    display: flex; align-items: center; gap: 8px;
    padding: 12px 16px;
    background: linear-gradient(to bottom, rgba(0,0,0,0.5), transparent);
  }
  .stream-title-label {
    flex: 1; color: #fff; font-size: 14px; font-weight: 500;
    text-shadow: 0 1px 4px rgba(0,0,0,0.5); margin: 0 4px;
  }
  .stop-live-btn {
    display: flex; align-items: center; gap: 6px;
    padding: 10px 14px; background: rgba(239,68,68,0.9); color: #fff;
    border: none; border-radius: 10px; font-size: 12px; font-weight: 600;
    cursor: pointer; font-family: inherit; white-space: nowrap;
  }
  .stop-live-btn:active { transform: scale(0.96); }
  .stream-video-full { flex: 1; width: 100%; object-fit: cover; }

  .stream-footer {
    position: absolute; bottom: 0; left: 0; right: 0; z-index: 10;
    display: flex; align-items: center; justify-content: space-between;
    padding: 16px 20px 40px;
    background: linear-gradient(to top, rgba(0,0,0,0.5), transparent);
  }
  .stream-reactions-overlay {
    position: absolute; inset: 0; z-index: 5; pointer-events: none;
    overflow: hidden;
  }
  .stream-reaction-bubble {
    position: absolute; bottom: 80px; font-size: 28px;
    animation: reactFloat 2s ease-out forwards;
  }
  @keyframes reactFloat {
    0% { opacity: 1; transform: translateY(0) scale(0.5); }
    100% { opacity: 0; transform: translateY(-150px) scale(1.2); }
  }
  .stream-comments-overlay {
    position: absolute; bottom: 90px; left: 12px; right: 80px; z-index: 6;
    display: flex; flex-direction: column; gap: 4px; pointer-events: none;
  }
  .stream-comment-bubble {
    background: rgba(0,0,0,0.55); backdrop-filter: blur(6px);
    padding: 6px 10px; border-radius: 8px;
    display: flex; gap: 6px; align-items: baseline;
    animation: fadeInUp 0.3s ease-out;
  }
  @keyframes fadeInUp {
    0% { opacity: 0; transform: translateY(10px); }
    100% { opacity: 1; transform: translateY(0); }
  }
  .sc-author { font-size: 11px; font-weight: 600; color: var(--accent); white-space: nowrap; }
  .sc-text { font-size: 12px; color: #fff; }
  .viewer-count {
    display: inline-flex; align-items: center; gap: 6px;
    color: rgba(255,255,255,0.8); font-size: 13px; font-weight: 500;
  }
  .star-btn {
    display: flex; align-items: center; gap: 4px;
    padding: 6px 14px; background: rgba(255,215,0,0.2); color: gold;
    border: 1px solid rgba(255,215,0,0.4); border-radius: 20px;
    font-size: 13px; font-weight: 600; cursor: pointer;
    font-family: inherit; transition: background 0.15s;
  }
  .star-btn:hover { background: rgba(255,215,0,0.35); }
  .star-btn:active { transform: scale(0.95); }
  .star-btn span { color: #fff; font-weight: 700; }

  .gift-animation {
    position: absolute; left: 50%; transform: translateX(-50%);
    bottom: 100px; display: flex; align-items: center; gap: 6px;
    background: rgba(255,215,0,0.15); backdrop-filter: blur(6px);
    padding: 8px 16px; border-radius: 24px; z-index: 10;
    animation: floatUp 3s ease-out forwards;
  }
  .gift-name { color: #fff; font-size: 13px; font-weight: 500; }
  .gift-stars { color: gold; font-size: 14px; font-weight: 700; }
  @keyframes floatUp {
    0% { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
    100% { opacity: 0; transform: translateX(-50%) translateY(-120px) scale(1.2); }
  }

  .watching-view { background: #000; }
  .watch-header {
    display: flex; align-items: center; gap: 10px;
    padding: 12px 12px; background: var(--bg-2); flex-shrink: 0;
  }
  .watch-host-avatar { width: 36px; height: 36px; border-radius: 50%; object-fit: cover; }
  .watch-host-info { flex: 1; display: flex; flex-direction: column; gap: 2px; }
  .watch-host-name { font-size: 14px; font-weight: 600; color: var(--text); }
  .watch-meta { display: flex; align-items: center; gap: 6px; }
  .watch-title { font-size: 11px; color: var(--text-3); }
  .watch-meta .live-badge-sm { position: static; transform: none; }

  .watch-video-area {
    flex: 1; display: flex; align-items: center; justify-content: center;
    background: #111; position: relative;
  }
  .watch-video-placeholder {
    display: flex; flex-direction: column; align-items: center; gap: 12px;
  }
  .watch-video-placeholder p { color: rgba(255,255,255,0.3); font-size: 14px; margin: 0; }

  .watch-reactions-row {
    display: flex; align-items: center; justify-content: center; gap: 6px;
    padding: 8px 12px; background: var(--bg-2); flex-shrink: 0;
  }
  .reaction-btn {
    font-size: 20px; background: none; border: 2px solid transparent;
    border-radius: 50%; width: 38px; height: 38px; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    transition: border-color 0.15s, transform 0.1s;
  }
  .reaction-btn:hover { border-color: var(--accent); background: rgba(255,255,255,0.05); }
  .reaction-btn:active { transform: scale(1.2); }

  .watch-comments-area {
    flex: 0 0 220px; display: flex; flex-direction: column;
    background: var(--bg); border-top: 1px solid var(--border);
  }
  .watch-comments-list {
    flex: 1; overflow-y: auto; padding: 8px 12px;
    display: flex; flex-direction: column; gap: 6px;
  }
  .watch-comment { display: flex; gap: 6px; align-items: baseline; }
  .wc-author { font-size: 12px; font-weight: 600; color: var(--accent); white-space: nowrap; }
  .wc-text { font-size: 13px; color: var(--text); }
  .wc-empty { color: var(--text-3); font-size: 13px; text-align: center; margin-top: 40px; }

  .watch-input-row {
    display: flex; align-items: center; gap: 6px;
    padding: 8px 10px 12px; background: var(--bg-2);
    border-top: 1px solid var(--border);
  }
  .watch-input {
    flex: 1; padding: 10px 14px; border: none; border-radius: 20px;
    background: var(--bg-3); color: var(--text); font-size: 14px;
    outline: none; font-family: inherit;
  }
  .watch-input::placeholder { color: var(--text-3); }
  .watch-send-btn {
    width: 36px; height: 36px; border-radius: 50%; border: none;
    background: var(--accent); color: #000; cursor: pointer;
    display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  }
  .watch-send-btn:disabled { opacity: 0.35; cursor: not-allowed; }
  .watch-send-btn:not(:disabled):active { transform: scale(0.9); }
  .watch-star-btn {
    display: flex; align-items: center; gap: 3px;
    padding: 6px 12px; background: rgba(255,215,0,0.15); color: gold;
    border: 1px solid rgba(255,215,0,0.3); border-radius: 16px;
    font-size: 12px; font-weight: 600; cursor: pointer; flex-shrink: 0;
    font-family: inherit;
  }
  .watch-star-btn:active { transform: scale(0.95); }
  .watch-star-btn span { color: #fff; margin-left: 2px; }
</style>