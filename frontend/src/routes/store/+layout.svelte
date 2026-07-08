<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import DefaultLayout from '$lib/layouts/DefaultLayout.svelte';
  import Icon from '$lib/icon/Icon.svelte';
  import type { IconName } from '$lib/icon/icons';

  let { children } = $props();

  let tabs: { path: string; label: string; icon: IconName }[] = [
    { path: '/store', label: 'Tienda', icon: 'shop' },
    { path: '/store/offers', label: 'Ofertas', icon: 'sun' },
    { path: '/store/orders', label: 'Pedidos', icon: 'document' },
    { path: '/store/sell', label: 'Vender', icon: 'plus' },
  ];

  let activePath = $derived($page.url.pathname);
</script>

<DefaultLayout title="Tienda">
  <div class="store-tabs">
    {#each tabs as t}
      <button class="store-tab" class:active={activePath === t.path} onclick={() => goto(t.path)}>
        <Icon name={t.icon} size={16} />
        {t.label}
      </button>
    {/each}
  </div>
  <div class="store-content">
    {@render children()}
  </div>
</DefaultLayout>

<style>
  .store-tabs { display: flex; gap: 2px; padding: 8px 12px; background: var(--bg-2); border-bottom: 1px solid var(--border); overflow-x: auto; flex-shrink: 0; }
  .store-tab { flex: 1; display: flex; align-items: center; justify-content: center; gap: 4px; padding: 10px 8px; background: none; border: none; color: var(--text-3); font-size: 12px; font-weight: 600; cursor: pointer; border-radius: 8px; transition: all 0.2s; white-space: nowrap; }
  .store-tab.active { background: var(--accent); color: #000; font-weight: 700; }
  .store-content { flex: 1; overflow-y: auto; padding-bottom: 80px; }
</style>
