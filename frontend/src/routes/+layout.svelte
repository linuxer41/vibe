<script lang="ts">
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { createSocket, emit } from '$lib/socket';
  import {
    socket, user, token, authStep, authError, phone, code,
    chats, contacts, calls, messages, activeChat,
    typingText, setupName, setupUser, setupBio, displayName, username, bio,
    passcodeSettings, appLocked, theme,
    searchQuery, searchResults, showNewChat, showCreateGroup,
    groupName, selectedMembers, posts, viewingPost, subTab,
    unreadNotifications, vibeBalance
  } from '$lib/stores';
  import { initSocket, loadInitialData, applyThemeColors, avatarUrl, mediaUrl, loadChats, formatDate } from '$lib/helpers';
  import { requestPushSubscription } from '$lib/push';
import { requestNotifPermission } from '$lib/notifications';
  import { typedSocket } from '$lib/socket-types';
  import { isTauri, initSystemBars, applySystemBarsTheme } from '$lib/platform';
  import type { User } from '$lib/types';
  import Icon from '$lib/icon/Icon.svelte';
  import type { IconName } from '$lib/icon/icons';
  import '../app.css';
  import Toast from '$lib/components/Toast.svelte';
  import BottomSheet from '$lib/components/BottomSheet.svelte';

  let { children } = $props();
  let pinInput = $state('');
  let lockError = $state('');

  let usr: User | null = $state(null);
  let sk: ReturnType<typeof typedSocket> | null = $state(null);
  let suggestedUsers: User[] = $state([]);

  user.subscribe((v) => usr = v);
  socket.subscribe((v) => sk = v);

  onMount(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/service-worker.js').catch(() => {});
    }
    const saved = localStorage.getItem('wa_token');
    const savedTheme = localStorage.getItem('wa_theme') as 'dark' | 'light' | null;
    if (savedTheme) theme.set(savedTheme);
    if (saved) { tryRestore(saved); } else { authStep.set('phone'); }

    const savedPasscode = localStorage.getItem('wa_passcode');
    if (savedPasscode) {
      try {
        const ps = JSON.parse(savedPasscode);
        passcodeSettings.set(ps);
        if (ps.enabled) appLocked.set(true);
      } catch {}
    }

    document.addEventListener('visibilitychange', handleVisibility);
    document.addEventListener('click', updateActivity);
    const savedTheme2 = localStorage.getItem('wa_theme') as 'dark' | 'light' | null;
    initSystemBars(savedTheme2 || 'dark');
  });

  $effect(() => {
    const t = $theme;
    applyThemeColors(t);
    applySystemBarsTheme(t);
  });

  function handleVisibility() {
    if (document.visibilityState === 'hidden') {
      localStorage.setItem('wa_last_activity', Date.now().toString());
    } else if (document.visibilityState === 'visible') {
      const ps = get(passcodeSettings);
      if (!ps.enabled) return;
      const last = parseInt(localStorage.getItem('wa_last_activity') || '0');
      const elapsed = (Date.now() - last) / 60000;
      if (elapsed >= ps.timeout) {
        appLocked.set(true);
        pinInput = '';
        lockError = '';
      }
    }
  }

  function updateActivity() {
    if (get(passcodeSettings).enabled) {
      localStorage.setItem('wa_last_activity', Date.now().toString());
    }
  }

  function unlock() {
    const ps = get(passcodeSettings);
    if (hashPin(pinInput) === ps.passcodeHash) {
      appLocked.set(false);
      pinInput = '';
      lockError = '';
    } else {
      lockError = 'PIN incorrecto';
    }
  }

  function hashPin(pin: string) {
    let h = 0;
    for (let i = 0; i < pin.length; i++) {
      h = ((h << 5) - h) + pin.charCodeAt(i);
      h |= 0;
    }
    return 'h' + Math.abs(h).toString(36);
  }

  $effect(() => {
    document.documentElement.setAttribute('data-theme', $theme);
  });

  $effect(() => {
    const p = $page.url.pathname;
    if ($authStep === 'main' && p === '/init') {
      goto('/', { replaceState: true });
    } else if ($authStep !== 'main' && $authStep !== 'loading' && p !== '/init' && p !== '/terms' && p !== '/privacy-policy') {
      goto('/init', { replaceState: true });
    }
  });

  $effect(() => {
    const post = $viewingPost;
    if (post?.id && sk) {
      emit('join_post', { postId: post.id });
      return () => emit('leave_post', { postId: post.id });
    }
  });

  function navTo(path: string) {
    goto(path, { noScroll: true });
  }

  $effect(() => {
    if ($showNewChat && sk) {
      emit<User[]>('get_suggested_users').then(res => suggestedUsers = res || []);
    }
  });

  $effect(() => {
    const q = $searchQuery;
    if (!sk || q.length < 2) { searchResults.set([]); return; }
    emit<User[]>('search_users', { query: q }).then(res => searchResults.set(res));
  });

  async function startPrivateChat(contact: User) {
    try {
      const res = await emit<any>('get_or_create_private_chat', { contactId: contact.id });
      goto(`/chat?id=${res.chatId}`, { noScroll: true });
      showNewChat.set(false);
      searchQuery.set('');
    } catch {}
  }

  function openCreateGroup() {
    showNewChat.set(false);
    showCreateGroup.set(true);
    loadChats();
  }

  function toggleMember(u: User) {
    selectedMembers.update((list) => {
      if (list.find((m) => m.id === u.id)) return list.filter((m) => m.id !== u.id);
      return [...list, u];
    });
  }

  async function doCreateGroup() {
    const nm = $state.snapshot(groupName) as string;
    const mems = $state.snapshot(selectedMembers) as User[];
    if (!nm || mems.length === 0) return;
    await emit('create_group', { name: nm, memberIds: mems.map((m) => m.id) });
    showCreateGroup.set(false);
    groupName.set('');
    selectedMembers.set([]);
    loadChats();
    navTo('/');
  }

  function openBySubTab() {
    const tab = $state.snapshot(subTab);
    if (tab === 'groups') {
      showCreateGroup.set(true);
    } else {
      showNewChat.set(true);
    }
  }

  function tryRestore(t: string) {
    authStep.set('loading');
    import('$lib/auth-http').then(async ({ restoreSession }) => {
      try {
        const u = await restoreSession(t);
        token.set(t);
        user.set(u);
        const sk = createSocket(t);
        sk.connect();
        setupName.set(u.display_name);
        setupUser.set(u.username || '');
        setupBio.set(u.bio || '');
        displayName.set(u.display_name);
        username.set(u.username || '');
        bio.set(u.bio || '');
        socket.set(sk);
        initSocket(sk);
        loadInitialData();
        authStep.set('main');
        requestPushSubscription();
        requestNotifPermission();
      } catch {
        localStorage.removeItem('wa_token');
        authStep.set('phone');
      }
    });
  }
