<script lang="ts">
  let { show, onclose, title, children }: {
    show: boolean;
    onclose: () => void;
    title?: string;
    children?: import('svelte').Snippet;
  } = $props();
</script>

{#if show}
  <div class="modal-overlay" onclick={(e) => { if ((e.target as HTMLElement).classList.contains('modal-overlay')) onclose(); }}>
    <div class="modal-content" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        {#if title}
          <h3 class="modal-title">{title}</h3>
        {/if}
        <button class="modal-close" onclick={onclose}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </div>
      <div class="modal-body">
        {#if children}
          {@render children()}
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-overlay {
    position: fixed; inset: 0; background: rgba(0,0,0,0.7);
    display: flex; align-items: center; justify-content: center;
    z-index: 200; animation: fadeIn 0.2s ease-out; padding: 24px;
  }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  .modal-content {
    background: var(--bg-2); border-radius: 16px;
    width: 100%; max-width: 400px; max-height: 80dvh;
    display: flex; flex-direction: column;
    box-shadow: 0 8px 40px var(--shadow);
    animation: scaleIn 0.2s ease-out;
  }
  @keyframes scaleIn { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
  .modal-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 16px 20px; border-bottom: 1px solid var(--border);
    min-height: 52px;
  }
  .modal-title {
    font-size: 17px; font-weight: 600; color: var(--text);
  }
  .modal-close {
    background: none; border: none; color: var(--text-2);
    cursor: pointer; padding: 6px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    transition: background 0.2s;
  }
  .modal-close:hover { background: var(--border); }
  .modal-body {
    flex: 1; overflow-y: auto; padding: 16px 20px 20px;
  }
</style>
