<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import Icon from '$lib/icon/Icon.svelte';

  let currentRoute = $derived.by(() => {
    const path = $page.url.pathname;
    if (path === '/calls') return 'calls';
    if (path === '/feed') return 'feed';
    if (path === '/for-you') return 'fyp';
    if (path === '/live') return 'live';
    if (path === '/store' || path.startsWith('/store/')) return 'store';
    if (path === '/fun' || path.startsWith('/fun/')) return 'fun';
    if (path === '/watch') return 'watch';
    return 'chats';
  });

  function navTo(path: string) {
    goto(path, { noScroll: true });
  }
</script>

<div class="bottom-nav">
  <button class="nav-item" class:active={currentRoute === 'chats'} onclick={() => navTo('/')}>
    <Icon name="message" size={22} />
    <span>Chats</span>
  </button>
  <button class="nav-item" class:active={currentRoute === 'feed'} onclick={() => navTo('/feed')}>
    <Icon name="grid" size={22} />
    <span>Feed</span>
  </button>
  <button class="nav-item" class:active={currentRoute === 'store'} onclick={() => navTo('/store')}>
    <Icon name="shop" size={22} />
    <span>Tienda</span>
  </button>
  <button class="nav-item" class:active={currentRoute === 'fun'} onclick={() => navTo('/fun')}>
    <Icon name="gamepad" size={22} />
    <span>Diversión</span>
  </button>
</div>

<style>
  .bottom-nav {
    display: flex; background: var(--bg-2);
    border-top: 1px solid var(--border);
    padding: 6px 0; padding-bottom: calc(6px + var(--safe-area-bottom));
    flex-shrink: 0; position: relative;
  }
  .nav-item {
    flex: 1; display: flex; flex-direction: column;
    align-items: center; gap: 2px; padding: 4px 0;
    background: none; border: none; color: var(--text-3);
    cursor: pointer; transition: color 0.2s; position: relative;
    font-size: 10px;
  }
  .nav-item.active { color: var(--accent); }
  .nav-item span { font-size: 10px; font-weight: 500; }
</style>
