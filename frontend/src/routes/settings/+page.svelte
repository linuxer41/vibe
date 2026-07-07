<script lang="ts">
  import { goto } from '$app/navigation';
  import { avatarUrl } from '$lib/helpers';
  import { copyToClipboard } from '$lib/platform';
  import { user, socket, displayName, username, bio, authStep, theme, showToast } from '$lib/stores';
  import type { User } from '$lib/types';
  import Page from '$lib/components/Page.svelte';
  import Header from '$lib/components/Header.svelte';
  import SettingSection from '$lib/components/SettingSection.svelte';
  import SettingRow from '$lib/components/SettingRow.svelte';
  import Toggle from '$lib/components/Toggle.svelte';
  import BottomSheet from '$lib/components/BottomSheet.svelte';
  import BackendSelector from '$lib/components/BackendSelector.svelte';
  import StorageSelector from '$lib/components/StorageSelector.svelte';
  import Icon from '$lib/icon/Icon.svelte';

  let usr: User | null = $state(null);
  let sk: any = $state(null);
  let dn = $state('');
  let un = $state('');
  let bi = $state('');

  user.subscribe((v) => { usr = v; });
  socket.subscribe((v) => sk = v);
  displayName.subscribe((v) => dn = v);
  username.subscribe((v) => un = v);
  bio.subscribe((v) => bi = v);

  function saveProfile() {
    if (!usr) return;
    const fields: any = {};
    if (dn !== usr.display_name) fields.display_name = dn;
    if (bi !== (usr.bio || '')) fields.bio = bi;
    if (Object.keys(fields).length === 0) return;
    sk?.emit('update_profile', fields, () => {
      user.set({ ...usr, ...fields });
    });
  }

  function doLogout() {
    localStorage.removeItem('wa_token');
    sk?.disconnect();
    socket.set(null);
    user.set(null);
    authStep.set('phone');
  }

  function toggleTheme() {
    const next = $theme === 'dark' ? 'light' : 'dark';
    theme.set(next);
    localStorage.setItem('wa_theme', next);
  }

  let showBackendSelector = $state(false);
  let showStorageSelector = $state(false);

  let backendLabel = $derived.by(() => {
    if (typeof localStorage === 'undefined') return 'Node.js';
    const label = localStorage.getItem('wa_backend_label');
    if (label) return label;
    const ls = localStorage.getItem('wa_backend');
    if (ls === 'rust') return 'Rust';
    return 'Node.js';
  });

  let storageLabel = $derived.by(() => {
    if (typeof localStorage === 'undefined') return 'Local';
    const label = localStorage.getItem('wa_storage_label');
    if (label) return label;
    return 'Local';
  });

  function onBackendChange() {
    sk?.disconnect();
    socket.set(null);
    location.reload();
  }

  function onStorageChange() {
    location.reload();
  }
</script>

