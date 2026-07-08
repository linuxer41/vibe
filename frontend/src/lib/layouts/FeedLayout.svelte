<script lang="ts">
  import { goto } from '$app/navigation';
  import BottomNav from './BottomNav.svelte';
  import Icon from '$lib/icon/Icon.svelte';

  let { children }: {
    children: import('svelte').Snippet;
  } = $props();
</script>

<div class="app">
  <div class="page-content">
    {@render children()}
  </div>
  <button class="fab" onclick={() => goto('/camera')}>
    <Icon name="camera" strokeWidth={2.5} />
  </button>
  <BottomNav />
</div>

<style>
  .app {
    height: 100%; display: flex; flex-direction: column;
    max-width: 430px; margin: 0 auto;
    position: relative; overflow: hidden;
    background: var(--bg-2);
    box-shadow: 0 0 40px rgba(0,0,0,0.5);
  }
  @media (min-width: 431px) {
    .app { border-left: 1px solid var(--border); border-right: 1px solid var(--border); }
  }
  .page-content { flex: 1; overflow-y: auto; display: flex; flex-direction: column; background: var(--bg); }
  .fab {
    position: fixed; bottom: calc(80px + var(--safe-area-bottom)); right: calc(50% - 215px + 16px);
    width: 56px; height: 56px; border-radius: 50%;
    background: rgba(255,255,255,0.15); backdrop-filter: blur(12px);
    border: 1.5px solid rgba(255,255,255,0.25); cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 4px 20px rgba(0,0,0,0.2); z-index: 10;
    transition: transform 0.2s, background 0.2s; color: #fff;
  }
  .fab:hover { transform: scale(1.05); background: rgba(255,255,255,0.25); }
  @media (max-width: 430px) { .fab { right: 16px; } }
</style>
