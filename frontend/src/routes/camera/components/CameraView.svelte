<script lang="ts">
  import Icon from '$lib/icon/Icon.svelte';

  let {
    videoEl = $bindable(),
    cameraReady = false,
    cameraError = '',
    onflip = () => {}
  }: {
    videoEl?: HTMLVideoElement;
    cameraReady?: boolean;
    cameraError?: string;
    onflip?: () => void;
  } = $props();
</script>

<div class="cam-view">
  {#if cameraError}
    <div class="cam-error">{cameraError}</div>
  {:else if !cameraReady}
    <div class="cam-loading">Iniciando cámara...</div>
  {/if}
  <video bind:this={videoEl} autoplay muted playsinline
    class="cam-video" class:hidden={!cameraReady}></video>
  <button class="cam-flip-btn" onclick={onflip}>
    <Icon name="flip" />
  </button>
  <slot />
</div>

<style>
  .cam-view {
    flex: 1; position: relative; overflow: hidden;
    display: flex; align-items: center; justify-content: center;
  }
  .cam-video { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
  .cam-video.hidden { opacity: 0; }
  .cam-loading, .cam-error { color: rgba(255,255,255,0.5); font-size: 14px; z-index: 1; }
  .cam-error { color: #ff6b6b; }
  .cam-flip-btn {
    position: absolute; top: 50%; right: 16px; transform: translateY(-50%);
    background: rgba(0,0,0,0.4); border: none; color: #fff; width: 44px; height: 44px;
    border-radius: 50%; cursor: pointer; display: flex; align-items: center;
    justify-content: center; z-index: 3;
  }
</style>
