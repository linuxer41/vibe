<script lang="ts">
  import { goto } from '$app/navigation';
  import Page from '$lib/components/Page.svelte';
  import Header from '$lib/components/Header.svelte';
  import SettingSection from '$lib/components/SettingSection.svelte';
  import SettingRow from '$lib/components/SettingRow.svelte';
  import Toggle from '$lib/components/Toggle.svelte';
</script>

<Page>
  <Header title="Notificaciones" onback={() => goto('/settings')} />
  <div class="content">
    <SettingSection label="Mensajes">
      <SettingRow label="Sonido de notificación">
        <span class="row-sub">Predeterminado</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" stroke-width="2" stroke-linecap="round"><path d="M9 18l6-6-6-6"/></svg>
      </SettingRow>
      <SettingRow label="Tono de llamada">
        <span class="row-sub">Predeterminado</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" stroke-width="2" stroke-linecap="round"><path d="M9 18l6-6-6-6"/></svg>
      </SettingRow>
      <SettingRow label="Sonido de notificación">
        <Toggle checked />
      </SettingRow>
      <SettingRow label="Vibrar">
        <Toggle checked />
      </SettingRow>
      <SettingRow label="Vista previa del mensaje">
        <Toggle checked />
      </SettingRow>
    </SettingSection>
    <SettingSection label="Grupos">
      <SettingRow label="Sonido de notificación">
        <span class="row-sub">Predeterminado</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" stroke-width="2" stroke-linecap="round"><path d="M9 18l6-6-6-6"/></svg>
      </SettingRow>
      <SettingRow label="Sonido para llamadas">
        <span class="row-sub">Predeterminado</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" stroke-width="2" stroke-linecap="round"><path d="M9 18l6-6-6-6"/></svg>
      </SettingRow>
    </SettingSection>
  </div>
</Page>

<style>
  .content { flex: 1; overflow-y: auto; }
  .row-sub { font-size: 14px; color: var(--text-3); }
</style>
