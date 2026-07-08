<script lang="ts">
  import { goto } from '$app/navigation';
  import Icon from '$lib/icon/Icon.svelte';
  import SettingSection from '$lib/components/SettingSection.svelte';
  import SettingRow from '$lib/components/SettingRow.svelte';
</script>

<div class="section-title">Contenido</div>
<SettingSection>
  <SettingRow label="Canales" chevron onclick={() => goto('/channels')}>
    {#snippet icon()}
      <Icon name="cast" size={20} style="color: #8b5cf6" />
    {/snippet}
  </SettingRow>
  <SettingRow label="Watch Together" chevron onclick={() => goto('/watch')}>
    {#snippet icon()}
      <Icon name="play" size={20} style="color: #ef4444" />
    {/snippet}
  </SettingRow>
  <SettingRow label="Notas Compartidas" chevron onclick={() => goto('/notes')}>
    {#snippet icon()}
      <Icon name="edit" size={20} style="color: #3b82f6" />
    {/snippet}
  </SettingRow>
  <SettingRow label="Tareas" chevron onclick={() => goto('/tasks')}>
    {#snippet icon()}
      <Icon name="check" size={20} style="color: var(--accent)" />
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
