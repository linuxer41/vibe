<script lang="ts">
  import Icon from '$lib/icon/Icon.svelte';
  import { onMount, onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import { user, socket, showToast } from '$lib/stores';
  import { typedSocket } from '$lib/socket-types';
  import { emit } from '$lib/socket';
  import type { User, Live, LiveComment, LiveReaction } from '$lib/types';
  import MinimalLayout from '$lib/layouts/MinimalLayout.svelte';
  import LiveCard from './components/LiveCard.svelte';
  import LiveSetup from './components/LiveSetup.svelte';
  import LiveStream from './components/LiveStream.svelte';

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



  type LiveTab = 'discover' | 'hangout';
  let browseTab: LiveTab = $state('discover');
  let swipeEl: HTMLDivElement | undefined = $state();
  let swipeIndex = $state(0);
  let liveLiked = $state<Set<number>>(new Set());

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
      emit('leave_live', { liveId: viewingLive.id });
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

  async function loadLives() {
    const list = await emit<Live[]>('get_active_lives');
    activeLives = (list || []).sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime());
  }

  async function startCamera(facing: 'user' | 'environment' = 'user') {
    stopStream();
    try {
      let s: MediaStream;
      try {
        s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing }, audio: true });
      } catch {
        s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing } });
      }
      stream = s;
      facingMode = facing;
      const track = s.getVideoTracks()[0];
      if (track) {
        const caps = track.getCapabilities?.();
        if (caps?.zoom) {
          minZoom = caps.zoom.min || 1;
          maxZoom = caps.zoom.max || 5;
          zoomLevel = 1;
          track.applyConstraints({ zoom: 1 } as any).catch(() => {});
        }
      }
      return true;
    } catch {
      showToast('No se pudo acceder a la cámara');
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
    if (!track || maxZoom <= minZoom) return;
    const newZoom = Math.min(maxZoom, Math.max(minZoom, zoomLevel + delta));
    zoomLevel = newZoom;
    try {
      track.applyConstraints({ zoom: newZoom } as any);
    } catch {}
  }

  async function startLive() {
    if (!liveTitle.trim()) { showToast('Escribe un título'); return; }
    try {
      const res = await emit('start_live', { title: liveTitle });
      if (res?.ok) {
        myLiveId = res.live.id;
        myLiveUserId = usr?.id;
        streamComments = [];
        streamReactions = [];
        emit('join_live', { liveId: res.live.id });
        page = 'streaming';
        const starsRes = await emit('get_user_stars');
        userStars = starsRes?.stars || 0;
        showToast('Transmisión iniciada');
        loadLives();
      }
    } catch {
      showToast('Error al iniciar transmisión');
    }
  }

  async function stopLive() {
    if (myLiveId) {
      emit('leave_live', { liveId: myLiveId });
      const res = await emit('end_live', { liveId: myLiveId });
      if (res?.ok) showToast('Transmisión finalizada');
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

  async function sendGift() {
    if (!myLiveId || !myLiveUserId) return;
    const res = await emit('send_live_gift', { liveId: myLiveId, recipientId: myLiveUserId, stars: 1 });
    if (res?.ok) {
      userStars = Math.max(0, userStars - 1);
      showToast('⭐ Estrella enviada');
    } else {
      showToast(res?.error || 'Error al enviar estrella');
    }
  }

  // --- WATCHING MODE ---

  async function watchLive(live: Live) {
    viewingLive = live;
    liveComments = [];
    liveReactions = [];
    liveGifts = [];
    watchingGifts = [];
    commentText = '';
    page = 'watching';
    emit('join_live', { liveId: live.id });
    const comments = await emit<LiveComment[]>('get_live_comments', { liveId: live.id });
    liveComments = (comments || []).reverse();
    const reactions = await emit<LiveReaction[]>('get_live_reactions', { liveId: live.id });
    liveReactions = reactions || [];
    const gifts = await emit<any[]>('get_live_gifts', { liveId: live.id });
    liveGifts = gifts || [];
    const starsRes = await emit('get_user_stars');
    userStars = starsRes?.stars || 0;
  }

  function leaveWatching() {
    if (viewingLive?.id) {
      emit('leave_live', { liveId: viewingLive.id });
    }
    viewingLive = null;
    liveComments = [];
    liveReactions = [];
    liveGifts = [];
    watchingGifts = [];
    page = 'browse';
  }

  async function sendComment() {
    if (!commentText.trim() || !viewingLive) return;
    const text = commentText.trim();
    commentText = '';
    const res = await emit('add_live_comment', { liveId: viewingLive.id, text });
    if (!res?.ok) showToast('Error al enviar comentario');
  }

  async function sendReaction(reaction: string) {
    if (!viewingLive) return;
    const res = await emit('add_live_reaction', { liveId: viewingLive.id, reaction });
    if (!res?.ok) showToast('Error al enviar reacción');
  }

  async function sendWatchingGift() {
    if (!viewingLive) return;
    const recipientId = viewingLive.user_id;
    const res = await emit('send_live_gift', { liveId: viewingLive.id, recipientId, stars: 1 });
    if (res?.ok) {
      userStars = Math.max(0, userStars - 1);
      showToast('⭐ Estrella enviada');
    } else {
      showToast(res?.error || 'Error al enviar estrella');
    }
  }

  function likeLive(live: Live) {
    liveLiked.has(live.id) ? liveLiked.delete(live.id) : liveLiked.add(live.id);
    liveLiked = liveLiked;
  }

  function shareLive(live: Live) {
    import('$lib/platform').then(({ shareContent }) => {
      shareContent({ title: 'Vibe Live', text: `Mira el live de ${live.display_name || live.username}`, url: window.location.origin + '/live' });
    });
  }

  function onSwipeScroll() {
    if (!swipeEl) return;
    const idx = Math.round(swipeEl.scrollTop / swipeEl.clientHeight);
    if (idx !== swipeIndex) swipeIndex = idx;
  }
</script>

<MinimalLayout>
{#if page === 'browse'}
  <div class="browse-view">
    <!-- Top tabs -->
    <div class="browse-tabs">
      <button class="bt-tab {browseTab === 'discover' ? 'active' : ''}" onclick={() => browseTab = 'discover'}>Descubrir</button>
      <button class="bt-tab {browseTab === 'hangout' ? 'active' : ''}" onclick={() => browseTab = 'hangout'}>Hangout</button>
    </div>

    <!-- Go Live button -->
    <button class="go-live-btn" onclick={() => goto('/camera', { noScroll: true })}>
      <Icon name="play" size={14} variant="filled" />
      En vivo
    </button>

    <!-- TikTok-style fullscreen feed -->
    <div class="live-swipe-container" bind:this={swipeEl} onscroll={onSwipeScroll}>
      {#each activeLives as live, i (live.id)}
        <div class="live-swipe-card-wrapper" class:active={i === swipeIndex} data-index={i}>
          <LiveCard {live} isLiked={liveLiked.has(live.id)} onwatch={watchLive} onlike={likeLive} onshare={shareLive} />
        </div>
      {/each}
      {#if activeLives.length === 0}
        <div class="empty-state">
          <Icon name="play" size={56} strokeWidth={1} style="color: var(--text-3)" />
          <p>Nadie está transmitiendo</p>
          <span>Toca el botón para empezar</span>
        </div>
      {/if}
    </div>

  </div>
{:else if page === 'setup'}
  <div class="fullscreen-view">
    <LiveSetup bind:videoEl bind:liveTitle onStart={startLive} onCancel={goBack} onFlipCamera={flipCamera} onAdjustZoom={adjustZoom} />
  </div>
{:else if page === 'streaming'}
  <div class="fullscreen-view streaming-view">
    <LiveStream mode="streaming" bind:videoEl {liveTitle} {streamReactions} {streamComments} {incomingGifts} {userStars} onEnd={stopLive} onFlipCamera={flipCamera} onAdjustZoom={adjustZoom} onSendGift={sendGift} />
  </div>
{:else if page === 'watching'}
  <div class="fullscreen-view watching-view">
    <LiveStream mode="watching" {viewingLive} {liveComments} {watchingGifts} bind:commentText {userStars} onLeave={leaveWatching} onSendComment={sendComment} onSendReaction={sendReaction} onSendGift={sendWatchingGift} />
  </div>
{/if}
</MinimalLayout>

<style>
  .browse-view {
    position: fixed; inset: 0; z-index: 50;
    background: #000; display: flex; flex-direction: column;
    padding-top: 0;
  }

  .browse-tabs {
    position: absolute; top: 12px; left: 50%; transform: translateX(-50%); z-index: 10;
    display: flex; gap: 0;
    background: rgba(255,255,255,0.12); border-radius: 20px; padding: 3px;
    backdrop-filter: blur(12px);
  }
  .bt-tab {
    background: none; border: none; color: rgba(255,255,255,0.5);
    padding: 6px 18px; border-radius: 18px; font-size: 13px;
    font-weight: 600; cursor: pointer; font-family: inherit;
    transition: all 0.2s; white-space: nowrap;
  }
  .bt-tab.active { background: #fff; color: #000; }

  .go-live-btn {
    position: absolute; top: 56px; left: 50%; transform: translateX(-50%); z-index: 10;
    display: flex; align-items: center; gap: 5px;
    background: #ef4444; border: none; color: #fff;
    padding: 6px 16px; border-radius: 16px; font-size: 12px;
    font-weight: 700; cursor: pointer; font-family: inherit;
    box-shadow: 0 2px 8px rgba(239,68,68,0.3);
    transition: transform 0.15s;
  }
  .go-live-btn:active { transform: translateX(-50%) scale(0.95); }

  .live-swipe-container {
    flex: 1; overflow-y: auto; scroll-snap-type: y mandatory;
    scroll-behavior: smooth; -webkit-overflow-scrolling: touch;
    background: #000;
  }
  .live-swipe-container::-webkit-scrollbar { display: none; }

  .live-swipe-card-wrapper {
    height: 100%; scroll-snap-align: start;
  }

  .empty-state {
    display: flex; flex-direction: column; align-items: center; gap: 8px;
    padding: 64px 24px; text-align: center;
  }
  .empty-state p { color: var(--text-2); font-size: 16px; font-weight: 500; margin: 0; }
  .empty-state span { color: var(--text-3); font-size: 13px; }

  .fullscreen-view {
    position: fixed; inset: 0; z-index: 200;
    background: #000; display: flex; flex-direction: column;
  }
</style>