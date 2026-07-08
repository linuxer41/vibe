<script lang="ts">
  import Icon from '$lib/icon/Icon.svelte';

  let {
    tabs,
    active,
    onTabChange
  }: {
    tabs: { key: string; label: string; icon?: string; count: number }[];
    active: string;
    onTabChange: (key: string) => void;
  } = $props();
</script>

<div class="sub-tabs">
  {#each tabs as tab}
    <button class="sub-tab" class:active={active === tab.key} onclick={() => onTabChange(tab.key)}>
      {#if tab.icon}
        <Icon name={tab.icon} size={14} />
      {/if}
      {tab.label}
      <span class="badge" class:active={active === tab.key}>{tab.count}</span>
    </button>
  {/each}
</div>

<style>
  .sub-tabs {
    display: flex; gap: 0; padding: 0; background: var(--bg-2);
    border-bottom: 1px solid var(--border); flex-shrink: 0;
  }
  .sub-tab {
    flex: 1; display: flex; align-items: center; justify-content: center;
    gap: 6px; padding: 14px 0; background: none; border: none;
    color: var(--text-2); font-size: 15px; font-weight: 600; cursor: pointer;
    border-bottom: 3px solid transparent; transition: all 0.2s;
  }
  .sub-tab.active { color: var(--accent); border-bottom-color: var(--accent); }
  .sub-tab .badge {
    font-size: 11px; padding: 2px 8px; border-radius: 10px;
    background: var(--bg-3); color: var(--text-2); font-weight: 700;
  }
  .sub-tab .badge.active { background: var(--accent); color: #000; }
</style>
