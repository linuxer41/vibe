<script lang="ts">
  let { title, onback, children }: {
    title: string;
    onback?: () => void;
    children?: import('svelte').Snippet;
  } = $props();
</script>

<div class="header">
  {#if onback}
    <button class="back-btn" onclick={onback}>
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M15 18l-6-6 6-6"/></svg>
    </button>
  {/if}
  <span class="header-title">{title}</span>
  {#if children}
    <div class="header-right">
      {@render children()}
    </div>
  {/if}
</div>

<style>
  .header {
    display: flex; align-items: center; gap: 12px;
    padding: 12px 16px; background: var(--bg-2);
    flex-shrink: 0; border-bottom: 1px solid var(--border);
  }
  .header-title {
    font-size: 17px; font-weight: 600; color: var(--text); flex: 1;
  }
  .header-right {
    display: flex; align-items: center; gap: 8px;
  }
  .back-btn {
    background: none; border: none; color: var(--text);
    cursor: pointer; padding: 4px; display: flex;
    align-items: center; justify-content: center;
  }
</style>
