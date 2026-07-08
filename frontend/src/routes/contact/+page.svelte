<script lang="ts">
  import { emit } from '$lib/socket';
  import Icon from '$lib/icon/Icon.svelte';
  import type { IconName } from '$lib/icon/icons';
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { avatarUrl } from '$lib/helpers';
  import { contacts } from '$lib/stores';
  import type { User } from '$lib/types';

  let contact: User | null = $state(null);
  let loaded = $state(false);
  let showMenu = $state(false);
  let muted = $state(false);

  const contactId = $derived(Number($page.url.searchParams.get('id')));

  onMount(() => {
    loadContact();
  });

  $effect(() => {
    if (!loaded && $contacts.length > 0) {
      const found = $contacts.find((c: User) => c.id === contactId);
      if (found) { contact = found; loaded = true; }
    }
  });

  async function loadContact() {
    if (loaded) return;
    const list = get(contacts);
    const found = list.find((c: User) => c.id === contactId);
    if (found) { contact = found; loaded = true; return; }
    try {
      const list = await emit<User[]>('get_contacts');
      const c = list.find((u) => u.id === contactId);
      if (c) contact = c;
    } catch {}
    loaded = true;
  }

  async function startChat() {
    try {
      const res = await emit('get_or_create_private_chat', { contactId });
      goto(`/chat?id=${res.chatId}`, { noScroll: true });
    } catch {}
  }

  function logCall(type: string, status: string) {
    emit('log_call', { calleeId: contactId, type, status });
  }
</script>

