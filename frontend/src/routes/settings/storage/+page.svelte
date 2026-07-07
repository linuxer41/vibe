<script lang="ts">
  import { goto } from '$app/navigation';
  import Page from '$lib/components/Page.svelte';
  import Header from '$lib/components/Header.svelte';
  import SettingSection from '$lib/components/SettingSection.svelte';
  import SettingRow from '$lib/components/SettingRow.svelte';

  let storageUrl = $state(typeof localStorage !== 'undefined' ? localStorage.getItem('wa_storage_url') || '' : '');

  function saveStorageUrl() {
    const val = storageUrl.trim();
    if (val && !val.startsWith('http')) return;
    if (val) {
      localStorage.setItem('wa_storage_url', val);
    } else {
      localStorage.removeItem('wa_storage_url');
    }
    window.location.reload();
  }
</script>

<Page>
  <Header title="Almacenamiento y datos" onback={() => goto('/settings')} />
  <div class="content">
    <SettingSection label="Servidor de archivos">
      <SettingRow label="URL del storage server" desc="Ej: http://localhost:3002">
        {#snippet icon()}
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>
        {/snippet}
        {#snippet after()}
          <input
            type="text"
            bind:value={storageUrl}
            placeholder="http://localhost:3002"
            class="storage-input"
            onchange={saveStorageUrl}
          />
        {/snippet}
      </SettingRow>
    </SettingSection>
  </div>
</Page>

<style>
  .content { flex: 1; overflow-y: auto; }
  .storage-input {
    background: var(--input-bg, #1e1e1e);
    color: var(--text, #fff);
    border: 1px solid var(--border, #333);
    border-radius: 8px;
    padding: 8px 12px;
    width: 100%;
    font-size: 14px;
    outline: none;
    box-sizing: border-box;
    margin-top: 8px;
  }
  .storage-input:focus {
    border-color: var(--accent, #7c3aed);
  }
</style>
