<script lang="ts">
  import Icon from '$lib/icon/Icon.svelte';
  import { avatarUrl } from '$lib/helpers';
  import type { User } from '$lib/types';

  interface FilterDef { name: string; css: string }

  let {
    camMode = 'photo',
    cameraReady = false,
    recording = false,
    recordingProgress = 0,
    recordingElapsed = 0,
    videoDuration = 15,
    camFilterIdx = 0,
    CAM_FILTERS = [] as FilterDef[],
    usr = null as User | null,
    onmodechange = (_: 'photo' | 'video') => {},
    ondurationchange = (_: number) => {},
    oncapture = () => {},
    onrecordstart = () => {},
    onrecordstop = () => {},
    onfilterchange = (_: number) => {}
  }: {
    camMode?: 'photo' | 'video';
    cameraReady?: boolean;
    recording?: boolean;
    recordingProgress?: number;
    recordingElapsed?: number;
    videoDuration?: number;
    camFilterIdx?: number;
    CAM_FILTERS?: FilterDef[];
    usr?: User | null;
    onmodechange?: (mode: 'photo' | 'video') => void;
    ondurationchange?: (secs: number) => void;
    oncapture?: () => void;
    onrecordstart?: () => void;
    onrecordstop?: () => void;
    onfilterchange?: (idx: number) => void;
  } = $props();

  const VIDEO_DURATIONS: Record<number, string> = { 3: '3s', 15: '15s', 60: '60s', 180: '3min' };

  let filterTouchStartY = $state(0);
  let filterTouchMoved = $state(false);

  function scrollFilter(delta: number) {
    const next = (camFilterIdx + delta + CAM_FILTERS.length) % CAM_FILTERS.length;
    onfilterchange(next);
  }
  function handleFilterWheel(e: WheelEvent) { e.preventDefault(); scrollFilter(e.deltaY > 0 ? 1 : -1); }
  function handleFilterTouchStart(e: TouchEvent) { filterTouchStartY = e.touches[0].clientY; filterTouchMoved = false; }
  function handleFilterTouchMove(e: TouchEvent) {
    const dy = e.touches[0].clientY - filterTouchStartY;
    if (Math.abs(dy) > 10) { filterTouchMoved = true; scrollFilter(dy > 0 ? -1 : 1); filterTouchStartY = e.touches[0].clientY; }
  }
</script>

{#if !recording}
  <div class="mode-toggle">
    <button class="mode-btn {camMode === 'photo' ? 'active' : ''}" onclick={() => onmodechange('photo')}>Foto</button>
    <button class="mode-btn {camMode === 'video' ? 'active' : ''}" onclick={() => onmodechange('video')}>Video</button>
  </div>
  {#if camMode === 'video'}
    <div class="duration-row">
      {#each Object.entries(VIDEO_DURATIONS) as [secs, label]}
        <button class="duration-btn {videoDuration === parseInt(secs) ? 'active' : ''}" onclick={() => ondurationchange(parseInt(secs))}>{label}</button>
      {/each}
    </div>
  {/if}
  <div class="capture-row">
    {#if camMode === 'photo'}
      <button class="capture-btn" onclick={oncapture} disabled={!cameraReady}
        onwheel={handleFilterWheel} ontouchstart={handleFilterTouchStart} ontouchmove={handleFilterTouchMove}>
        <div class="capture-ring">
          {#if camFilterIdx === 0}
            <div class="capture-ring-bg"></div>
          {:else}
            <div class="filter-preview-inner" style="filter: {CAM_FILTERS[camFilterIdx].css}">
              <img src={avatarUrl(usr?.id || 0, usr?.avatar)} alt="" class="filter-thumb-inner" />
            </div>
          {/if}
        </div>
      </button>
      <div class="filter-rail">
        {#each CAM_FILTERS as f, i}
          <button class="filter-rail-item {i === camFilterIdx ? 'active' : ''}" onclick={() => onfilterchange(i)} title={f.name}>
            <div class="filter-rail-thumb" style="filter: {f.css}">
              <img src={avatarUrl(usr?.id || 0, usr?.avatar)} alt="" class="filter-rail-img" />
            </div>
          </button>
        {/each}
      </div>
    {:else}
      <button class="record-btn" onclick={recording ? onrecordstop : onrecordstart} disabled={!cameraReady}>
        <div class="record-ring"></div>
      </button>
    {/if}
  </div>
{:else}
  <div class="capture-row">
    <button class="record-btn recording-active" onclick={onrecordstop}>
      <div class="record-ring"></div>
    </button>
  </div>
{/if}

<style>
  .mode-toggle { display: flex; gap: 0; background: rgba(255,255,255,0.15); border-radius: 20px; padding: 3px; }
  .mode-btn { background: none; border: none; color: rgba(255,255,255,0.6); padding: 6px 20px; border-radius: 18px; font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit; }
  .mode-btn.active { background: #fff; color: #000; }
  .duration-row { display: flex; gap: 4px; }
  .duration-btn { background: rgba(255,255,255,0.1); border: none; color: rgba(255,255,255,0.5); padding: 4px 14px; border-radius: 12px; font-size: 12px; font-weight: 500; cursor: pointer; font-family: inherit; }
  .duration-btn.active { background: var(--accent); color: #000; font-weight: 700; }
  .capture-row { position: relative; display: flex; align-items: center; justify-content: center; width: 100%; }
  .capture-btn { width: 72px; height: 72px; border-radius: 50%; background: none; border: 4px solid rgba(255,255,255,0.8); cursor: pointer; display: flex; align-items: center; justify-content: center; position: relative; }
  .capture-btn:disabled { opacity: 0.3; }
  .capture-ring { width: 58px; height: 58px; border-radius: 50%; overflow: hidden; position: relative; }
  .filter-preview-inner { width: 100%; height: 100%; border-radius: 50%; overflow: hidden; display: flex; align-items: center; justify-content: center; }
  .filter-thumb-inner { width: 100%; height: 100%; object-fit: cover; }
  .capture-ring-bg { width: 100%; height: 100%; border-radius: 50%; background: #fff; }
  .filter-rail { position: absolute; left: calc(50% + 44px); display: flex; flex-direction: row; gap: 4px; overflow-x: auto; scrollbar-width: none; padding: 2px; max-width: calc(50vw - 60px); }
  .filter-rail::-webkit-scrollbar { display: none; }
  .filter-rail-item { width: 36px; height: 36px; border-radius: 50%; overflow: hidden; border: 2px solid transparent; background: rgba(255,255,255,0.15); cursor: pointer; padding: 0; flex-shrink: 0; transition: border-color 0.2s, transform 0.2s; opacity: 0.6; }
  .filter-rail-item.active { border-color: #fff; opacity: 1; transform: scale(1.1); }
  .filter-rail-thumb { width: 100%; height: 100%; overflow: hidden; }
  .filter-rail-img { width: 100%; height: 100%; object-fit: cover; }
  .record-btn { width: 72px; height: 72px; border-radius: 50%; background: none; border: 4px solid rgba(255,255,255,0.8); cursor: pointer; display: flex; align-items: center; justify-content: center; }
  .record-btn:disabled { opacity: 0.3; }
  .record-btn.recording-active { border-color: #ff3040; }
  .record-ring { width: 58px; height: 58px; border-radius: 50%; background: #ff3040; }
  .record-btn.recording-active .record-ring { width: 28px; height: 28px; border-radius: 6px; background: #ff3040; }
</style>
