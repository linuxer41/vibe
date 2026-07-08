<script lang="ts">
  import Icon from '$lib/icon/Icon.svelte';
  import type { IconName } from '$lib/icon/icons';

  let {
    capturedMedia = null as string | null,
    capturedIsVideo = false,
    onretake = () => {},
    onpost = () => {},
    onstory = () => {},
    onboth = () => {}
  }: {
    capturedMedia?: string | null;
    capturedIsVideo?: boolean;
    onretake?: () => void;
    onpost?: () => void;
    onstory?: () => void;
    onboth?: () => void;
  } = $props();

  const TOOLS: { id: string; icon: IconName; label: string }[] = [
    { id: 'music', icon: 'music', label: 'Música' },
    { id: 'text', icon: 'type', label: 'Texto' },
    { id: 'stickers', icon: 'sticker', label: 'Stickers' },
    { id: 'effects', icon: 'sparkles', label: 'Efectos' },
    { id: 'filter', icon: 'filter', label: 'Filtro' },
  ];

  let activeTool: string | null = $state(null);

  function toggleTool(toolId: string) {
    activeTool = activeTool === toolId ? null : toolId;
    if (toolId !== 'filter') {
      // future: showToast now comes from parent, skip for now
      activeTool = null;
    }
  }
</script>

<div class="edit-mode">
  <div class="edit-media">
    {#if capturedIsVideo}
      <video src={capturedMedia} autoplay muted loop playsinline class="edit-video"></video>
    {:else}
      <img src={capturedMedia} alt="" class="edit-img" />
    {/if}
  </div>
  <div class="edit-topbar">
    <button class="edit-close-btn" onclick={onretake}><Icon name="x" size={24} /></button>
  </div>
  <div class="edit-toolbar">
    {#each TOOLS as tool}
      <button class="tool-btn" onclick={() => toggleTool(tool.id)}>
        <Icon name={tool.icon} size={24} />
        <span class="tool-label">{tool.label}</span>
      </button>
    {/each}
  </div>
  <div class="edit-bottom">
    <button class="retake-text-btn" onclick={onretake}>
      <Icon name="flip" size={16} /><span>Rehacer</span>
    </button>
    <button class="story-btn" onclick={onstory}>
      <Icon name="plus-circle" size={22} />
      <span>Historia</span>
    </button>
    <button class="next-btn" onclick={onpost}>
      <span>Siguiente</span><Icon name="chevron-right" size={20} />
    </button>
  </div>
</div>

<style>
  .edit-mode { position: absolute; inset: 0; display: flex; flex-direction: column; background: #000; }
  .edit-media { flex: 1; display: flex; align-items: center; justify-content: center; overflow: hidden; }
  .edit-img, .edit-video { width: 100%; height: 100%; object-fit: cover; }
  .edit-topbar { position: absolute; top: 0; left: 0; right: 0; z-index: 10; display: flex; align-items: center; padding: 8px 12px; padding-top: env(safe-area-inset-top, 8px); }
  .edit-close-btn { background: rgba(0,0,0,0.4); border: none; color: #fff; width: 36px; height: 36px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; }
  .edit-toolbar { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); z-index: 10; display: flex; flex-direction: column; gap: 6px; }
  .tool-btn { background: rgba(0,0,0,0.5); border: none; color: #fff; width: 48px; height: 48px; border-radius: 50%; cursor: pointer; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; }
  .tool-btn:active { transform: scale(0.9); }
  .tool-label { font-size: 9px; line-height: 1; }
  .edit-bottom { position: absolute; bottom: 0; left: 0; right: 0; z-index: 10; display: flex; align-items: center; justify-content: space-between; padding: 12px 16px calc(32px + env(safe-area-inset-bottom, 0px)); background: linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 100%); }
  .retake-text-btn { background: none; border: none; color: rgba(255,255,255,0.7); cursor: pointer; display: flex; align-items: center; gap: 6px; font-size: 14px; padding: 8px; font-family: inherit; }
  .story-btn { background: none; border: none; color: var(--accent); cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 2px; font-size: 11px; font-family: inherit; padding: 4px; }
  .next-btn { background: var(--accent); color: #000; border: none; padding: 10px 20px; border-radius: 24px; font-size: 15px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 4px; font-family: inherit; }
  .next-btn:active { opacity: 0.8; }
</style>