<Page>
  <Header title="Settings" onback={() => goto('/')}>
    <button class="logout-btn" onclick={doLogout} title="Cerrar sesión">
      <Icon name="arrow-right" size={20} style="color: var(--danger)" />
    </button>
  </Header>
  <div class="content">
    <div class="profile-card-top">
      <img src={avatarUrl(usr?.id || 0)} alt="" class="profile-avatar-lg" />
      <h2>{usr?.display_name || ''}</h2>
      <div class="profile-username-wrap">
        <span class="profile-username">@{usr?.username || ''}</span>
        <button class="copy-btn" onclick={() => { copyToClipboard('@' + (usr?.username || '')); showToast('Usuario copiado'); }} title="Copiar usuario">
          <Icon name="document" size={14} />
        </button>
      </div>
      <span class="profile-phone">{usr?.country_code ? `+${usr.country_code} ` : ''}{usr?.phone || ''}</span>
      <span class="profile-bio">{usr?.bio || 'Hey there! I am using WhatsApp'}</span>
    </div>
    <SettingSection>
      <div class="edit-row">
        <div class="section-icon">
          <Icon name="user" size={20} style="color: var(--accent)" />
        </div>
        <div class="field-group">
          <span>Nombre</span>
          <input type="text" bind:value={dn} oninput={(e) => displayName.set((e.target as HTMLInputElement).value)} placeholder="Tu nombre" />
        </div>
      </div>
      <div class="edit-row">
        <div class="section-icon">
          <Icon name="edit" size={20} style="color: var(--accent)" />
        </div>
        <div class="field-group">
          <span>Bio</span>
          <textarea bind:value={bi} oninput={(e) => bio.set((e.target as HTMLTextAreaElement).value)} rows={2} placeholder="¿Qué te gusta hacer?"></textarea>
        </div>
      </div>
    </SettingSection>
    <button class="save-btn" onclick={saveProfile}>Guardar</button>
    <SettingSection>
      <SettingRow label="Privacidad" chevron onclick={() => goto('/settings/privacy')}>
        {#snippet icon()}
          <Icon name="lock" size={20} style="color: var(--text-3)" />
        {/snippet}
      </SettingRow>
      <SettingRow label="Seguridad" chevron onclick={() => goto('/settings/security')}>
        {#snippet icon()}
          <Icon name="lock" size={20} style="color: var(--text-3)" />
        {/snippet}
      </SettingRow>
      <SettingRow label="Notificaciones" chevron onclick={() => goto('/settings/notifications')}>
        {#snippet icon()}
          <Icon name="bell" size={20} style="color: var(--text-3)" />
        {/snippet}
      </SettingRow>
      <SettingRow label="Almacenamiento y datos" chevron onclick={() => goto('/settings/storage')}>
        {#snippet icon()}
          <Icon name="grid" size={20} style="color: var(--text-3)" />
        {/snippet}
      </SettingRow>
      <SettingRow label={`Tema (${$theme === 'dark' ? 'Oscuro' : 'Claro'})`}>
        {#snippet icon()}
          <Icon name="sun" size={20} style="color: var(--accent)" />
        {/snippet}
        <Toggle checked={$theme === 'light'} onchange={toggleTheme} />
      </SettingRow>
      <SettingRow label={`Backend: ${backendLabel}`} chevron onclick={() => showBackendSelector = true}>
        {#snippet icon()}
          <Icon name="refresh" size={20} style="color: var(--accent)" />
        {/snippet}
      </SettingRow>
      <SettingRow label={`Storage: ${storageLabel}`} chevron onclick={() => showStorageSelector = true}>
        {#snippet icon()}
          <Icon name="grid" size={20} style="color: var(--accent)" />
        {/snippet}
      </SettingRow>
    </SettingSection>
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
  </div>
</Page>

<BottomSheet show={showBackendSelector} title="Seleccionar Backend" onclose={() => showBackendSelector = false}>
  <BackendSelector onchange={onBackendChange} onclose={() => showBackendSelector = false} />
</BottomSheet>

<BottomSheet show={showStorageSelector} title="Servidor de Archivos" onclose={() => showStorageSelector = false}>
  <StorageSelector onchange={onStorageChange} onclose={() => showStorageSelector = false} />
</BottomSheet>

<style>
  .content { flex: 1; overflow-y: auto; }
  .logout-btn {
    background: none; border: none; cursor: pointer; padding: 6px;
    border-radius: 50%; display: flex; align-items: center;
    justify-content: center; transition: background 0.2s;
  }
  .logout-btn:hover { background: var(--border); }
  .profile-card-top {
    text-align: center; padding: 28px 20px 20px;
    border-bottom: 1px solid var(--border);
  }
  .profile-avatar-lg {
    width: 120px; height: 120px; border-radius: 50%;
    object-fit: cover; margin: 0 auto 16px;
    box-shadow: 0 4px 16px var(--shadow);
  }
  .profile-card-top h2 { font-size: 20px; font-weight: 700; color: var(--text); }
  .profile-username-wrap { display: flex; align-items: center; justify-content: center; gap: 6px; margin-top: 2px; }
  .profile-username { font-size: 13px; color: var(--text-3); }
  .copy-btn {
    background: none; border: none; color: var(--text-3); cursor: pointer;
    padding: 2px; display: flex; align-items: center; justify-content: center;
    transition: color 0.2s;
  }
  .copy-btn:hover { color: var(--accent); }
  .profile-phone { font-size: 13px; color: var(--text-2); display: block; margin-top: 4px; }
  .profile-bio { font-size: 14px; color: var(--text-2); display: block; margin-top: 2px; }
  .edit-row {
    display: flex; align-items: center; gap: 14px;
    padding: 14px 16px; border-bottom: 1px solid var(--border-2);
  }
  .section-icon {
    width: 20px; display: flex; justify-content: center; flex-shrink: 0;
  }
  .field-group { flex: 1; min-width: 0; }
  .field-group span {
    display: block; font-size: 12px; color: var(--text-2); margin-bottom: 4px;
  }
  .field-group input, .field-group textarea {
    width: 100%; padding: 10px 12px; border: none; border-radius: 8px;
    font-size: 15px; outline: none; background: var(--bg-3);
    color: var(--text); font-family: inherit; resize: vertical;
  }
  .field-group input:focus, .field-group textarea:focus { background: #333; }
  .save-btn {
    width: calc(100% - 32px); margin: 16px; padding: 13px;
    background: var(--accent); color: #000; font-weight: 700;
    border: none; border-radius: 12px; font-size: 15px; cursor: pointer;
  }
  .save-btn:hover { background: var(--accent-hover); }
</style>
