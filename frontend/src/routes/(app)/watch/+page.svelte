<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import { avatarUrl } from '$lib/helpers';
  import { user, socket, chats, watchSession, showToast } from '$lib/stores';
  import { typedSocket } from '$lib/socket-types';
  import type { User, WatchSession } from '$lib/types';
  import Page from '$lib/components/Page.svelte';
  import Header from '$lib/components/Header.svelte';

  let usr: User | null = $state(null);
  let sk: ReturnType<typeof typedSocket> | null = $state(null);
  let cl = $state<any[]>([]);
  let session: WatchSession | null = $state(null);

  let videoUrl = $state('');
  let selectedChatId = $state('');
  let playbackTime = $state(0);
  let isPlaying = $state(false);
  let playbackTimer: ReturnType<typeof setInterval> | null = $state(null);

  user.subscribe((v) => usr = v);
  socket.subscribe((v) => sk = v);
  chats.subscribe((v) => cl = v);
  watchSession.subscribe((v) => session = v);

  onMount(() => {
    sk?.on('watch_synced', (data: any) => {
      if (data?.sessionId === session?.id) {
        playbackTime = data.playbackTime || 0;
        isPlaying = !!data.isPlaying;
      }
    });
    sk?.on('session_updated', (updated: any) => {
      if (updated?.id === session?.id) {
        session = updated;
        watchSession.set(updated);
        videoUrl = updated.video_url || videoUrl;
        playbackTime = updated.playback_time || 0;
        isPlaying = !!updated.playing;
      }
    });
  });

  onDestroy(() => {
    stopPlaybackTimer();
  });

  function startPlaybackTimer() {
    stopPlaybackTimer();
    playbackTimer = setInterval(() => {
      if (isPlaying) playbackTime += 1;
    }, 1000);
  }

  function stopPlaybackTimer() {
    if (playbackTimer) {
      clearInterval(playbackTimer);
      playbackTimer = null;
    }
  }

  function createSession() {
    if (!videoUrl || !selectedChatId) {
      showToast('Completa todos los campos');
      return;
    }
    sk?.emit('create_watch_session', { chatId: parseInt(selectedChatId), videoUrl }, (res: any) => {
      if (res?.ok) {
        session = res.session;
        watchSession.set(res.session);
        playbackTime = res.session.playback_time || 0;
        isPlaying = false;
        showToast('Sesión de Watch Together creada');
        startPlaybackTimer();
      } else {
        showToast(res?.error || 'Error al crear sesión', 'error');
      }
    });
  }

  function togglePlay() {
    if (!session) return;
    isPlaying = !isPlaying;
    sk?.emit('sync_watch', {
      sessionId: session.id,
      playbackTime,
      isPlaying: isPlaying ? 1 : 0
    });
    if (isPlaying) {
      startPlaybackTimer();
    } else {
      stopPlaybackTimer();
    }
  }

  function seekTo(e: Event) {
    if (!session) return;
    const target = e.target as HTMLInputElement;
    playbackTime = parseInt(target.value);
    sk?.emit('sync_watch', {
      sessionId: session.id,
      playbackTime,
      isPlaying: isPlaying ? 1 : 0
    });
  }

  function refreshSession() {
    if (!session) return;
    sk?.emit('get_watch_session', { sessionId: session.id }, (res: any) => {
      if (res?.session) {
        session = res.session;
        watchSession.set(res.session);
        playbackTime = res.session.playback_time || 0;
        isPlaying = !!res.session.playing;
        videoUrl = res.session.video_url || videoUrl;
      }
    });
  }

  function leaveSession() {
    stopPlaybackTimer();
    session = null;
    watchSession.set(null);
    playbackTime = 0;
    isPlaying = false;
  }

  function formatTime(t: number): string {
    const m = Math.floor(t / 60);
    const s = t % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }
</script>

