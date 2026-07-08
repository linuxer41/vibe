<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import DefaultLayout from '$lib/layouts/DefaultLayout.svelte';
  import Icon from '$lib/icon/Icon.svelte';
  import type { IconName } from '$lib/icon/icons';

  let { children } = $props();

  let tabs: { path: string; label: string; icon: IconName }[] = [
    { path: '/fun', label: 'Games', icon: 'gamepad' },
    { path: '/fun/memes', label: 'Memes', icon: 'edit' },
    { path: '/fun/stickers', label: 'Stickers', icon: 'emoji' },
  ];

  let activePath = $derived($page.url.pathname);
</script>

<DefaultLayout title="Fun">
  <div class="div-tabs">
    {#each tabs as t}
      <button class="div-tab" class:active={activePath === t.path} onclick={() => goto(t.path)}>
        <Icon name={t.icon} size={16} />
        {t.label}
      </button>
    {/each}
  </div>
  <div class="div-content">
    {@render children()}
  </div>
</DefaultLayout>

<style>
  .div-tabs { display: flex; gap: 2px; padding: 8px 12px; background: var(--bg-2); border-bottom: 1px solid var(--border); flex-shrink: 0; }
  .div-tab { flex: 1; display: flex; align-items: center; justify-content: center; gap: 4px; padding: 10px 8px; background: none; border: none; color: var(--text-3); font-size: 12px; font-weight: 600; cursor: pointer; border-radius: 8px; transition: all 0.2s; }
  .div-tab.active { background: var(--accent); color: #000; font-weight: 700; }
  .div-content { flex: 1; overflow-y: auto; padding-bottom: 80px; }
</style>
