<script lang="ts">
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { avatarUrl } from '$lib/helpers';
  import { socket, contacts } from '$lib/stores';
  import type { User } from '$lib/types';

  let sk: any = $state(null);
  let contact: User | null = $state(null);
  let loaded = $state(false);

  socket.subscribe((v) => sk = v);

  const contactId = $derived(Number($page.url.searchParams.get('id')));

  onMount(() => {
    loadContact();
  });

  $effect(() => {
    if (!loaded && $contacts.length > 0) {
      const found = $contacts.find((c: User) => c.id === contactId);
      if (found) contact = found;
    }
  });

  function loadContact() {
    const list = get(contacts);
    const found = list.find((c: User) => c.id === contactId);
    if (found) { contact = found; loaded = true; return; }
    sk?.emit('get_contacts', null, (list: User[]) => {
      const c = list.find((u: User) => u.id === contactId);
      if (c) contact = c;
      loaded = true;
    });
  }

  function startChat() {
    sk?.emit('get_or_create_private_chat', { contactId }, (res: any) => {
      goto(`/chat?id=${res.chatId}`, { noScroll: true });
    });
  }

  function logCall(type: string, status: string) {
    sk?.emit('log_call', { calleeId: contactId, type, status }, () => {});
  }
</script>

{#if contact}
  <div class="profile-view">
    <div class="profile-header">
      <button class="back-btn" onclick={() => goto('/contacts')}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M15 18l-6-6 6-6"/></svg>
      </button>
      <span>Contacto</span>
      <button class="icon-btn">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>
      </button>
    </div>
    <div class="profile-content">
      <div class="profile-card-top">
        <img src={avatarUrl(contact.id)} alt="" class="profile-avatar-lg" />
        <h2>{contact.display_name}</h2>
        <span class="profile-phone">{contact.phone}</span>
        <div class="profile-actions">
          <button class="action-btn" onclick={() => logCall('audio', 'outgoing')}>
            <div class="action-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
            </div>
            <span>Audio</span>
          </button>
          <button class="action-btn" onclick={() => logCall('video', 'outgoing')}>
            <div class="action-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round"><path d="M23 7l-7.5 3.5L23 7z"/><rect x="1" y="5" width="16" height="14" rx="2" ry="2"/></svg>
            </div>
            <span>Video</span>
          </button>
          <button class="action-btn">
            <div class="action-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
            </div>
            <span>Pay</span>
          </button>
          <button class="action-btn">
            <div class="action-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
            </div>
            <span>Buscar</span>
          </button>
        </div>
      </div>
      <div class="profile-section">
        <div class="section-row no-hover">
          <span class="section-label">About</span>
          <span class="section-value">{contact.bio || 'Hey there! I am using WhatsApp'}</span>
        </div>
      </div>
      <div class="profile-section">
        <div class="section-row no-hover">
          <span class="section-label">Media, links and docs</span>
          <div class="media-grid">
            {#each [1,2,3] as _}
              <div class="media-thumb"></div>
            {/each}
          </div>
        </div>
      </div>
      <div class="profile-section">
        <div class="section-row no-hover" onclick={startChat}>
          <div class="section-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          </div>
          <span>Enviar mensaje</span>
        </div>
        <div class="section-row no-hover">
          <div class="section-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
          </div>
          <span>Silenciar notificaciones</span>
          <label class="toggle">
            <input type="checkbox" />
            <span class="slider"></span>
          </label>
        </div>
      </div>
      <div class="profile-section">
        <div class="section-row no-hover danger">
          <div class="section-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" stroke-width="2" stroke-linecap="round"><path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91"/></svg>
          </div>
          <span>Bloquear contacto</span>
        </div>
        <div class="section-row no-hover danger">
          <div class="section-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/></svg>
          </div>
          <span>Reportar contacto</span>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .profile-view { height: 100dvh; display: flex; flex-direction: column; background: var(--bg); max-width: 430px; margin: 0 auto; }
  .profile-header { display: flex; align-items: center; gap: 12px; padding: 12px 16px; background: var(--bg-2); flex-shrink: 0; border-bottom: 1px solid var(--border); }
  .profile-header span { font-size: 17px; font-weight: 600; color: var(--text); flex: 1; }
  .profile-content { flex: 1; overflow-y: auto; }
  .back-btn { background: none; border: none; color: var(--text); cursor: pointer; padding: 4px; display: flex; align-items: center; justify-content: center; }
  .icon-btn { background: none; border: none; color: var(--text-2); cursor: pointer; padding: 6px; border-radius: 50%; display: flex; align-items: center; justify-content: center; transition: background 0.2s; }
  .icon-btn:hover { background: var(--border); }
  .profile-card-top { text-align: center; padding: 28px 20px 20px; border-bottom: 1px solid var(--border); }
  .profile-avatar-lg { width: 120px; height: 120px; border-radius: 50%; object-fit: cover; margin: 0 auto 16px; box-shadow: 0 4px 16px rgba(0,0,0,0.4); }
  .profile-card-top h2 { font-size: 20px; font-weight: 700; color: var(--text); }
  .profile-phone { font-size: 14px; color: var(--text-2); display: block; margin-top: 4px; }
  .profile-actions { display: flex; justify-content: center; gap: 24px; margin-top: 24px; }
  .action-btn { display: flex; flex-direction: column; align-items: center; gap: 6px; background: none; border: none; cursor: pointer; color: var(--text-2); font-size: 11px; }
  .action-icon { width: 48px; height: 48px; border-radius: 50%; background: rgba(34,197,94,0.1); display: flex; align-items: center; justify-content: center; transition: background 0.2s; }
  .action-btn:hover .action-icon { background: rgba(34,197,94,0.2); }
  .profile-section { padding: 0; background: var(--bg-2); margin-top: 12px; border-bottom: 1px solid var(--border); }
  .section-row { display: flex; align-items: center; gap: 14px; padding: 14px 16px; border-bottom: 1px solid var(--border-2); cursor: pointer; }
  .section-row.no-hover { cursor: default; }
  .section-row.danger { color: var(--danger); }
  .section-label { font-size: 12px; color: var(--text-2); font-weight: 500; display: block; margin-bottom: 4px; }
  .section-icon { width: 20px; display: flex; justify-content: center; flex-shrink: 0; }
  .section-value { font-size: 14px; color: var(--text); }
  .media-grid { display: flex; gap: 4px; margin-top: 8px; }
  .media-thumb { width: 80px; height: 80px; border-radius: 8px; background: var(--bg-3); }
  .toggle { position: relative; display: inline-block; width: 44px; height: 24px; flex-shrink: 0; margin-left: auto; }
  .toggle input { opacity: 0; width: 0; height: 0; }
  .slider { position: absolute; cursor: pointer; inset: 0; background: var(--bg-3); border-radius: 24px; transition: 0.3s; }
  .slider::before { content: ''; position: absolute; height: 18px; width: 18px; left: 3px; bottom: 3px; background: #fff; border-radius: 50%; transition: 0.3s; }
  .toggle input:checked + .slider { background: var(--accent); }
  .toggle input:checked + .slider::before { transform: translateX(20px); }
</style>
