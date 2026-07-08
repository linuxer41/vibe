<script lang="ts">
  import Header from '$lib/components/Header.svelte';
  import type { IconName } from '$lib/icon/icons';
  import BottomNav from './BottomNav.svelte';

  let {
    children,
    title = '',
    showBack = false,
    onBack,
    header,
    rightContent,
  }: {
    children: import('svelte').Snippet;
    title?: string;
    showBack?: boolean;
    onBack?: () => void;
    header?: import('svelte').Snippet;
    rightContent?: import('svelte').Snippet;
  } = $props();
</script>

<div class="app">
  {#if header}
    {@render header()}
  {:else}
    <Header {title} onback={showBack ? onBack : undefined}>
      {#if rightContent}
        {@render rightContent()}
      {/if}
    </Header>
  {/if}
  <div class="page-content">
    {@render children()}
  </div>
  <BottomNav />
</div>

<style>
  .app {
    height: 100%; display: flex; flex-direction: column;
    max-width: 430px; margin: 0 auto;
    position: relative; overflow: hidden;
    background: var(--bg-2);
    box-shadow: 0 0 40px rgba(0,0,0,0.5);
    padding-top: var(--safe-area-top);
  }
  @media (min-width: 431px) {
    .app { border-left: 1px solid var(--border); border-right: 1px solid var(--border); }
  }
  .page-content { flex: 1; overflow-y: auto; display: flex; flex-direction: column; background: var(--bg); }
  .icon-btn {
    background: none; border: none; color: var(--text-2);
    cursor: pointer; padding: 6px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    transition: background 0.2s; position: relative;
  }
  .icon-btn:hover { background: var(--border); }
  .header-avatar { width: 32px; height: 32px; border-radius: 50%; object-fit: cover; cursor: pointer; }
  .header-badge {
    position: absolute; top: -2px; right: -2px;
    min-width: 16px; height: 16px; border-radius: 8px;
    background: #ef4444; color: #fff; font-size: 9px; font-weight: 700;
    display: flex; align-items: center; justify-content: center; padding: 0 4px;
  }
  .fab {
    position: fixed; bottom: calc(80px + var(--safe-area-bottom)); right: calc(50% - 215px + 16px);
    display: flex; align-items: center; justify-content: center; gap: 8px;
    padding: 15px 24px; min-height: 52px;
    background: var(--accent); color: #000; border: none; border-radius: 12px;
    font-size: 16px; font-weight: 700; cursor: pointer;
    box-shadow: 0 4px 20px var(--shadow-accent); z-index: 10;
    transition: background 0.2s, transform 0.15s;
  }
  .fab:hover { background: var(--accent-hover); }
  .fab:active { transform: scale(0.98); }
  @media (max-width: 430px) { .fab { right: 16px; } }
</style>
