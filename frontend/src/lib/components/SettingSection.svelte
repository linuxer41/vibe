<script lang="ts">
  import type { IconName } from '$lib/icon/icons';

  let { label, children }: {
    label?: string;
    children?: import('svelte').Snippet;
  } = $props();
</script>

<div class="section">
  {#if label}
    <div class="section-label">{label}</div>
  {/if}
  {#if children}
    {@render children()}
  {/if}
</div>

<style>
  .section {
    background: var(--bg-2); margin: 0 12px;
    border-radius: 14px; overflow: hidden;
  }
  .section + .section { margin-top: 16px; }
  .section-label {
    font-size: 13px; color: var(--text-2);
    padding: 12px 16px 8px; font-weight: 500;
  }
</style>