<Page>
  <Header title="Watch Together" onback={() => goto('/profile')} />

  <div class="watch-page">
    {#if !session}
      <!-- Create session -->
      <div class="create-section">
        <div class="section-card">
          <h3>Nueva sesión</h3>
          <p class="section-desc">Inicia una sesión para ver videos sincronizados con amigos</p>
          <input
            type="text"
            bind:value={videoUrl}
            placeholder="URL del video (YouTube, Vimeo...)"
            class="modal-input"
          />
          <select bind:value={selectedChatId} class="modal-input">
            <option value="">Selecciona un chat</option>
            {#each cl as c}
              <option value={c.id}>{c.name}</option>
            {/each}
          </select>
          <button class="modal-btn" onclick={createSession}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/></svg>
            Iniciar sesión
          </button>
        </div>
      </div>
    {:else}
      <!-- Active session -->
      <div class="session-section">
        <div class="session-header">
          <div class="session-meta">
            <span class="session-label">Sesión activa</span>
            <span class="session-id">#{session.id}</span>
          </div>
          <button class="icon-btn" onclick={refreshSession} title="Actualizar">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
          </button>
        </div>

        <div class="video-card">
          <div class="video-placeholder">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/></svg>
          </div>
          <div class="video-url-display">
            <span class="video-url-label">URL</span>
            <a href={videoUrl} target="_blank" rel="noopener noreferrer" class="video-url-text">{videoUrl}</a>
          </div>
        </div>

        <div class="playback-card">
          <div class="playback-time">
            <span class="time-display">{formatTime(playbackTime)}</span>
            <span class="time-status" class:playing={isPlaying}>
              {isPlaying ? 'Reproduciendo' : 'Pausado'}
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="3600"
            bind:value={playbackTime}
            oninput={seekTo}
            class="seek-bar"
          />
          <div class="playback-controls">
            <button class="play-btn" onclick={togglePlay}>
              {#if isPlaying}
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
              {:else}
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              {/if}
            </button>
          </div>
        </div>

        <div class="session-actions">
          <button class="modal-btn danger" onclick={leaveSession}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>
            Abandonar sesión
          </button>
        </div>
      </div>
    {/if}
  </div>
</Page>

<style>
  .watch-page { flex: 1; overflow-y: auto; display: flex; flex-direction: column; }
  .create-section { padding: 12px; }
  .section-card { padding: 20px; background: var(--bg-2); border-radius: 16px; }
  .section-card h3 { font-size: 18px; font-weight: 700; color: var(--text); margin: 0 0 4px; }
  .section-desc { font-size: 13px; color: var(--text-3); margin-bottom: 20px; }
  .modal-input { width: 100%; padding: 14px 16px; border: 2px solid rgba(255,255,255,0.08); border-radius: 12px; font-size: 15px; outline: none; background: var(--bg-3); color: var(--text); margin-bottom: 12px; box-sizing: border-box; transition: border-color 0.2s; }
  .modal-input:focus { border-color: var(--accent); }
  .modal-input::placeholder { color: var(--text-3); }
  .modal-btn { width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; padding: 13px; background: var(--accent); color: #000; font-weight: 700; border: none; border-radius: 12px; font-size: 15px; cursor: pointer; transition: background 0.2s; }
  .modal-btn:hover { background: var(--accent-hover); }
  .modal-btn.danger { background: var(--danger); color: #fff; }
  .session-section { padding: 12px; display: flex; flex-direction: column; gap: 12px; }
  .session-header { display: flex; align-items: center; justify-content: space-between; padding: 14px; background: var(--bg-2); border-radius: 12px; }
  .session-meta { display: flex; flex-direction: column; gap: 2px; }
  .session-label { font-size: 12px; color: var(--accent); font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
  .session-id { font-size: 11px; color: var(--text-3); }
  .icon-btn { background: none; border: none; color: var(--text-2); cursor: pointer; padding: 6px; border-radius: 50%; display: flex; align-items: center; justify-content: center; transition: background 0.2s; }
  .icon-btn:hover { background: var(--border); }
  .video-card { padding: 16px; background: var(--bg-2); border-radius: 16px; display: flex; flex-direction: column; align-items: center; gap: 12px; }
  .video-placeholder { width: 100%; height: 140px; background: var(--bg-3); border-radius: 12px; display: flex; align-items: center; justify-content: center; }
  .video-url-display { width: 100%; display: flex; flex-direction: column; gap: 2px; }
  .video-url-label { font-size: 10px; color: var(--text-3); text-transform: uppercase; letter-spacing: 0.5px; }
  .video-url-text { font-size: 13px; color: var(--accent); word-break: break-all; text-decoration: none; }
  .video-url-text:hover { text-decoration: underline; }
  .playback-card { padding: 16px; background: var(--bg-2); border-radius: 16px; display: flex; flex-direction: column; align-items: center; gap: 12px; }
  .playback-time { display: flex; flex-direction: column; align-items: center; gap: 4px; }
  .time-display { font-size: 36px; font-weight: 700; color: var(--text); font-variant-numeric: tabular-nums; }
  .time-status { font-size: 12px; color: var(--text-3); font-weight: 500; display: flex; align-items: center; gap: 6px; }
  .time-status.playing { color: var(--accent); }
  .seek-bar { width: 100%; height: 4px; appearance: none; -webkit-appearance: none; background: var(--bg-3); border-radius: 2px; outline: none; cursor: pointer; }
  .seek-bar::-webkit-slider-thumb { appearance: none; -webkit-appearance: none; width: 18px; height: 18px; border-radius: 50%; background: var(--accent); border: none; cursor: pointer; }
  .playback-controls { display: flex; align-items: center; gap: 16px; }
  .play-btn { width: 56px; height: 56px; border-radius: 50%; background: var(--accent); color: #000; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: transform 0.15s, background 0.2s; }
  .play-btn:hover { transform: scale(1.05); background: var(--accent-hover); }
  .session-actions { margin-top: 4px; }
</style>
