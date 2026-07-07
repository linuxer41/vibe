<script lang="ts">
  import { goto } from '$app/navigation';
  import { avatarUrl, formatDate } from '$lib/helpers';
  import {
    user, socket, chats, contacts, posts, subTab, viewingPost,
    pinnedChats, regularChats, groupChats, postInput
  } from '$lib/stores';
  import Icon from '$lib/icon/Icon.svelte';
  import type { Chat, User } from '$lib/types';

  let usr: User | null = $state(null);
  let sk: any = $state(null);
  user.subscribe((v) => usr = v);
  socket.subscribe((v) => sk = v);
</script>

<!-- Stories -->
<div class="stories-bar">
  <div class="story-item">
    <div class="story-avatar your-story">
      <img src={avatarUrl(usr?.id || 0)} alt="" />
      <div class="story-plus">
        <Icon name="plus" size={14} variant="filled" style="color: #fff" />
      </div>
    </div>
    <span class="story-label">You</span>
  </div>
  {#each $contacts as c}
    <div class="story-item" onclick={() => { const s = $posts.find((st: any) => st.user_id === c.id); if (s) viewingPost.set(s); }}>
      <div class="story-avatar" class:has-status={$posts.some((s: any) => s.user_id === c.id)}>
        <img src={avatarUrl(c.id)} alt="" />
      </div>
      <span class="story-label">{c.display_name?.split(' ')[0]}</span>
    </div>
  {/each}
</div>

<!-- Sub tabs -->
<div class="sub-tabs">
  <button class="sub-tab" class:active={$subTab === 'pinned'} onclick={() => subTab.set('pinned')}>
    <Icon name="star" size={14} strokeWidth={2.5} />
    Pinned <span class="badge">{$pinnedChats.length}</span>
  </button>
  <button class="sub-tab" class:active={$subTab === 'chats'} onclick={() => subTab.set('chats')}>
    Chats <span class="badge active">{$regularChats.length}</span>
  </button>
  <button class="sub-tab" class:active={$subTab === 'groups'} onclick={() => subTab.set('groups')}>
    Groups <span class="badge">{$groupChats.length}</span>
  </button>
</div>

<!-- Chat list -->
<div class="chat-list">
  {#if $subTab === 'pinned'}
    {#each $pinnedChats as chat}
      <div class="chat-item" onclick={() => goto(`/chat?id=${chat.id}`, { noScroll: true })}>
        <div class="chat-avatar-wrap">
          <img src={avatarUrl(chat.type === 'private' ? (chat.members?.[0]?.id || chat.id) : chat.id)} alt="" class="chat-avatar" />
          <div class="status-indicator offline"></div>
        </div>
        <div class="chat-info">
          <div class="chat-top">
            <span class="chat-name">{chat.name}</span>
            <span class="chat-time">{chat.last_message_time ? formatDate(chat.last_message_time) : ''}</span>
          </div>
          <div class="chat-bottom">
            <span class="chat-preview">{chat.last_message || ''}</span>
            {#if chat.unread > 0}
              <span class="unread-badge">{chat.unread}</span>
            {/if}
          </div>
        </div>
      </div>
    {/each}
  {:else if $subTab === 'groups'}
    {#each $groupChats as chat}
      <div class="chat-item" onclick={() => goto(`/chat?id=${chat.id}`, { noScroll: true })}>
        <div class="chat-avatar-wrap">
          <img src={avatarUrl(chat.id)} alt="" class="chat-avatar" />
          <div class="status-indicator offline"></div>
        </div>
        <div class="chat-info">
          <div class="chat-top">
            <span class="chat-name">{chat.name}</span>
            <span class="chat-time">{chat.last_message_time ? formatDate(chat.last_message_time) : ''}</span>
          </div>
          <div class="chat-bottom">
            <span class="chat-preview">{chat.last_message || ''}</span>
            {#if chat.unread > 0}
              <span class="unread-badge">{chat.unread}</span>
            {/if}
          </div>
        </div>
      </div>
    {/each}
  {:else}
    {#each $regularChats as chat}
      <div class="chat-item" onclick={() => goto(`/chat?id=${chat.id}`, { noScroll: true })}>
        <div class="chat-avatar-wrap">
          <img src={avatarUrl(chat.type === 'private' ? (chat.members?.[0]?.id || chat.id) : chat.id)} alt="" class="chat-avatar" />
          <div class="status-indicator offline"></div>
        </div>
        <div class="chat-info">
          <div class="chat-top">
            <span class="chat-name">{chat.name}</span>
            <span class="chat-time">{chat.last_message_time ? formatDate(chat.last_message_time) : ''}</span>
          </div>
          <div class="chat-bottom">
            <span class="chat-preview">{chat.last_message || ''}</span>
            {#if chat.unread > 0}
              <span class="unread-badge">{chat.unread}</span>
            {/if}
          </div>
        </div>
      </div>
    {/each}
  {/if}
  {#if $subTab === 'pinned' && $pinnedChats.length === 0}
    <div class="empty-state">
      <Icon name="star" size={48} strokeWidth={1.5} style="color: var(--text-3)" />
      <p>No hay chats anclados</p>
    </div>
  {:else if $subTab === 'groups' && $groupChats.length === 0}
    <div class="empty-state">
      <Icon name="users" size={48} strokeWidth={1.5} style="color: var(--text-3)" />
      <p>No hay grupos</p>
    </div>
  {:else if $regularChats.length === 0 && $subTab === 'chats'}
    <div class="empty-state">
      <Icon name="message" size={48} strokeWidth={1.5} style="color: var(--text-3)" />
      <p>No hay chats aún</p>
    </div>
  {/if}
</div>

<style>
  .stories-bar {
    display: flex; gap: 14px; padding: 12px 16px; overflow-x: auto;
    background: var(--bg-2); border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }
  .stories-bar::-webkit-scrollbar { display: none; }
  .story-item { display: flex; flex-direction: column; align-items: center; gap: 4px; cursor: pointer; flex-shrink: 0; }
  .story-avatar {
    width: 56px; height: 56px; border-radius: 50%;
    padding: 3px; background: var(--bg-3); overflow: hidden;
  }
  .story-avatar.has-status {
    background: conic-gradient(var(--accent) 0deg 180deg, var(--accent-hover) 180deg 360deg);
    padding: 2px;
  }
  .story-avatar img { width: 100%; height: 100%; border-radius: 50%; object-fit: cover; background: var(--bg); }
  .your-story { position: relative; }
  .story-plus {
    position: absolute; bottom: -1px; right: -1px;
    width: 20px; height: 20px; border-radius: 50%;
    background: var(--accent); display: flex; align-items: center; justify-content: center;
    border: 2px solid var(--bg-2);
  }
  .story-label { font-size: 10px; color: var(--text-2); white-space: nowrap; }

  .sub-tabs {
    display: flex; gap: 0; padding: 0; background: var(--bg-2);
    border-bottom: 1px solid var(--border); flex-shrink: 0;
  }
  .sub-tab {
    flex: 1; display: flex; align-items: center; justify-content: center;
    gap: 6px; padding: 10px 0; background: none; border: none;
    color: var(--text-2); font-size: 13px; font-weight: 500; cursor: pointer;
    border-bottom: 2px solid transparent; transition: all 0.2s;
  }
  .sub-tab.active { color: var(--accent); border-bottom-color: var(--accent); }
  .sub-tab .badge {
    font-size: 10px; padding: 1px 6px; border-radius: 10px;
    background: var(--bg-3); color: var(--text-2); font-weight: 600;
  }
  .sub-tab .badge.active { background: var(--accent); color: #000; }

  .chat-list { flex: 1; overflow-y: auto; }
  .chat-item {
    display: flex; align-items: center; gap: 12px;
    padding: 12px 16px; cursor: pointer;
    transition: background 0.15s; border-bottom: 1px solid var(--border-2);
  }
  .chat-item:hover { background: var(--bg-2); }
  .chat-avatar-wrap { position: relative; flex-shrink: 0; }
  .chat-avatar { width: 48px; height: 48px; border-radius: 50%; object-fit: cover; }
  .status-indicator {
    position: absolute; bottom: 1px; right: 1px;
    width: 12px; height: 12px; border-radius: 50%;
    border: 2px solid var(--bg); transition: background 0.2s;
  }
  .status-indicator.online { background: var(--online); }
  .status-indicator.offline { background: var(--offline); }
  .status-indicator.dnd { background: var(--dnd); }
  .chat-info { flex: 1; min-width: 0; }
  .chat-top, .chat-bottom { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .chat-top { margin-bottom: 4px; }
  .chat-name { font-size: 15px; font-weight: 600; color: var(--text); }
  .chat-time { font-size: 10px; color: var(--text-3); white-space: nowrap; }
  .chat-preview {
    font-size: 13px; color: var(--text-2);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1;
  }
  .unread-badge {
    font-size: 11px; font-weight: 700; color: #000;
    min-width: 18px; height: 18px; border-radius: 9px;
    background: var(--accent); display: flex; align-items: center; justify-content: center;
    padding: 0 4px; flex-shrink: 0;
  }
  .empty-state {
    display: flex; flex-direction: column; align-items: center;
    justify-content: center; padding: 64px 24px; gap: 12px;
  }
  .empty-state p { color: var(--text-3); font-size: 14px; }
</style>
