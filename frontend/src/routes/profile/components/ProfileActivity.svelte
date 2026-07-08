<script lang="ts">
  import Icon from '$lib/icon/Icon.svelte';
  import SettingSection from '$lib/components/SettingSection.svelte';
  import SettingRow from '$lib/components/SettingRow.svelte';

  let {
    totalMinutes,
    notifCount,
    onnotificationsclick
  }: {
    totalMinutes: number;
    notifCount: number;
    onnotificationsclick: () => void;
  } = $props();
</script>

<div class="section-title">Actividad</div>
<SettingSection>
  <SettingRow label="Vibe Balance" desc={totalMinutes > 0 ? `${totalMinutes} min hoy` : 'Sin actividad'}>
    {#snippet icon()}
      <Icon name="clock" size={20} style="color: var(--accent)" />
    {/snippet}
  </SettingRow>
  <SettingRow label="Notificaciones" desc={notifCount > 0 ? `${notifCount} sin leer` : 'Todas leídas'} onclick={onnotificationsclick}>
    {#snippet icon()}
      <Icon name="bell" size={20} style="color: var(--text-3)" />
    {/snippet}
  </SettingRow>
</SettingSection>

<style>
  .section-title {
    font-size: 13px; font-weight: 600; color: var(--text-3);
    text-transform: uppercase; letter-spacing: 0.8px;
    padding: 24px 20px 8px;
  }
</style>
