<script lang="ts">
  import Icon from '$lib/icon/Icon.svelte';

  let {
    videoEl = $bindable(),
    liveTitle = $bindable(''),
    onStart = () => {},
    onCancel = () => {},
    onFlipCamera = () => {},
    onAdjustZoom = (_: number) => {}
  }: {
    videoEl?: HTMLVideoElement | undefined;
    liveTitle?: string;
    onStart?: () => void;
    onCancel?: () => void;
    onFlipCamera?: () => void;
    onAdjustZoom?: (delta: number) => void;
  } = $props();
</script>

<div class="setup-header">
  <button class="back-btn" onclick={onCancel}>
    <Icon name="chevron-left" size={24} />
  </button>
  <span class="live-badge">EN VIVO</span>
  <span class="setup-title-label">{liveTitle || 'Live'}</span>
</div>

<video bind:this={videoEl} autoplay muted playsinline class="setup-video"></video>

<div class="setup-title-bar">
  <input type="text" bind:value={liveTitle} placeholder="Título de tu transmisión..." class="setup-title" maxlength="60" />
</div>

<div class="cam-fab-group">
  <button class="cam-fab" onclick={onFlipCamera} title="Cambiar cámara">
    <Icon name="flip" size={22} />
  </button>
  <button class="cam-fab" onclick={() => onAdjustZoom(0.5)} title="Acercar">
    <Icon name="search" size={22} />
  </button>
  <button class="cam-fab" onclick={() => onAdjustZoom(-0.5)} title="Alejar">
    <Icon name="search" size={22} />
  </button>
</div>

<button class="start-live-fab" onclick={onStart} disabled={!liveTitle.trim()}>
  <Icon name="play" size={20} variant="filled" />
  Iniciar
</button>

<style>
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
</style>
