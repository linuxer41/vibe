<script lang="ts">
  import Icon from '$lib/icon/Icon.svelte';

  let { label, desc, onclick, chevron, children, icon }: {
    label: string;
    desc?: string;
    onclick?: () => void;
    chevron?: boolean;
    children?: import('svelte').Snippet;
    icon?: import('svelte').Snippet;
  } = $props();
</script>

<div class="row" role="button" tabindex={onclick ? 0 : -1} {onclick} onkeydown={(e) => e.key === 'Enter' && onclick?.()}>
  {#if icon}
    <div class="row-icon">
      {@render icon()}
    </div>
  {/if}
  <div class="row-info">
    <span class="row-label">{label}</span>
    {#if desc}
      <span class="row-desc">{desc}</span>
    {/if}
  </div>
  {#if children}
    <div class="row-right">
      {@render children()}
    </div>
  {:else if chevron}
    <Icon name="chevron-right" size={16} style="color: var(--text-3)" />
  {/if}
</div>

<style>
  .row {
    display: flex; align-items: center; gap: 14px;
    padding: 16px 18px;
    border-bottom: 1px solid var(--border-2);
    cursor: pointer; transition: background 0.15s;
  }
  .row:last-child { border-bottom: none; }
  .row:hover { background: rgba(255,255,255,0.03); }
  .row:active { background: rgba(255,255,255,0.06); }
  .row-icon {
    width: 22px; display: flex; justify-content: center; flex-shrink: 0;
  }
  .row-info { flex: 1; min-width: 0; }
  .row-label { display: block; font-size: 15px; color: var(--text); }
  .row-desc { display: block; font-size: 12px; color: var(--text-3); margin-top: 3px; line-height: 1.4; }
  .row-right { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
</style>
