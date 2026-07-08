<script lang="ts">
  import Icon from '$lib/icon/Icon.svelte';
  import type { IconName } from '$lib/icon/icons';

  let {
    name,
    size = 20,
    onclick,
    label,
    badge,
    style: extraStyle = ''
  }: {
    name: IconName;
    size?: number;
    onclick?: () => void;
    label?: string;
    badge?: number;
    style?: string;
  } = $props();
</script>

<button class="icon-btn" role="button" tabindex="0" {onclick} onkeydown={(e) => e.key === 'Enter' && onclick?.()} aria-label={label || name}>
  <Icon {name} {size} style={extraStyle} />
  {#if badge && badge > 0}
    <span class="badge">{badge}</span>
  {/if}
</button>

<style>
  .icon-btn {
    background: none; border: none; color: var(--text-2);
    cursor: pointer; padding: 6px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    transition: background 0.2s; position: relative;
  }
  .icon-btn:hover { background: var(--border); }
  .badge {
    position: absolute; top: -2px; right: -2px;
    min-width: 16px; height: 16px; border-radius: 8px;
    background: #ef4444; color: #fff; font-size: 9px; font-weight: 700;
    display: flex; align-items: center; justify-content: center; padding: 0 4px;
  }
</style>
