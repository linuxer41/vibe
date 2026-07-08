<script lang="ts">
  import Icon from '$lib/icon/Icon.svelte';
  import type { IconName } from '$lib/icon/icons';
  let { show, onclose, title, children }: {
    show: boolean;
    onclose: () => void;
    title: string;
    children?: import('svelte').Snippet;
  } = $props();
</script>

{#if show}
  <div class="overlay" onclick={(e) => { if ((e.target as HTMLElement).classList.contains('overlay')) onclose(); }}>
    <div class="sheet" onclick={(e) => e.stopPropagation()}>
      <div class="sheet-handle-wrap">
        <div class="sheet-handle"></div>
      </div>
      <div class="sheet-header">
        <h3 class="sheet-title">{title}</h3>
        <button class="sheet-close" onclick={onclose}>
          <Icon name="x" size={20} />
        </button>
      </div>
      <div class="sheet-body">
        {#if children}
          {@render children()}
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .overlay {
    position: fixed; inset: 0; background: rgba(0,0,0,0.7);
    display: flex; align-items: flex-end; justify-content: center;
    z-index: 100; animation: fadeIn 0.2s ease-out;
  }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  .sheet {
    background: var(--bg-2); border-radius: 16px 16px 0 0;
    padding: 0 20px 24px; width: 100%; max-width: 430px;
    height: 50%; display: flex; flex-direction: column;
    box-shadow: 0 -8px 32px var(--shadow);
    animation: slideUp 0.25s ease-out;
  }
  @keyframes slideUp { from { transform: translateY(40px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
  .sheet-handle-wrap {
    display: flex; justify-content: center; padding: 10px 0 4px;
    position: sticky; top: 0; background: var(--bg-2); z-index: 1;
  }
  .sheet-handle {
    width: 32px; height: 4px; border-radius: 2px;
    background: var(--text-3); opacity: 0.3;
  }
  .sheet-header {
    display: flex; align-items: center; justify-content: space-between;
    margin-bottom: 16px;
  }
  .sheet-title {
    font-size: 18px; font-weight: 600; color: var(--text);
  }
  .sheet-close {
    background: none; border: none; color: var(--text-2);
    cursor: pointer; padding: 6px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    transition: background 0.2s;
  }
  .sheet-close:hover { background: var(--border); }
  .sheet-body {
    flex: 1; overflow-y: auto; min-height: 0;
  }
</style>
