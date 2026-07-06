<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { avatarUrl, loadChats, formatDate } from '$lib/helpers';
  import { typedSocket } from '$lib/socket-types';
  import {
    user, socket, searchQuery, searchResults, contacts, showNewChat, showCreateGroup,
    groupName, selectedMembers, posts, viewingPost, totalUnread, subTab,
    unreadNotifications, vibeBalance
  } from '$lib/stores';
  import type { User } from '$lib/types';
  import BottomSheet from '$lib/components/BottomSheet.svelte';

  let { children } = $props();

  let usr: User | null = $state(null);
  let sk: ReturnType<typeof typedSocket> | null = $state(null);
  let unread = $state(0);
  let sq = $state('');
  let showMoreMenu = $state(false);
  let notifCount = $state(0);

  user.subscribe((v) => usr = v);
  socket.subscribe((v) => sk = v);
  totalUnread.subscribe((v) => unread = v);
  searchQuery.subscribe((v) => sq = v);
  unreadNotifications.subscribe((v) => notifCount = v);

  let currentRoute = $derived.by(() => {
    const path = $page.url.pathname;
    if (path === '/calls') return 'calls';
    if (path === '/feed') return 'feed';
    if (path === '/for-you') return 'fyp';
    if (path === '/live') return 'live';
    if (path === '/shop') return 'shop';
    if (path === '/games') return 'games';
    return 'chats';
  });

  function navTo(path: string) {
    showMoreMenu = false;
    goto(path, { noScroll: true });
  }

  function search() {
    if (sq.length < 2) { searchResults.set([]); return; }
    sk?.emit('search_users', { query: sq }, (res: User[]) => searchResults.set(res));
  }

  function startPrivateChat(contact: User) {
    sk?.emit('get_or_create_private_chat', { contactId: contact.id }, (res: any) => {
      goto(`/chat?id=${res.chatId}`, { noScroll: true });
      showNewChat.set(false);
      searchQuery.set('');
    });
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

  function doCreateGroup() {
    const nm = $state.snapshot(groupName) as string;
    const mems = $state.snapshot(selectedMembers) as User[];
    if (!nm || mems.length === 0) return;
    sk?.emit('create_group', { name: nm, memberIds: mems.map((m) => m.id) }, () => {
      showCreateGroup.set(false);
      groupName.set('');
      selectedMembers.set([]);
      loadChats();
      navTo('/');
    });
  }

  function openBySubTab() {
    const tab = $state.snapshot(subTab);
    if (tab === 'groups') {
      showCreateGroup.set(true);
    } else {
      showNewChat.set(true);
    }
  }

  function getHeaderTitle() {
    switch (currentRoute) {
      case 'chats': return 'Vibe';
      case 'calls': return 'Llamadas';
      case 'feed': return 'Feed';
      case 'live': return 'Live';
      case 'shop': return 'Tienda';
      case 'games': return 'Juegos';
      default: return 'Vibe';
    }
  }
</script>

<div class="app">
  <!-- HEADER -->
  {#if currentRoute !== 'live'}
  <div class="app-header">
    <div class="header-left">
      <h2>{getHeaderTitle()}</h2>
    </div>
    <div class="header-right">
      {#if currentRoute === 'chats'}
        <button class="icon-btn" onclick={openBySubTab}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
        </button>
        <button class="icon-btn" onclick={() => navTo('/profile')}>
          <img src={avatarUrl(usr?.id || 0)} alt="" class="header-avatar" />
          {#if notifCount > 0}
            <span class="header-badge">{notifCount}</span>
          {/if}
        </button>
      {:else if currentRoute === 'calls'}
        <button class="icon-btn">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
        </button>
      {:else if currentRoute === 'live'}
        <button class="icon-btn" onclick={() => navTo('/feed')}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
        </button>
      {:else if currentRoute === 'shop' || currentRoute === 'games'}
        <button class="icon-btn" onclick={() => navTo('/profile')}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
        </button>
      {:else}
        <button class="icon-btn" onclick={() => navTo('/profile')}>
          <img src={avatarUrl(usr?.id || 0)} alt="" class="header-avatar" />
        </button>
      {/if}
    </div>
  </div>
  {/if}

  <!-- PAGE CONTENT -->
  <div class="page-content">
    {@render children()}
  </div>

  <!-- FAB -->
  {#if currentRoute === 'chats'}
    <button class="fab" onclick={openBySubTab}>
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
    </button>
  {:else if currentRoute === 'feed'}
    <button class="fab" onclick={() => navTo('/post/new')}>
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
    </button>
  {/if}

  <!-- BOTTOM NAV -->
  <div class="bottom-nav">
    <button class="nav-item" class:active={currentRoute === 'chats'} onclick={() => navTo('/')}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
      <span>Chats</span>
      {#if unread > 0}
        <span class="nav-badge">{unread}</span>
      {/if}
    </button>
    <button class="nav-item" class:active={currentRoute === 'feed'} onclick={() => navTo('/feed')}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
      <span>Feed</span>
    </button>
    <button class="nav-item" class:active={currentRoute === 'live'} onclick={() => navTo('/live')}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/></svg>
      <span>Live</span>
      <span class="live-nav-dot"></span>
    </button>
    <button class="nav-item" class:active={currentRoute === 'shop'} onclick={() => navTo('/shop')}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0"/></svg>
      <span>Tienda</span>
    </button>
    <button class="nav-item" class:active={currentRoute === 'games'} onclick={() => navTo('/games')}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 12h4M8 10v4M15 13h.01M18 11h.01"/></svg>
      <span>Juegos</span>
    </button>
  </div>
</div>

<!-- MODALS -->

<BottomSheet show={$showNewChat} title="Nuevo chat" onclose={() => { showNewChat.set(false); searchQuery.set(''); }}>
  <div class="newchat-search">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
    <input type="text" placeholder="Buscar..." oninput={(e) => searchQuery.set((e.target as HTMLInputElement).value)} />
  </div>
  <div class="modal-list">
    {#each (sq.length >= 2 ? $searchResults : $contacts) as c}
      <div class="chat-item" onclick={() => { startPrivateChat(c); searchQuery.set(''); }}>
        <img src={avatarUrl(c.id)} alt="" class="chat-avatar" />
        <div class="chat-info">
          <span class="chat-name">{c.display_name}</span>
          <span class="chat-preview">{c.phone}</span>
        </div>
      </div>
    {/each}
  </div>
  <button class="create-group-btn" onclick={openCreateGroup} title="Nuevo grupo">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
    <span>Nuevo grupo</span>
  </button>
</BottomSheet>

<BottomSheet show={$showCreateGroup} title="Crear grupo" onclose={() => { showCreateGroup.set(false); groupName.set(''); selectedMembers.set([]); }}>
  <input type="text" bind:value={$groupName} placeholder="Nombre del grupo" class="modal-input" />
  <p class="modal-list-label">{$selectedMembers.length} participantes</p>
  <div class="modal-list">
    {#each $contacts as c}
      <div class="chat-item" class:selected={$selectedMembers.find((m: any) => m.id === c.id)} onclick={() => toggleMember(c)}>
        <img src={avatarUrl(c.id)} alt="" class="chat-avatar" />
        <div class="chat-info">
          <span class="chat-name">{c.display_name}</span>
        </div>
        {#if $selectedMembers.find((m: any) => m.id === c.id)}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="3" stroke-linecap="round"><path d="M20 6L9 17l-5-5"/></svg>
        {/if}
      </div>
    {/each}
  </div>
  <button class="modal-btn" onclick={doCreateGroup}>Crear grupo</button>
</BottomSheet>

<BottomSheet show={$viewingPost !== null} title="Post" onclose={() => viewingPost.set(null)}>
  <div class="status-viewer">
    <div class="status-v-header">
      <img src={avatarUrl($viewingPost?.user_id || 0)} alt="" class="status-v-avatar" />
      <div class="status-v-info">
        <span class="status-v-name">{$viewingPost?.display_name}</span>
        <span class="status-v-time">{formatDate($viewingPost?.created_at)}</span>
      </div>
    </div>
    <div class="status-v-body">
      {#if $viewingPost?.media_type === 'image'}
        <img src={$viewingPost.media} alt="" class="status-v-media" />
      {:else if $viewingPost?.media_type === 'video'}
        <video src={$viewingPost.media} controls class="status-v-media"></video>
      {:else}
        <p>{$viewingPost?.text}</p>
      {/if}
    </div>
  </div>
</BottomSheet>

<style>
  .app {
    height: 100dvh; display: flex; flex-direction: column;
    max-width: 430px; margin: 0 auto;
    position: relative; overflow: hidden;
    background: var(--bg);
    box-shadow: 0 0 40px rgba(0,0,0,0.5);
  }
  @media (min-width: 431px) {
    .app { border-left: 1px solid var(--border); border-right: 1px solid var(--border); }
  }
  .app-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 12px 16px; background: var(--bg-2); flex-shrink: 0;
    border-bottom: 1px solid var(--border);
  }
  .header-left h2 { font-size: 18px; font-weight: 600; color: var(--text); }
  .header-right { display: flex; align-items: center; gap: 4px; position: relative; }
  .header-avatar { width: 32px; height: 32px; border-radius: 50%; object-fit: cover; cursor: pointer; }
  .header-badge {
    position: absolute; top: -2px; right: -2px;
    min-width: 16px; height: 16px; border-radius: 8px;
    background: #ef4444; color: #fff; font-size: 9px; font-weight: 700;
    display: flex; align-items: center; justify-content: center; padding: 0 4px;
  }
  .icon-btn {
    background: none; border: none; color: var(--text-2);
    cursor: pointer; padding: 6px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    transition: background 0.2s; position: relative;
  }
  .icon-btn:hover { background: var(--border); }
  .page-content { flex: 1; overflow-y: auto; display: flex; flex-direction: column; }

  .fab {
    position: fixed; bottom: 80px; right: calc(50% - 215px + 16px);
    width: 56px; height: 56px; border-radius: 50%; background: var(--accent);
    border: none; cursor: pointer; display: flex; align-items: center; justify-content: center;
    box-shadow: 0 4px 20px var(--shadow-accent); z-index: 10;
    transition: transform 0.2s, box-shadow 0.2s; color: white;
  }
  .fab:hover { transform: scale(1.05); box-shadow: 0 6px 24px var(--shadow-accent); }
  @media (max-width: 430px) { .fab { right: 16px; } }

  .bottom-nav {
    display: flex; background: var(--bg-2);
    border-top: 1px solid var(--border);
    padding: 6px 0; flex-shrink: 0; position: relative;
  }
  .nav-item {
    flex: 1; display: flex; flex-direction: column;
    align-items: center; gap: 2px; padding: 4px 0;
    background: none; border: none; color: var(--text-3);
    cursor: pointer; transition: color 0.2s; position: relative;
    font-size: 10px;
  }
  .nav-item.active { color: var(--accent); }
  .nav-item span { font-size: 10px; font-weight: 500; }
  .live-nav-dot {
    position: absolute; top: 2px; right: 50%; transform: translateX(14px);
    width: 6px; height: 6px; border-radius: 50%; background: #ef4444;
    animation: pulse 1.5s infinite;
  }
  @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
  .nav-badge {
    position: absolute; top: 0; right: 50%;
    transform: translateX(14px); min-width: 16px; height: 16px;
    border-radius: 8px; background: var(--accent); color: #000;
    font-size: 9px; font-weight: 700; display: flex;
    align-items: center; justify-content: center; padding: 0 4px;
  }

  .modal-input { width: 100%; padding: 14px 16px; border: 2px solid rgba(255,255,255,0.08); border-radius: 12px; font-size: 15px; outline: none; background: var(--bg-3); color: var(--text); margin-bottom: 14px; transition: border-color 0.2s; box-sizing: border-box; }
  .modal-input:focus { border-color: var(--accent); }
  .modal-input::placeholder { color: var(--text-3); }
  .modal-list-label { font-size: 13px; color: var(--text-3); margin-bottom: 8px; }
  .modal-list { margin-bottom: 16px; }
  .modal-btn { width: 100%; padding: 13px; background: var(--accent); color: #000; font-weight: 700; border: none; border-radius: 12px; font-size: 15px; cursor: pointer; }
  .modal-btn:hover { background: var(--accent-hover); }
  .chat-item { display: flex; align-items: center; gap: 12px; padding: 12px 12px; cursor: pointer; transition: background 0.15s; border-bottom: 1px solid var(--border-2); }
  .chat-item:hover, .chat-item.selected { background: var(--border-2); }
  .chat-avatar { width: 44px; height: 44px; border-radius: 50%; object-fit: cover; }
  .chat-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  .chat-name { font-size: 15px; font-weight: 500; color: var(--text); }
  .chat-preview { font-size: 13px; color: var(--text-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .newchat-search { display: flex; align-items: center; gap: 8px; padding: 6px 10px; background: var(--bg-3); border-radius: 8px; margin-bottom: 10px; }
  .newchat-search input { flex: 1; background: none; border: none; outline: none; color: var(--text); font-size: 13px; }
  .newchat-search input::placeholder { color: var(--text-3); }
  .create-group-btn { width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; padding: 10px; margin-top: 4px; background: none; border: 1.5px solid rgba(34,197,94,0.3); border-radius: 10px; cursor: pointer; transition: background 0.2s; }
  .create-group-btn:hover { background: rgba(34,197,94,0.06); }
  .create-group-btn span { color: var(--accent); font-size: 13px; font-weight: 600; }
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
