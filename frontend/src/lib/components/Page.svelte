<script lang="ts">
  let { children }: {
    children?: import('svelte').Snippet;
  } = $props();
</script>

<div class="page">
  {#if children}
    {@render children()}
  {/if}
</div>

<style>
  .page {
    height: 100dvh; display: flex; flex-direction: column;
    background: var(--bg);
  }
</style>
