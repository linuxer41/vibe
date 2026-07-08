<script lang="ts">
  import Icon from '$lib/icon/Icon.svelte';

  let {
    oncapture
  }: {
    oncapture: (dataUrl: string) => void;
  } = $props();

  let video: HTMLVideoElement | undefined = $state();
  let canvas: HTMLCanvasElement | undefined = $state();
  let stream: MediaStream | null = $state(null);
  let facing: 'user' | 'environment' = $state('user');
  let cameraReady = $state(false);
  let error = $state('');

  async function startCamera(f: 'user' | 'environment' = facing) {
    stopCamera();
    facing = f;
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, aspectRatio: 1 },
        audio: false
      });
      stream = s;
      if (video) {
        video.srcObject = s;
        await video.play();
        cameraReady = true;
        error = '';
      }
    } catch (e: any) {
      error = e.message || 'Error al acceder a la cámara';
      cameraReady = false;
    }
  }

  function stopCamera() {
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      stream = null;
    }
    cameraReady = false;
  }

  function capture() {
    if (!video || !canvas) return;
    const size = Math.min(video.videoWidth, video.videoHeight);
    const sx = (video.videoWidth - size) / 2;
    const sy = (video.videoHeight - size) / 2;
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(video, sx, sy, size, size, 0, 0, 512, 512);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    oncapture(dataUrl);
  }

  function switchCamera() {
    startCamera(facing === 'user' ? 'environment' : 'user');
  }

  import { onMount, onDestroy } from 'svelte';
  onMount(() => startCamera());
  onDestroy(() => stopCamera());
</script>

<div class="viewfinder-wrap">
  {#if error}
    <div class="error">{error}</div>
  {:else if !cameraReady}
    <div class="loading"><div class="spinner"></div></div>
  {/if}
  <video bind:this={video} class="viewfinder-video" class:visible={cameraReady} autoplay playsinline muted />
  <canvas bind:this={canvas} class="hidden" />
  <div class="controls">
    <button class="ctrl-btn" onclick={switchCamera} title="Cambiar cámara">
      <Icon name="refresh-cw" size={22} variant="filled" style="color:#fff" />
    </button>
    <button class="capture-btn" onclick={capture} disabled={!cameraReady} title="Capturar">
      <div class="capture-ring"></div>
    </button>
    <div class="ctrl-placeholder"></div>
  </div>
</div>

<style>
  .viewfinder-wrap {
    position: relative; width: 100%; aspect-ratio: 1/1;
    background: #000; border-radius: 16px; overflow: hidden;
  }
  .viewfinder-video {
    width: 100%; height: 100%; object-fit: cover;
    opacity: 0; transition: opacity 0.3s;
  }
  .viewfinder-video.visible { opacity: 1; }
  .hidden { display: none; }
  .loading {
    position: absolute; inset: 0; display: flex;
    align-items: center; justify-content: center;
  }
  .spinner {
    width: 32px; height: 32px; border: 3px solid rgba(255,255,255,0.2);
    border-top-color: #fff; border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  .error {
    position: absolute; inset: 0; display: flex;
    align-items: center; justify-content: center;
    color: #fff; font-size: 14px; text-align: center;
    padding: 20px;
  }
  .controls {
    position: absolute; bottom: 20px; left: 0; right: 0;
    display: flex; align-items: center;
    justify-content: space-around; padding: 0 30px;
  }
  .ctrl-btn {
    width: 44px; height: 44px; border-radius: 50%;
    background: rgba(255,255,255,0.2); border: none;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; backdrop-filter: blur(4px);
  }
  .capture-btn {
    width: 64px; height: 64px; border-radius: 50%;
    background: none; border: none; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    padding: 0;
  }
  .capture-btn:disabled { opacity: 0.4; cursor: default; }
  .capture-ring {
    width: 58px; height: 58px; border-radius: 50%;
    border: 4px solid #fff; background: rgba(255,255,255,0.3);
    transition: background 0.15s;
  }
  .capture-btn:not(:disabled):active .capture-ring { background: rgba(255,255,255,0.6); }
  .ctrl-placeholder { width: 44px; }
</style>
