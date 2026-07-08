<script lang="ts">
  import { toasts, dismissToast, type ToastItem, type ToastType } from '$lib/stores';
  import Icon from '$lib/icon/Icon.svelte';

  let items: ToastItem[] = $state([]);
  let unsub = toasts.subscribe((t) => items = t);
</script>

<div class="toast-container">
  {#each items as item (item.id)}
    <div class="toast" class:toast-success={item.type === 'success'} class:toast-error={item.type === 'error'} class:toast-info={item.type === 'info'}>
      <div class="toast-icon">
        {#if item.type === 'success'}
          <Icon name="check" size={18} strokeWidth={2.5} />
        {:else if item.type === 'error'}
          <Icon name="x" size={18} strokeWidth={2.5} />
        {:else}
          <Icon name="info" size={18} strokeWidth={2.5} />
        {/if}
      </div>
      <span class="toast-msg">{item.message}</span>
      <button class="toast-dismiss" onclick={() => dismissToast(item.id)}>
        <Icon name="x" size={14} />
      </button>
    </div>
  {/each}
</div>

<style>
  .toast-container {
    position: fixed; top: 60px; right: 16px; z-index: 9999;
    display: flex; flex-direction: column; gap: 8px;
    pointer-events: none;
  }
  .toast {
    display: flex; align-items: center; gap: 10px;
    padding: 12px 14px 12px 16px; border-radius: 12px;
    font-size: 14px; font-weight: 500; min-width: 260px;
    max-width: 360px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.4);
    animation: slideIn 0.3s ease-out;
    border: 1px solid var(--border);
    backdrop-filter: blur(12px);
    pointer-events: auto;
  }
  .toast-success { background: #065f46; color: #d1fae5; }
  .toast-error { background: #7f1d1d; color: #fecaca; }
  .toast-info { background: #1e3a5f; color: #bfdbfe; }
  .toast-icon { display: flex; flex-shrink: 0; }
  .toast-msg { flex: 1; line-height: 1.4; }
  .toast-dismiss {
    background: none; border: none; color: inherit; opacity: 0.6;
    cursor: pointer; padding: 2px; display: flex; border-radius: 4px;
    transition: opacity 0.2s;
  }
  .toast-dismiss:hover { opacity: 1; }
  @keyframes slideIn {
    from { opacity: 0; transform: translateX(40px); }
    to { opacity: 1; transform: translateX(0); }
  }
</style>