</script>

{#if $authStep === 'loading'}
  <div class="loading-screen">
    <div class="loading-content">
      <svg class="loading-logo" viewBox="0 0 48 48" width="64" height="64">
        <circle cx="24" cy="24" r="20" fill="none" stroke="var(--accent)" stroke-width="3" stroke-dasharray="100" stroke-linecap="round">
          <animateTransform attributeName="transform" type="rotate" from="0 24 24" to="360 24 24" dur="1.2s" repeatCount="indefinite" />
          <animate attributeName="stroke-dashoffset" from="0" to="-200" dur="1.2s" repeatCount="indefinite" />
        </circle>
        <text x="24" y="30" text-anchor="middle" font-size="22" fill="var(--accent)" font-weight="700">V</text>
      </svg>
      <h1 class="loading-title">Vibe: Connect</h1>
      <p class="loading-subtitle">Conectando...</p>
    </div>
  </div>
{:else if $appLocked && $authStep === 'main'}
  <div class="lock-screen">
    <div class="lock-content">
      <div class="lock-icon">
        <Icon name="lock" size={40} />
      </div>
      <h2 class="lock-title">Vibe</h2>
      <p class="lock-subtitle">Ingresa tu PIN para desbloquear</p>
      <div class="lock-dots">
        {#each [0, 1, 2, 3, 4, 5] as i}
          <div class="dot" class:filled={pinInput.length > i}></div>
        {/each}
      </div>
      <div class="lock-numpad">
        {#each [1, 2, 3, 4, 5, 6, 7, 8, 9] as n}
          <button class="key" onclick={() => { if (pinInput.length < 6) { pinInput += n; lockError = ''; } }}>{n}</button>
        {/each}
        <button class="key" onclick={() => pinInput = pinInput.slice(0, -1)}>
          <Icon name="chevron-left" size={22} />
        </button>
        <button class="key" onclick={() => { if (pinInput.length < 6) { pinInput += '0'; lockError = ''; } }}>0</button>
        <button class="key" onclick={unlock} style="color: var(--accent)">
          <Icon name="check" size={22} strokeWidth={3} />
        </button>
      </div>
      {#if lockError}
        <p class="lock-error">{lockError}</p>
      {/if}
    </div>
  </div>
{:else if $authStep === 'main'}
  {@render children()}

  <!-- MODALS -->
  <BottomSheet show={$showNewChat} title="Nuevo chat" onclose={() => { showNewChat.set(false); searchQuery.set(''); }}>
    <div class="newchat-search">
      <Icon name="search" size={16} />
      <input type="text" placeholder="Buscar..." oninput={(e) => searchQuery.set((e.target as HTMLInputElement).value)} />
    </div>
    <div class="modal-list">
      {#each ($searchQuery.length >= 2 ? $searchResults : [...$contacts, ...suggestedUsers.filter((u: User) => !$contacts.some((c: User) => c.id === u.id))].slice(0, 20)) as c}
        <div class="chat-item" onclick={() => { startPrivateChat(c); searchQuery.set(''); }}>
          <img src={avatarUrl(c.id, c.avatar)} alt="" class="chat-avatar" />
          <div class="chat-info">
            <span class="chat-name">{c.display_name}</span>
            <span class="chat-preview">{c.phone}</span>
          </div>
        </div>
      {/each}
    </div>
    <button class="create-group-btn" onclick={openCreateGroup} title="Nuevo grupo" style="color: var(--accent)">
      <Icon name="plus" size={18} strokeWidth={2.5} />
      <span>Nuevo grupo</span>
    </button>
  </BottomSheet>

  <BottomSheet show={$showCreateGroup} title="Crear grupo" onclose={() => { showCreateGroup.set(false); groupName.set(''); selectedMembers.set([]); }}>
    <input type="text" bind:value={$groupName} placeholder="Nombre del grupo" class="modal-input" />
    <p class="modal-list-label">{$selectedMembers.length} participantes</p>
    <div class="modal-list">
      {#each $contacts as c}
        <div class="chat-item" class:selected={$selectedMembers.find((m: any) => m.id === c.id)} onclick={() => toggleMember(c)}>
          <img src={avatarUrl(c.id, c.avatar)} alt="" class="chat-avatar" />
          <div class="chat-info">
            <span class="chat-name">{c.display_name}</span>
          </div>
          {#if $selectedMembers.find((m: any) => m.id === c.id)}
            <Icon name="check" size={20} strokeWidth={3} style="color: var(--accent)" />
          {/if}
        </div>
      {/each}
    </div>
    <button class="modal-btn" onclick={doCreateGroup}>Crear grupo</button>
  </BottomSheet>

  <BottomSheet show={$viewingPost !== null} title="Post" onclose={() => viewingPost.set(null)}>
    <div class="status-viewer">
      <div class="status-v-header">
        <img src={avatarUrl($viewingPost?.user_id || 0, $viewingPost?.avatar)} alt="" class="status-v-avatar" />
        <div class="status-v-info">
          <span class="status-v-name">{$viewingPost?.display_name}</span>
          <span class="status-v-time">{formatDate($viewingPost?.created_at)}</span>
        </div>
      </div>
      <div class="status-v-body">
        {#if $viewingPost?.media_type === 'image'}
          <img src={mediaUrl($viewingPost.media)} alt="" class="status-v-media" />
        {:else if $viewingPost?.media_type === 'video'}
          <video src={mediaUrl($viewingPost.media)} controls class="status-v-media"></video>
        {:else}
          <p>{$viewingPost?.text}</p>
        {/if}
      </div>
    </div>
  </BottomSheet>
{:else}
  {@render children()}
{/if}

<Toast />

<style>
  .loading-screen {
    position: fixed; inset: 0; background: var(--bg);
    display: flex; align-items: center; justify-content: center;
    z-index: 9999;
  }
  .loading-content { text-align: center; }
  .loading-logo { margin-bottom: 20px; }
  .loading-title { font-size: 22px; font-weight: 700; color: var(--text); margin-bottom: 8px; }
  .loading-subtitle { font-size: 14px; color: var(--text-3); }

  .lock-screen {
    position: fixed; inset: 0; background: var(--bg);
    display: flex; align-items: center; justify-content: center;
    z-index: 9999; animation: fadeIn 0.3s ease-out;
  }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  .lock-content { text-align: center; width: 100%; max-width: 320px; padding: 40px 24px; }
  .lock-icon { color: var(--accent); margin-bottom: 16px; }
  .lock-title { font-size: 24px; font-weight: 700; color: var(--text); margin-bottom: 4px; }
  .lock-subtitle { font-size: 14px; color: var(--text-2); margin-bottom: 28px; }
  .lock-dots { display: flex; justify-content: center; gap: 14px; margin-bottom: 32px; }
  .dot { width: 14px; height: 14px; border-radius: 50%; border: 2px solid var(--text-3); transition: all 0.2s; }
  .dot.filled { background: var(--accent); border-color: var(--accent); }
  .lock-numpad { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; max-width: 260px; margin: 0 auto; }
  .key { aspect-ratio: 1; border-radius: 50%; border: none; background: var(--bg-3); color: var(--text); font-size: 24px; font-weight: 500; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: background 0.15s; }
  .key:hover { background: color-mix(in srgb, var(--bg-3), var(--text) 12%); }
  .key:active { background: color-mix(in srgb, var(--bg-3), var(--text) 25%); }
  .lock-error { color: var(--danger); font-size: 13px; margin-top: 16px; }

  .newchat-search { display: flex; align-items: center; gap: 10px; padding: 12px 14px; background: var(--bg-3); border-radius: 12px; margin-bottom: 14px; color: var(--text-3); }
  .newchat-search input { flex: 1; background: none; border: none; outline: none; color: var(--text); font-size: 15px; }
  .newchat-search input::placeholder { color: var(--text-3); }
  .modal-list { margin-bottom: 16px; }
  .chat-item { display: flex; align-items: center; gap: 12px; padding: 12px 12px; cursor: pointer; transition: background 0.15s; border-bottom: 1px solid var(--border-2); }
  .chat-item:hover, .chat-item.selected { background: var(--border-2); }
  .chat-avatar { width: 44px; height: 44px; border-radius: 50%; object-fit: cover; }
  .chat-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  .chat-name { font-size: 15px; font-weight: 500; color: var(--text); }
  .chat-preview { font-size: 13px; color: var(--text-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .create-group-btn { width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; padding: 10px; margin-top: 4px; background: none; border: 1.5px solid rgba(var(--accent-rgb),0.3); border-radius: 10px; cursor: pointer; transition: background 0.2s; }
  .create-group-btn:hover { background: rgba(var(--accent-rgb),0.06); }
  .create-group-btn span { color: var(--accent); font-size: 13px; font-weight: 600; }
  .modal-input { width: 100%; padding: 14px 16px; border: 2px solid var(--border); border-radius: 12px; font-size: 15px; outline: none; background: var(--bg-3); color: var(--text); margin-bottom: 14px; transition: border-color 0.2s; box-sizing: border-box; }
  .modal-input:focus { border-color: var(--accent); }
  .modal-input::placeholder { color: var(--text-3); }
  .modal-list-label { font-size: 13px; color: var(--text-3); margin-bottom: 8px; }
  .modal-btn { width: 100%; padding: 13px; background: var(--accent); color: #000; font-weight: 700; border: none; border-radius: 12px; font-size: 15px; cursor: pointer; }
  .modal-btn:hover { background: var(--accent-hover); }
  .status-viewer { width: 100%; }
  .status-v-header { display: flex; align-items: center; gap: 10px; padding: 8px 0 16px; border-bottom: 1px solid var(--border); }
  .status-v-avatar { width: 40px; height: 40px; border-radius: 50%; object-fit: cover; }
  .status-v-info { flex: 1; }
  .status-v-name { display: block; font-size: 15px; font-weight: 600; color: var(--text); }
  .status-v-time { display: block; font-size: 11px; color: var(--text-3); }
  .status-v-body { padding: 48px 8px; text-align: center; min-height: 200px; display: flex; align-items: center; justify-content: center; }
  .status-v-body p { font-size: 20px; color: var(--text); line-height: 1.5; }
  .status-v-media { max-width: 100%; max-height: 300px; border-radius: 12px; object-fit: contain; }
</style>
