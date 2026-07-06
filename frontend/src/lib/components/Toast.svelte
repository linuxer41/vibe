<script lang="ts">
  import { toasts, dismissToast, type ToastItem, type ToastType } from '$lib/stores';

  let items: ToastItem[] = $state([]);
  let unsub = toasts.subscribe((t) => items = t);
</script>

<div class="toast-container">
  {#each items as item (item.id)}
    <div class="toast" class:toast-success={item.type === 'success'} class:toast-error={item.type === 'error'} class:toast-info={item.type === 'info'}>
      <div class="toast-icon">
        {#if item.type === 'success'}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M20 6L9 17l-5-5"/></svg>
        {:else if item.type === 'error'}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/></svg>
        {:else}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
        {/if}
      </div>
      <span class="toast-msg">{item.message}</span>
      <button class="toast-dismiss" onclick={() => dismissToast(item.id)}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
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
    border: 1px solid rgba(255,255,255,0.08);
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
