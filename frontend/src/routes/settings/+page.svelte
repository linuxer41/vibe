<script lang="ts">
  import { goto } from '$app/navigation';
  import { user, socket, authStep, token, theme, showToast } from '$lib/stores';
  import HeaderLayout from '$lib/layouts/HeaderLayout.svelte';
  import SettingSection from '$lib/components/SettingSection.svelte';
  import SettingRow from '$lib/components/SettingRow.svelte';
  import Toggle from '$lib/components/Toggle.svelte';
  import BottomSheet from '$lib/components/BottomSheet.svelte';
  import BackendSelector from '$lib/components/BackendSelector.svelte';
  import StorageSelector from '$lib/components/StorageSelector.svelte';
  import Icon from '$lib/icon/Icon.svelte';
  import type { IconName } from '$lib/icon/icons';

  let sk: any = $state(null);
  socket.subscribe((v) => sk = v);

  let showBackendSelector = $state(false);
  let showStorageSelector = $state(false);

  let backendLabel = $derived((() => { try { return JSON.parse(localStorage.getItem('wa_backend_config') || '{}').label || 'Auto' } catch { return 'Auto' } })());
  let storageLabel = $derived(localStorage.getItem('storage_label') || (localStorage.getItem('storage_url') ? localStorage.getItem('storage_url') : 'Local'));

  function doLogout() {
    sk?.disconnect();
    localStorage.removeItem('wa_token');
    token.set('');
    token.set(null as any);
    authStep.set('phone');
    goto('/init', { replaceState: true });
  }

  function toggleTheme() {
    theme.update((t) => t === 'dark' ? 'light' : 'dark');
  }

  function onBackendChange() {
    showBackendSelector = false;
    location.reload();
  }

  function onStorageChange() {
    location.reload();
  }
</script>

<HeaderLayout title="Ajustes" showBack onBack={() => goto('/')}>
  <div class="settings-page">
    <!-- Account Settings -->
    <div class="section-title">Ajustes de cuenta</div>
    <SettingSection>
      <SettingRow label="Privacidad" chevron onclick={() => goto('/settings/privacy')}>
        {#snippet icon()}
          <Icon name="lock" size={20} style="color: var(--text-3)" />
        {/snippet}
      </SettingRow>
      <SettingRow label="Seguridad" chevron onclick={() => goto('/settings/security')}>
        {#snippet icon()}
          <Icon name="shield" size={20} style="color: var(--text-3)" />
        {/snippet}
      </SettingRow>
      <SettingRow label="Notificaciones" chevron onclick={() => goto('/settings/notifications')}>
        {#snippet icon()}
          <Icon name="bell" size={20} style="color: var(--text-3)" />
        {/snippet}
      </SettingRow>
    </SettingSection>

    <!-- Preferences -->
    <div class="section-title">Preferencias</div>
    <SettingSection>
      <SettingRow label="Tema" desc={$theme === 'dark' ? 'Oscuro' : 'Claro'}>
        {#snippet icon()}
          <Icon name="sun" size={20} style="color: var(--accent)" />
        {/snippet}
        <Toggle checked={$theme === 'light'} onchange={toggleTheme} />
      </SettingRow>
      <SettingRow label="Backend" desc={backendLabel} chevron onclick={() => showBackendSelector = true}>
        {#snippet icon()}
          <Icon name="refresh" size={20} style="color: var(--accent)" />
        {/snippet}
      </SettingRow>
      <SettingRow label="Servidor de Archivos" desc={storageLabel} chevron onclick={() => showStorageSelector = true}>
        {#snippet icon()}
          <Icon name="grid" size={20} style="color: var(--accent)" />
        {/snippet}
      </SettingRow>
    </SettingSection>

    <!-- About -->
    <div class="section-title">Información</div>
    <SettingSection>
      <SettingRow label="Términos de servicio" chevron onclick={() => goto('/terms')}>
        {#snippet icon()}
          <Icon name="document" size={20} style="color: var(--text-3)" />
        {/snippet}
      </SettingRow>
      <SettingRow label="Política de privacidad" chevron onclick={() => goto('/privacy-policy')}>
        {#snippet icon()}
          <Icon name="lock" size={20} style="color: var(--text-3)" />
        {/snippet}
      </SettingRow>
    </SettingSection>

    <!-- Logout -->
    <div class="logout-wrap">
      <button class="logout-btn" onclick={doLogout}>
        <Icon name="arrow-right" size={18} />
        <span>Cerrar sesión</span>
      </button>
    </div>

    <div class="version">Vibe: Connect v0.1.0</div>
  </div>
</HeaderLayout>

<BottomSheet show={showBackendSelector} title="Seleccionar Backend" onclose={() => showBackendSelector = false}>
  <BackendSelector onchange={onBackendChange} onclose={() => showBackendSelector = false} />
</BottomSheet>

<BottomSheet show={showStorageSelector} title="Servidor de Archivos" onclose={() => showStorageSelector = false}>
  <StorageSelector onchange={onStorageChange} onclose={() => showStorageSelector = false} />
</BottomSheet>

<style>
  .settings-page { flex: 1; overflow-y: auto; padding: 0 0 32px; }

  .section-title {
    font-size: 13px; font-weight: 600; color: var(--text-3);
    text-transform: uppercase; letter-spacing: 0.8px;
    padding: 24px 20px 8px;
  }

  .logout-wrap { display: flex; justify-content: center; margin-top: 24px; }

  .logout-btn {
    display: flex; align-items: center; gap: 8px;
    background: none; border: none; color: var(--danger);
    font-size: 15px; font-weight: 600; cursor: pointer;
    padding: 12px 24px; border-radius: 12px;
    transition: background 0.15s;
  }
  .logout-btn:hover { background: rgba(239,68,68,0.1); }

  .version {
    text-align: center; padding: 32px 20px 8px;
    font-size: 12px; color: var(--text-3);
  }
</style>
