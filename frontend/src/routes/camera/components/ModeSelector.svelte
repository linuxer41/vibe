<script lang="ts">
  import Icon from '$lib/icon/Icon.svelte';

  let {
    selectedMode = 'story',
    onchange = (_: 'story' | 'post' | 'both') => {},
    onlive = () => {},
    oncamera = () => {},
    ongallery = () => {},
    onfilechange = (_: Event) => {},
    fileInputEl = $bindable()
  }: {
    selectedMode?: 'story' | 'post' | 'both';
    onchange?: (mode: 'story' | 'post' | 'both') => void;
    onlive?: () => void;
    oncamera?: () => void;
    ongallery?: () => void;
    onfilechange?: (e: Event) => void;
    fileInputEl?: HTMLInputElement;
  } = $props();
</script>

<div class="cam-bottom-bar">
  <button class="gallery-btn" onclick={ongallery}>
    <Icon name="image" size={22} />
  </button>

  <div class="mode-selector">
    <button class="mode-tab" class:active={selectedMode === 'story'} onclick={() => onchange('story')}>Historia</button>
    <button class="mode-tab" class:active={selectedMode === 'post'} onclick={() => onchange('post')}>Post</button>
    <button class="mode-tab" class:active={selectedMode === 'both'} onclick={() => onchange('both')}>Ambos</button>
  </div>

  <div class="live-tabs">
    <button class="bottom-tab" onclick={onlive}>Live</button>
    <button class="bottom-tab active" onclick={oncamera}>Cámara</button>
  </div>

  <input type="file" accept="image/*,video/*" bind:this={fileInputEl} class="file-input" onchange={onfilechange} />
</div>

<style>
  .cam-bottom-bar { display: flex; align-items: center; justify-content: space-between; width: 100%; gap: 8px; }
  .gallery-btn { background: none; border: none; color: #fff; cursor: pointer; padding: 8px; display: flex; align-items: center; justify-content: center; opacity: 0.8; }
  .gallery-btn:hover { opacity: 1; }
  .mode-selector { display: flex; gap: 0; background: rgba(255,255,255,0.12); border-radius: 20px; padding: 3px; }
  .mode-tab { background: none; border: none; color: rgba(255,255,255,0.5); padding: 6px 14px; border-radius: 18px; font-size: 12px; font-weight: 600; cursor: pointer; font-family: inherit; white-space: nowrap; }
  .mode-tab.active { background: #fff; color: #000; }
  .live-tabs { display: flex; gap: 0; background: rgba(255,255,255,0.12); border-radius: 20px; padding: 3px; }
  .bottom-tab { background: none; border: none; color: rgba(255,255,255,0.5); padding: 6px 16px; border-radius: 18px; font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit; white-space: nowrap; }
  .bottom-tab.active { background: #fff; color: #000; }
  .file-input { display: none; }
</style>