<div class="profile-view">
  <div class="wa-header">
    <button class="header-btn" onclick={() => goto('/contacts')}>
      <Icon name="chevron-left" size={22} />
    </button>
    <span class="header-title">Contact info</span>
    <button class="header-btn" onclick={() => showMenu = !showMenu}>
      <Icon name="more-v" size={20} />
    </button>
  </div>

  {#if showMenu}
    <div class="menu-overlay" onclick={() => showMenu = false}></div>
    <div class="menu-sheet">
      <button class="menu-item" onclick={() => { showMenu = false; startChat(); }}>
        <Icon name="message" size={20} />
        <span>Send message</span>
      </button>
      <button class="menu-item" onclick={() => { showMenu = false; }}>
        <Icon name="x" size={20} />
        <span>Delete contact</span>
      </button>
      <button class="menu-item" onclick={() => { showMenu = false; }}>
        <Icon name="share" size={20} />
        <span>Share contact</span>
      </button>
    </div>
  {/if}

  {#if contact}
    <div class="profile-content">
      <div class="profile-card-top">
        <div class="avatar-wrapper">
          <img src={avatarUrl(contact.id, contact.avatar)} alt="" class="profile-avatar-lg" />
        </div>
        <h2>{contact.display_name}</h2>
        <span class="profile-phone">{contact.phone}</span>
        <div class="profile-actions">
          <button class="action-btn" onclick={() => logCall('audio', 'outgoing')}>
            <div class="action-icon">
              <Icon name="phone" size={22} style="color:var(--accent)" />
            </div>
            <span>Audio</span>
          </button>
          <button class="action-btn" onclick={() => logCall('video', 'outgoing')}>
            <div class="action-icon">
              <Icon name="video" size={22} style="color:var(--accent)" />
            </div>
            <span>Video</span>
          </button>
          <button class="action-btn" onclick={() => logCall('audio', 'outgoing')}>
            <div class="action-icon">
              <Icon name="search" size={22} style="color:var(--accent)" />
            </div>
            <span>Search</span>
          </button>
        </div>
      </div>

      <div class="wa-section">
        <div class="wa-row">
          <span class="wa-label">About</span>
          <span class="wa-value">{contact.bio || 'Hey there! I am using Vibe'}</span>
        </div>
      </div>

      <div class="wa-section">
        <div class="wa-row" style="cursor:pointer" onclick={() => goto('/chat?id=' + contactId)}>
          <span class="wa-label">Media, links and docs</span>
          <div class="media-header-right">
            <span class="media-count">9</span>
            <Icon name="chevron-right" size={16} style="color:var(--text-3)" />
          </div>
        </div>
        <div class="media-grid">
          {#each [1,2,3] as _}
            <div class="media-item"></div>
          {/each}
        </div>
      </div>

      <div class="wa-section">
        <button class="wa-row" onclick={() => goto('/chat?id=' + contactId)}>
          <Icon name="star" size={20} style="color:var(--accent)" />
          <span class="wa-row-text">Starred messages</span>
          <Icon name="chevron-right" size={16} style="color:var(--text-3);margin-left:auto" />
        </button>
      </div>

      <div class="wa-section">
        <div class="wa-row">
          <Icon name="moon" size={20} style="color:var(--accent)" />
          <span class="wa-row-text">Mute notifications</span>
          <label class="toggle">
            <input type="checkbox" bind:checked={muted} />
            <span class="slider"></span>
          </label>
        </div>
        <button class="wa-row" onclick={() => goto('/settings')}>
          <Icon name="image" size={20} style="color:var(--accent)" />
          <span class="wa-row-text">Wallpaper & sound</span>
          <Icon name="chevron-right" size={16} style="color:var(--text-3);margin-left:auto" />
        </button>
      </div>

      <div class="wa-section">
        <button class="wa-row danger" onclick={startChat}>
          <Icon name="message" size={20} />
          <span class="wa-row-text">Send message</span>
        </button>
      </div>

      <div class="wa-section">
        <button class="wa-row danger">
          <Icon name="x" size={20} style="color:var(--danger)" />
          <span class="wa-row-text" style="color:var(--danger)">Block contact</span>
        </button>
        <button class="wa-row danger">
          <Icon name="x" size={20} style="color:var(--danger)" />
          <span class="wa-row-text" style="color:var(--danger)">Report contact</span>
        </button>
      </div>
    </div>
  {:else if loaded}
    <div class="empty-state">
      <Icon name="user" size={48} style="color:var(--text-3)" />
      <p>Contact not found</p>
    </div>
  {/if}
</div>

<style>
  .profile-view { height: 100%; display: flex; flex-direction: column; background: var(--bg); max-width: 430px; margin: 0 auto; position: relative; }
  .wa-header { display: flex; align-items: center; gap: 12px; padding: 8px 12px; background: var(--bg-2); flex-shrink: 0; min-height: 52px; }
  .header-btn { background: none; border: none; color: var(--text); cursor: pointer; padding: 6px; display: flex; align-items: center; justify-content: center; border-radius: 50%; }
  .header-btn:hover { background: var(--border); }
  .header-title { font-size: 17px; font-weight: 600; color: var(--text); flex: 1; }

  .menu-overlay { position: fixed; inset: 0; z-index: 90; }
  .menu-sheet { position: fixed; right: 12px; top: 56px; background: var(--bg-2); border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.3); z-index: 91; overflow: hidden; min-width: 180px; }
  .menu-item { display: flex; align-items: center; gap: 12px; width: 100%; padding: 14px 16px; background: none; border: none; color: var(--text); font-size: 14px; cursor: pointer; text-align: left; }
  .menu-item:hover { background: var(--border); }

  .profile-content { flex: 1; overflow-y: auto; }
  .profile-card-top { text-align: center; padding: 24px 20px 20px; }
  .avatar-wrapper { width: 100px; height: 100px; margin: 0 auto 12px; border-radius: 50%; overflow: hidden; }
  .profile-avatar-lg { width: 100%; height: 100%; object-fit: cover; }
  .profile-card-top h2 { font-size: 20px; font-weight: 700; color: var(--text); margin: 0; }
  .profile-phone { font-size: 14px; color: var(--text-2); display: block; margin-top: 2px; }
  .profile-actions { display: flex; justify-content: center; gap: 20px; margin-top: 20px; }
  .action-btn { display: flex; flex-direction: column; align-items: center; gap: 4px; background: none; border: none; cursor: pointer; color: var(--text-2); font-size: 11px; padding: 0; }
  .action-icon { width: 44px; height: 44px; border-radius: 50%; background: rgba(var(--accent-rgb),0.1); display: flex; align-items: center; justify-content: center; }
  .action-btn:hover .action-icon { background: rgba(var(--accent-rgb),0.2); }

  .wa-section { background: var(--bg-2); margin-top: 10px; border-top: 1px solid var(--border); }
  .wa-row { display: flex; align-items: center; gap: 14px; padding: 12px 16px; background: none; border: none; color: var(--text); font-size: 14px; width: 100%; text-align: left; cursor: pointer; }
  .wa-row:not(:last-child) { border-bottom: 1px solid var(--border); }
  .wa-label { display: block; font-size: 12px; color: var(--text-2); font-weight: 500; margin-bottom: 2px; }
  .wa-value { font-size: 14px; color: var(--text); display: block; }
  .wa-row-text { font-size: 14px; color: var(--text); }
  .wa-row.danger .wa-row-text { color: var(--danger); }

  .media-header-right { display: flex; align-items: center; gap: 6px; margin-left: auto; }
  .media-count { font-size: 13px; color: var(--accent); font-weight: 500; }
  .media-grid { display: flex; gap: 3px; padding: 0 16px 12px; }
  .media-item { width: 72px; height: 72px; border-radius: 8px; background: var(--bg-3); flex-shrink: 0; }

  .toggle { position: relative; display: inline-block; width: 44px; height: 24px; flex-shrink: 0; margin-left: auto; }
  .toggle input { opacity: 0; width: 0; height: 0; }
  .slider { position: absolute; cursor: pointer; inset: 0; background: var(--bg-3); border-radius: 24px; transition: 0.3s; }
  .slider::before { content: ''; position: absolute; height: 18px; width: 18px; left: 3px; bottom: 3px; background: #fff; border-radius: 50%; transition: 0.3s; }
  .toggle input:checked + .slider { background: var(--accent); }
  .toggle input:checked + .slider::before { transform: translateX(20px); }

  .empty-state { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; color: var(--text-3); font-size: 14px; }
</style>
