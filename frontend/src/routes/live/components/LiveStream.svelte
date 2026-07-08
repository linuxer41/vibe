<script lang="ts">
  import Icon from '$lib/icon/Icon.svelte';
  import { avatarUrl } from '$lib/helpers';

  const REACTIONS = ['❤️', '👍', '😂', '😮', '😢', '🙏'];

  let {
    mode = 'streaming',
    videoEl = $bindable(),
    liveTitle = '',
    viewingLive = null,
    streamReactions = [],
    streamComments = [],
    liveComments = [],
    incomingGifts = [],
    watchingGifts = [],
    userStars = 0,
    commentText = $bindable(''),
    onEnd = () => {},
    onFlipCamera = () => {},
    onAdjustZoom = (_: number) => {},
    onSendGift = () => {},
    onSendComment = () => {},
    onSendReaction = (_: string) => {},
    onLeave = () => {}
  }: {
    mode: 'streaming' | 'watching';
    videoEl?: HTMLVideoElement | undefined;
    liveTitle?: string;
    viewingLive?: any;
    streamReactions?: any[];
    streamComments?: any[];
    liveComments?: any[];
    incomingGifts?: any[];
    watchingGifts?: any[];
    userStars?: number;
    commentText?: string;
    onEnd?: () => void;
    onFlipCamera?: () => void;
    onAdjustZoom?: (delta: number) => void;
    onSendGift?: () => void;
    onSendComment?: () => void;
    onSendReaction?: (reaction: string) => void;
    onLeave?: () => void;
  } = $props();
</script>

{#if mode === 'streaming'}
  <div class="stream-header">
    <span class="live-badge pulsating">EN VIVO</span>
    <span class="stream-title-label">{liveTitle}</span>
    <button class="stop-live-btn" onclick={onEnd}>
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

  <div class="cam-fab-group">
    <button class="cam-fab" onclick={onFlipCamera} title="Cambiar cámara">
      <Icon name="flip" size={20} />
    </button>
    <button class="cam-fab" onclick={() => onAdjustZoom(0.5)} title="Acercar">
      <Icon name="search" size={20} />
    </button>
    <button class="cam-fab" onclick={() => onAdjustZoom(-0.5)} title="Alejar">
      <Icon name="search" size={20} />
    </button>
  </div>

  <div class="stream-footer">
    <span class="viewer-count">
      <Icon name="eye" size={16} />
      En vivo
    </span>
    <button class="star-btn" onclick={onSendGift} title="Enviar estrella">
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
{:else if mode === 'watching'}
  <div class="watch-header">
    <button class="back-btn" onclick={onLeave}>
      <Icon name="chevron-left" size={24} />
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
      <Icon name="play" size={64} strokeWidth={1} style="color: rgba(255,255,255,0.3)" />
      <p>Cargando transmisión...</p>
    </div>
  </div>

  <div class="watch-reactions-row">
    {#each REACTIONS as emoji}
      <button class="reaction-btn" onclick={() => onSendReaction(emoji)}>{emoji}</button>
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
        onkeydown={(e) => { if (e.key === 'Enter') onSendComment(); }}
      />
      <button class="watch-send-btn" onclick={onSendComment} disabled={!commentText.trim()}>
        <Icon name="sendhoriz" size={18} />
      </button>
      <button class="watch-star-btn" onclick={onSendGift} title="Enviar estrella">
        <Icon name="star" size={18} variant="filled" style="color: gold" />
        <span>{userStars}</span>
      </button>
    </div>
  </div>

  {#each watchingGifts as gift}
    <div class="gift-animation">
      <Icon name="star" size={24} variant="filled" style="color: gold" />
      <span class="gift-name">{gift.sender_name}</span>
      <span class="gift-stars">+{gift.stars}</span>
    </div>
  {/each}
{/if}

<style>
  .stream-header {
    position: absolute; top: 0; left: 0; right: 0; z-index: 10;
    display: flex; align-items: center; gap: 8px;
    padding: 12px 16px;
    background: linear-gradient(to bottom, rgba(0,0,0,0.5), transparent);
  }
  .live-badge {
    background: #ef4444; color: #fff; font-size: 11px; font-weight: 700;
    padding: 4px 10px; border-radius: 4px; letter-spacing: 0.5px;
  }
  .pulsating { animation: pulse 1.5s infinite; }
  @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
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

  .stream-footer {
    position: absolute; bottom: 0; left: 0; right: 0; z-index: 10;
    display: flex; align-items: center; justify-content: space-between;
    padding: 16px 20px 40px;
    background: linear-gradient(to top, rgba(0,0,0,0.5), transparent);
  }
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

  .watch-header {
    display: flex; align-items: center; gap: 10px;
    padding: 12px 12px; background: var(--bg-2); flex-shrink: 0;
  }
  .back-btn {
    background: none; border: none; color: #fff; cursor: pointer;
    padding: 4px; display: flex; border-radius: 50%;
  }
  .back-btn:hover { background: rgba(255,255,255,0.1); }
  .watch-host-avatar { width: 36px; height: 36px; border-radius: 50%; object-fit: cover; }
  .watch-host-info { flex: 1; display: flex; flex-direction: column; gap: 2px; }
  .watch-host-name { font-size: 14px; font-weight: 600; color: var(--text); }
  .watch-meta { display: flex; align-items: center; gap: 6px; }
  .watch-title { font-size: 11px; color: var(--text-3); }

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

  .live-badge-sm {
    background: #ef4444; color: #fff; font-size: 8px; font-weight: 700;
    padding: 2px 8px; border-radius: 4px; letter-spacing: 0.5px; white-space: nowrap;
  }
</style>
