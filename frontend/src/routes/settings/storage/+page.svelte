<script lang="ts">
  import { goto } from '$app/navigation';
  import Page from '$lib/components/Page.svelte';
  import Header from '$lib/components/Header.svelte';
  import SettingSection from '$lib/components/SettingSection.svelte';
  import SettingRow from '$lib/components/SettingRow.svelte';
  import Toggle from '$lib/components/Toggle.svelte';
</script>

<Page>
  <Header title="Almacenamiento y datos" onback={() => goto('/settings')} />
  <div class="content">
    <SettingSection label="Almacenamiento">
      <SettingRow label="Almacenamiento interno" desc="0.0 GB usados de 128 GB">
        {#snippet icon()}
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>
        {/snippet}
      </SettingRow>
      <SettingRow label="Administrar almacenamiento" chevron />
    </SettingSection>
    <SettingSection label="Red">
      <SettingRow label="Descarga automática de archivos" desc="Datos móviles, Wi-Fi, Roaming" chevron />
      <SettingRow label="Carga de llamadas con datos móviles" desc="No usar datos móviles" chevron />
      <SettingRow label="Usar menos datos para llamadas">
        <Toggle />
      </SettingRow>
    </SettingSection>
  </div>
</Page>

<style>
  .content { flex: 1; overflow-y: auto; }
</style>
