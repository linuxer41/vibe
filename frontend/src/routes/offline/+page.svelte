<script lang="ts">
  import { goto } from '$app/navigation';
  import MinimalLayout from '$lib/layouts/MinimalLayout.svelte';
  import BackendSelector from '$lib/components/BackendSelector.svelte';
  import StorageSelector from '$lib/components/StorageSelector.svelte';
  import Icon from '$lib/icon/Icon.svelte';

  let tab = $state<'backend' | 'storage'>('backend');

  function retry() {
    localStorage.removeItem('wa_token');
    goto('/init', { replaceState: true });
  }

  function onServerChanged() {
    // Reload to reconnect with new server
    location.reload();
  }
</script>

<MinimalLayout>
  <div class="offline">
    <div class="offline-top">
      <svg class="offline-blob" viewBox="0 0 200 160" fill="none">
        <path d="M100 10C140 10 180 40 185 80C190 120 160 150 120 155C80 160 40 140 20 110C0 80 10 40 40 20C70 0 60 10 100 10Z" fill="var(--bg-2)" opacity="0.6"/>
        <path d="M110 30C135 30 160 50 163 75C166 100 148 120 125 123C102 126 75 115 62 95C49 75 55 48 75 35C95 22 85 30 110 30Z" fill="var(--bg-3)" opacity="0.4"/>
      </svg>
      <div class="offline-icon">
        <Icon name="wifi-off" size={36} strokeWidth={1.5} style="color: var(--text-3)" />
      </div>
      <h2>Sin conexión</h2>
      <p>No se pudo conectar al servidor. Verifica o cambia el servidor.</p>
    </div>

    <div class="offline-tabs">
      <button class="tab" class:active={tab === 'backend'} onclick={() => tab = 'backend'}>
        <Icon name="settings" size={16} />
        Backend
      </button>
      <button class="tab" class:active={tab === 'storage'} onclick={() => tab = 'storage'}>
        <Icon name="database" size={16} />
        Storage
      </button>
    </div>

    <div class="offline-selector">
      {#if tab === 'backend'}
        <BackendSelector onchange={onServerChanged} />
      {:else}
        <StorageSelector onchange={onServerChanged} />
      {/if}
    </div>

    <button class="retry-btn" onclick={retry}>
      <Icon name="refresh-cw" size={18} strokeWidth={2.5} />
      Reintentar
    </button>
  </div>
</MinimalLayout>

<style>
  .offline {
    height: 100%; display: flex; flex-direction: column;
    padding: 24px 16px; padding-top: env(safe-area-inset-top, 24px);
    padding-bottom: env(safe-area-inset-bottom, 16px);
    background: var(--bg);
  }
  .offline-top {
    display: flex; flex-direction: column; align-items: center;
    gap: 10px; padding: 32px 0 20px; position: relative;
  }
  .offline-blob {
    position: absolute; width: 180px; height: auto; opacity: 0.35;
    pointer-events: none; top: 10px;
  }
  .offline-icon { position: relative; z-index: 1; }
  .offline-top h2 {
    font-size: 20px; font-weight: 700; color: var(--text); margin: 0;
  }
  .offline-top p {
    font-size: 14px; color: var(--text-2); text-align: center;
    line-height: 1.5; margin: 0; max-width: 280px;
  }
  .offline-tabs {
    display: flex; gap: 0; margin-bottom: 16px;
    background: var(--bg-3); border-radius: 12px; padding: 3px;
  }
  .tab {
    flex: 1; display: flex; align-items: center; justify-content: center;
    gap: 6px; padding: 10px; border: none; border-radius: 10px;
    background: transparent; color: var(--text-3); font-size: 14px;
    font-weight: 600; cursor: pointer; transition: all 0.2s;
  }
  .tab.active { background: var(--bg); color: var(--text); }
  .offline-selector {
    flex: 1; overflow-y: auto; padding: 4px 0;
  }
  .retry-btn {
    display: flex; align-items: center; justify-content: center; gap: 8px;
    padding: 14px; background: var(--accent); color: #000;
    border: none; border-radius: 12px; font-size: 16px; font-weight: 700;
    cursor: pointer; margin-top: 12px; width: 100%;
    transition: background 0.2s;
  }
  .retry-btn:hover { background: var(--accent-hover); }
</style>
