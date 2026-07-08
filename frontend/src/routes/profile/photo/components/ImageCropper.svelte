<script lang="ts">
  import Icon from '$lib/icon/Icon.svelte';

  let {
    src,
    onsave,
    onretake,
    saving = false
  }: {
    src: string;
    onsave: (croppedDataUrl: string) => void;
    onretake: () => void;
    saving?: boolean;
  } = $props();

  let container: HTMLDivElement | undefined = $state();
  let imgEl: HTMLImageElement | undefined = $state();
  let canvas: HTMLCanvasElement | undefined = $state();

  let offsetX = $state(0);
  let offsetY = $state(0);
  let dragging = $state(false);
  let dragStartX = $state(0);
  let dragStartY = $state(0);
  let dragOffX = $state(0);
  let dragOffY = $state(0);
  let scale = $state(1);

  function onPointerDown(e: PointerEvent) {
    dragging = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    dragOffX = offsetX;
    dragOffY = offsetY;
    if (container) container.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: PointerEvent) {
    if (!dragging) return;
    offsetX = dragOffX + (e.clientX - dragStartX);
    offsetY = dragOffY + (e.clientY - dragStartY);
    constrainOffset();
  }

  function onPointerUp() {
    dragging = false;
  }

  function constrainOffset() {
    if (!container || !imgEl) return;
    const cw = container.offsetWidth;
    const ch = container.offsetHeight;
    const iw = imgEl.naturalWidth * scale;
    const ih = imgEl.naturalHeight * scale;
    const maxX = (iw - cw) / 2;
    const maxY = (ih - ch) / 2;
    offsetX = Math.max(-maxX, Math.min(maxX, offsetX));
    offsetY = Math.max(-maxY, Math.min(maxY, offsetY));
  }

  function zoomIn() {
    scale = Math.min(3, scale + 0.2);
    constrainOffset();
  }

  function zoomOut() {
    scale = Math.max(0.5, scale - 0.2);
    constrainOffset();
  }

  function doSave() {
    if (!container || !imgEl || !canvas) return;
    const size = container.offsetWidth;
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;
    const iw = imgEl.naturalWidth * scale;
    const ih = imgEl.naturalHeight * scale;
    const sx = (iw - size) / 2 - offsetX;
    const sy = (ih - size) / 2 - offsetY;
    const ratio = 512 / size;
    ctx.drawImage(imgEl, sx, sy, size, size, 0, 0, 512, 512);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    onsave(dataUrl);
  }

  let loaded = $state(false);
</script>

<div class="cropper-page">
  <div
    class="crop-container"
    bind:this={container}
    onpointerdown={onPointerDown}
    onpointermove={onPointerMove}
    onpointerup={onPointerUp}
    onpointercancel={onPointerUp}
    style="touch-action: none;"
  >
    <img
      bind:this={imgEl}
      src={src}
      alt=""
      class="crop-image"
      class:loaded
      style="transform: translate({offsetX}px, {offsetY}px) scale({scale}); cursor: {dragging ? 'grabbing' : 'grab'}"
      onload={() => loaded = true}
    />
    <canvas bind:this={canvas} class="hidden" />
  </div>
  <div class="crop-actions">
    <div class="zoom-controls">
      <button class="crop-btn" onclick={zoomOut} disabled={scale <= 0.5}><Icon name="minus" size={18} variant="filled" style="color:var(--text)" /></button>
      <span class="zoom-level">{Math.round(scale * 100)}%</span>
      <button class="crop-btn" onclick={zoomIn} disabled={scale >= 3}><Icon name="plus" size={18} variant="filled" style="color:var(--text)" /></button>
    </div>
  </div>
  <div class="bottom-bar">
    <button class="action-btn" onclick={onretake}>
      <Icon name="refresh-cw" size={20} variant="filled" style="color:var(--text)" />
      <span>Repetir</span>
    </button>
    <button class="save-btn" onclick={doSave} disabled={saving}>
      {saving ? 'Guardando...' : 'Guardar'}
    </button>
  </div>
</div>

<style>
  .cropper-page {
    display: flex; flex-direction: column; height: 100%;
    background: var(--bg);
  }
  .crop-container {
    flex: 1; overflow: hidden; position: relative;
    display: flex; align-items: center; justify-content: center;
    margin: 16px; border-radius: 16px;
    aspect-ratio: 1/1; align-self: center; width: calc(100% - 32px);
    background: #000;
  }
  .crop-image {
    max-width: none; opacity: 0; transition: opacity 0.3s;
    width: 100%; height: 100%; object-fit: contain;
    user-select: none; -webkit-user-drag: none;
  }
  .crop-image.loaded { opacity: 1; }
  .hidden { display: none; }
  .crop-actions {
    display: flex; justify-content: center; padding: 8px 16px;
  }
  .zoom-controls {
    display: flex; align-items: center; gap: 16px;
    background: var(--bg-3); border-radius: 24px; padding: 6px 12px;
  }
  .zoom-level { font-size: 13px; color: var(--text-2); min-width: 40px; text-align: center; }
  .crop-btn {
    width: 36px; height: 36px; border-radius: 50%;
    background: var(--bg); border: none; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    transition: background 0.15s;
  }
  .crop-btn:hover { background: var(--border); }
  .crop-btn:disabled { opacity: 0.3; cursor: default; }
  .bottom-bar {
    display: flex; align-items: center; justify-content: space-between;
    padding: 16px 20px; gap: 12px;
    border-top: 1px solid var(--border);
  }
  .action-btn {
    display: flex; align-items: center; gap: 6px;
    background: none; border: none; cursor: pointer;
    font-size: 14px; color: var(--text); padding: 8px 12px;
    border-radius: 10px; transition: background 0.15s;
  }
  .action-btn:hover { background: var(--bg-3); }
  .save-btn {
    flex: 1; padding: 13px; background: var(--accent); color: #000;
    font-weight: 700; border: none; border-radius: 12px;
    font-size: 15px; cursor: pointer; transition: opacity 0.2s;
    max-width: 200px;
  }
  .save-btn:disabled { opacity: 0.4; cursor: default; }
</style>
