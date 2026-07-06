<script lang="ts">
  import { toast, showToast } from '$lib/stores';
  import { onMount } from 'svelte';

  let msg = $state('');
  let visible = $state(false);

  let unsub: (() => void) | null = null;

  onMount(() => {
    unsub = toast.subscribe((t) => {
      if (t) {
        msg = t.message;
        visible = true;
        setTimeout(() => { visible = false; }, 2000);
      }
    });
    return () => unsub?.();
  });
</script>

{#if visible}
  <div class="toast">
    <span>{msg}</span>
  </div>
{/if}

<style>
  .toast {
    position: fixed; bottom: 100px; left: 50%; transform: translateX(-50%);
    background: var(--bg-2); color: var(--text); padding: 12px 24px;
    border-radius: 10px; font-size: 14px; font-weight: 500;
    box-shadow: 0 4px 20px var(--shadow);
    z-index: 9999; white-space: nowrap;
    animation: toastIn 0.25s ease-out;
    border: 1px solid var(--border);
    pointer-events: none;
  }
  @keyframes toastIn {
    from { opacity: 0; transform: translateX(-50%) translateY(16px); }
    to { opacity: 1; transform: translateX(-50%) translateY(0); }
  }
</style>
