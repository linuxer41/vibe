<script lang="ts">
  import { emit } from '$lib/socket';
  import { goto } from '$app/navigation';
  import { formatDate } from '$lib/helpers';
  import {
    user, displayName, bio, vibeBalance, focusSession, notifications, showToast,
  } from '$lib/stores';
  import type { User, VibeBalance, FocusSession } from '$lib/types';
  import HeaderLayout from '$lib/layouts/HeaderLayout.svelte';
  import BottomSheet from '$lib/components/BottomSheet.svelte';
  import Icon from '$lib/icon/Icon.svelte';
  import ProfileHeader from './components/ProfileHeader.svelte';
  import ProfileActivity from './components/ProfileActivity.svelte';
  import ProfileFocus from './components/ProfileFocus.svelte';
  import ProfileContentLinks from './components/ProfileContentLinks.svelte';

  let usr: User | null = $state(null);
  let dn = $state('');
  let bi = $state('');
  let balance: VibeBalance = $state({ messaging_minutes: 0, feed_minutes: 0, live_minutes: 0, shop_minutes: 0, games_minutes: 0, calls_minutes: 0 });
  let focus: FocusSession | null = $state(null);
  let notifCount = $state(0);
  let showEdit = $state(false);
  let saving = $state(false);
  let focusMode = $state<'focus' | 'work' | 'sleep'>('focus');

  user.subscribe((v) => { usr = v; });
  displayName.subscribe((v) => dn = v);
  bio.subscribe((v) => bi = v);
  vibeBalance.subscribe((v) => balance = v);
  focusSession.subscribe((v) => focus = v);
  notifications.subscribe((v) => notifCount = v.filter(n => !n.read).length);

  const totalMinutes = $derived(balance.messaging_minutes + balance.feed_minutes + balance.live_minutes + balance.shop_minutes + balance.games_minutes + balance.calls_minutes);

  function openEdit() {
    dn = usr?.display_name || '';
    bi = usr?.bio || '';
    showEdit = true;
  }

  async function saveProfile() {
    if (!usr || saving) return;
    saving = true;
    const fields: any = {};
    if (dn !== usr.display_name) fields.display_name = dn;
    if (bi !== (usr.bio || '')) fields.bio = bi;
    if (Object.keys(fields).length === 0) { saving = false; showEdit = false; return; }
    try {
      await emit('update_profile', fields);
      user.set({ ...usr, ...fields });
      showToast('Perfil actualizado');
    } catch {}
    saving = false;
    showEdit = false;
  }

  async function startFocus() {
    try {
      const res = await emit('start_focus', { mode: focusMode });
      if (res?.ok) { focusSession.set(res.session); showToast(`Modo ${focusMode} activado`); }
    } catch {}
  }

  async function endFocus() {
    try {
      const res = await emit('end_focus');
      if (res?.ok) { focusSession.set(null); showToast('Sesión finalizada'); }
    } catch {}
  }
</script>

<HeaderLayout title="Perfil" showBack onBack={() => goto('/')}>
  {#snippet rightContent()}
    <button class="header-btn" onclick={() => goto('/settings')} title="Ajustes">
      <Icon name="settings" size={20} style="color: var(--text-3)" />
    </button>
  {/snippet}
  <div class="profile-page">
    <ProfileHeader {usr} onedit={openEdit} />

    <ProfileActivity {totalMinutes} {notifCount} onnotificationsclick={() => goto('/settings/notifications')} />

    <ProfileFocus {focus} {focusMode} onfocusmodechange={(m) => focusMode = m} onstartfocus={startFocus} onendfocus={endFocus} />

    <ProfileContentLinks />

    <div class="version">Vibe: Connect v0.1.0</div>
  </div>
</HeaderLayout>

<BottomSheet show={showEdit} title="Editar perfil" onclose={() => showEdit = false}>
  <div class="edit-sheet">
    <div class="edit-field">
      <label for="dn-input">Nombre</label>
      <input id="dn-input" type="text" bind:value={dn} placeholder="Tu nombre" class="edit-input" />
    </div>
    <div class="edit-field">
      <label for="bio-input">Bio</label>
      <textarea id="bio-input" bind:value={bi} placeholder="Cuéntanos sobre ti" class="edit-input edit-textarea" rows={2}></textarea>
    </div>
    <button class="save-btn" onclick={saveProfile} disabled={saving}>
      {saving ? 'Guardando...' : 'Guardar cambios'}
    </button>
  </div>
</BottomSheet>

<style>
  .profile-page { flex: 1; overflow-y: auto; padding: 0 0 32px; }

  .version {
    text-align: center; padding: 32px 20px 8px;
    font-size: 12px; color: var(--text-3);
  }

  .header-btn {
    background: none; border: none; cursor: pointer; padding: 6px;
    border-radius: 50%; display: flex; align-items: center;
    justify-content: center; transition: background 0.2s;
  }
  .header-btn:hover { background: var(--border); }

  /* Bottom sheet edit form */
  .edit-sheet { padding: 8px 0 16px; }
  .edit-field { margin-bottom: 14px; }
  .edit-field label {
    display: block; font-size: 12px; font-weight: 600;
    color: var(--text-3); margin-bottom: 6px;
    text-transform: uppercase; letter-spacing: 0.5px;
  }
  .edit-input {
    width: 100%; padding: 12px 14px;
    border: 2px solid var(--border);
    border-radius: 10px; font-size: 15px; outline: none;
    background: var(--bg-3); color: var(--text);
    box-sizing: border-box; transition: border-color 0.2s;
    font-family: inherit;
  }
  .edit-input:focus { border-color: var(--accent); }
  .edit-textarea { resize: none; }
  .save-btn {
    width: 100%; padding: 13px;
    background: var(--accent); color: #000; font-weight: 700;
    border: none; border-radius: 12px; font-size: 15px;
    cursor: pointer; transition: opacity 0.2s;
  }
  .save-btn:disabled { opacity: 0.4; cursor: default; }
</style>
