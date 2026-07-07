<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import Page from '$lib/components/Page.svelte';
  import Header from '$lib/components/Header.svelte';
  import SettingSection from '$lib/components/SettingSection.svelte';
  import SettingRow from '$lib/components/SettingRow.svelte';
  import Toggle from '$lib/components/Toggle.svelte';
  import { socket, twoStepStatus, sessions, blockedUsers, passcodeSettings } from '$lib/stores';
  import Icon from '$lib/icon/Icon.svelte';

  let sk: any = $state(null);
  let ts: any = $state({ enabled: 0, hint: '' });
  let ps: any = $state({ enabled: false });

  socket.subscribe((v) => sk = v);
  twoStepStatus.subscribe((v) => ts = v);
  passcodeSettings.subscribe((v) => ps = v);

  onMount(() => {
    sk?.emit('get_two_step_status', (res: any) => twoStepStatus.set(res));
    sk?.emit('get_sessions', (res: any) => sessions.set(res));
    sk?.emit('get_blocked_users', (res: any) => blockedUsers.set(res));
  });
</script>

<Page>
  <Header title="Seguridad" onback={() => goto('/settings')} />
  <div class="content">
    <SettingSection label="Cifrado">
      <SettingRow label="Cifrado de extremo a extremo" desc="Tus chats están protegidos con cifrado de extremo a extremo.">
        {#snippet icon()}
          <Icon name="lock" size={22} style="color: var(--accent)" />
        {/snippet}
      </SettingRow>
    </SettingSection>
    <SettingSection label="Seguridad de la cuenta">
      <SettingRow label="Bloqueo con PIN" desc={ps.enabled ? 'Activado' : 'Protege la app con un PIN'} chevron onclick={() => goto('/settings/passcode')}>
        {#snippet icon()}
          <Icon name="lock" size={20} style="color: var(--text-3)" />
        {/snippet}
      </SettingRow>
      <SettingRow label="Verificación en dos pasos" desc={ts.enabled ? 'Activada' : 'Desactivada'} chevron onclick={() => goto('/settings/two-step')}>
        {#snippet icon()}
          <Icon name="lock" size={20} style="color: var(--text-3)" />
        {/snippet}
      </SettingRow>
      <SettingRow label="Dispositivos" desc="Gestiona sesiones activas" chevron onclick={() => goto('/settings/sessions')}>
        {#snippet icon()}
          <Icon name="cast" size={20} style="color: var(--text-3)" />
        {/snippet}
      </SettingRow>
      <SettingRow label="Aviso de seguridad" desc="Mostrar aviso cuando cambie el código de seguridad">
        {#snippet icon()}
          <Icon name="lock" size={20} style="color: var(--text-3)" />
        {/snippet}
        <Toggle checked />
      </SettingRow>
    </SettingSection>
    <SettingSection label="Privacidad">
      <SettingRow label="Contactos bloqueados" desc={`${$blockedUsers.length} contactos`} chevron onclick={() => goto('/settings/blocked')}>
        {#snippet icon()}
          <Icon name="x" size={20} style="color: var(--danger)" />
        {/snippet}
      </SettingRow>
      <SettingRow label="Eliminación automática de cuenta" desc="Desactivada" chevron onclick={() => goto('/settings/auto-delete')}>
        {#snippet icon()}
          <Icon name="trash" size={20} style="color: var(--text-3)" />
        {/snippet}
      </SettingRow>
    </SettingSection>
  </div>
</Page>

<style>
  .content { flex: 1; overflow-y: auto; }
</style>
