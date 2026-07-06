<script lang="ts">
  import { goto } from '$app/navigation';
  import { avatarUrl } from '$lib/helpers';
  import { user, socket, displayName, username, bio, authStep, theme, showToast } from '$lib/stores';
  import type { User } from '$lib/types';
  import Page from '$lib/components/Page.svelte';
  import Header from '$lib/components/Header.svelte';
  import SettingSection from '$lib/components/SettingSection.svelte';
  import SettingRow from '$lib/components/SettingRow.svelte';
  import Toggle from '$lib/components/Toggle.svelte';

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

  let currentBackend = $state(
    (typeof localStorage !== 'undefined' ? localStorage.getItem('wa_backend') : null) || 'node'
  );

  function switchBackend() {
    const next = currentBackend === 'rust' ? 'node' : 'rust';
    currentBackend = next;
    localStorage.setItem('wa_backend', next);
    sk?.disconnect();
    socket.set(null);
    location.reload();
  }
</script>

<Page>
  <Header title="Settings" onback={() => goto('/')}>
    <button class="logout-btn" onclick={doLogout} title="Cerrar sesión">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" stroke-width="2" stroke-linecap="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
    </button>
  </Header>
  <div class="content">
    <div class="profile-card-top">
      <img src={avatarUrl(usr?.id || 0)} alt="" class="profile-avatar-lg" />
      <h2>{usr?.display_name || ''}</h2>
      <div class="profile-username-wrap">
        <span class="profile-username">@{usr?.username || ''}</span>
        <button class="copy-btn" onclick={() => { navigator.clipboard.writeText('@' + (usr?.username || '')); showToast('Usuario copiado'); }} title="Copiar usuario">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
        </button>
      </div>
      <span class="profile-phone">{usr?.country_code ? `+${usr.country_code} ` : ''}{usr?.phone || ''}</span>
      <span class="profile-bio">{usr?.bio || 'Hey there! I am using WhatsApp'}</span>
    </div>
    <SettingSection>
      <div class="edit-row">
        <div class="section-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        </div>
        <div class="field-group">
          <span>Nombre</span>
          <input type="text" bind:value={dn} oninput={(e) => displayName.set((e.target as HTMLInputElement).value)} placeholder="Tu nombre" />
        </div>
      </div>
      <div class="edit-row">
        <div class="section-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
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
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" stroke-width="2" stroke-linecap="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        {/snippet}
      </SettingRow>
      <SettingRow label="Seguridad" chevron onclick={() => goto('/settings/security')}>
        {#snippet icon()}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" stroke-width="2" stroke-linecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        {/snippet}
      </SettingRow>
      <SettingRow label="Notificaciones" chevron onclick={() => goto('/settings/notifications')}>
        {#snippet icon()}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" stroke-width="2" stroke-linecap="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
        {/snippet}
      </SettingRow>
      <SettingRow label="Almacenamiento y datos" chevron onclick={() => goto('/settings/storage')}>
        {#snippet icon()}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" stroke-width="2" stroke-linecap="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>
        {/snippet}
      </SettingRow>
      <SettingRow label={`Tema (${$theme === 'dark' ? 'Oscuro' : 'Claro'})`}>
        {#snippet icon()}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
        {/snippet}
        <Toggle checked={$theme === 'light'} onchange={toggleTheme} />
      </SettingRow>
      <SettingRow label={`Backend: ${currentBackend === 'rust' ? 'Rust' : 'Node.js'}`} onclick={switchBackend}>
        {#snippet icon()}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/></svg>
        {/snippet}
      </SettingRow>
    </SettingSection>
    <SettingSection>
      <SettingRow label="Términos de servicio" chevron onclick={() => goto('/terms')}>
        {#snippet icon()}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" stroke-width="2" stroke-linecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
        {/snippet}
      </SettingRow>
      <SettingRow label="Política de privacidad" chevron onclick={() => goto('/privacy-policy')}>
        {#snippet icon()}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" stroke-width="2" stroke-linecap="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        {/snippet}
      </SettingRow>
    </SettingSection>
  </div>
</Page>

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
