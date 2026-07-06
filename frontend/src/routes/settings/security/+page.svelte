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
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        {/snippet}
      </SettingRow>
    </SettingSection>
    <SettingSection label="Seguridad de la cuenta">
      <SettingRow label="Bloqueo con PIN" desc={ps.enabled ? 'Activado' : 'Protege la app con un PIN'} chevron onclick={() => goto('/settings/passcode')}>
        {#snippet icon()}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" stroke-width="2" stroke-linecap="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
        {/snippet}
      </SettingRow>
      <SettingRow label="Verificación en dos pasos" desc={ts.enabled ? 'Activada' : 'Desactivada'} chevron onclick={() => goto('/settings/two-step')}>
        {#snippet icon()}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" stroke-width="2" stroke-linecap="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
        {/snippet}
      </SettingRow>
      <SettingRow label="Dispositivos" desc="Gestiona sesiones activas" chevron onclick={() => goto('/settings/sessions')}>
        {#snippet icon()}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" stroke-width="2" stroke-linecap="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><path d="M8 21h8"/><path d="M12 17v4"/></svg>
        {/snippet}
      </SettingRow>
      <SettingRow label="Aviso de seguridad" desc="Mostrar aviso cuando cambie el código de seguridad">
        {#snippet icon()}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" stroke-width="2" stroke-linecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        {/snippet}
        <Toggle checked />
      </SettingRow>
    </SettingSection>
    <SettingSection label="Privacidad">
      <SettingRow label="Contactos bloqueados" desc={`${$blockedUsers.length} contactos`} chevron onclick={() => goto('/settings/blocked')}>
        {#snippet icon()}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M4.93 4.93l14.14 14.14"/></svg>
        {/snippet}
      </SettingRow>
      <SettingRow label="Eliminación automática de cuenta" desc="Desactivada" chevron onclick={() => goto('/settings/auto-delete')}>
        {#snippet icon()}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" stroke-width="2" stroke-linecap="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4h8v2"/></svg>
        {/snippet}
      </SettingRow>
    </SettingSection>
  </div>
</Page>

<style>
  .content { flex: 1; overflow-y: auto; }
</style>
