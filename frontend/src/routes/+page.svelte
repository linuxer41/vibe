<script lang="ts">
  import { goto } from '$app/navigation';
  import DefaultLayout from '$lib/layouts/DefaultLayout.svelte';
  import {
    user, socket, chats, contacts, posts, subTab,
    pinnedChats, regularChats, groupChats,
    showNewChat, showCreateGroup, unreadNotifications
  } from '$lib/stores';
  import Icon from '$lib/icon/Icon.svelte';
  import IconButton from '$lib/components/IconButton.svelte';
  import HeaderAvatar from '$lib/components/HeaderAvatar.svelte';
  import ChatListItem from '$lib/components/chat-home/ChatListItem.svelte';
  import StoriesBar from '$lib/components/chat-home/StoriesBar.svelte';
  import InboxTabs from '$lib/components/chat-home/InboxTabs.svelte';
  import ChatEmptyState from '$lib/components/chat-home/ChatEmptyState.svelte';
  import type { User, Chat } from '$lib/types';

  let usr: User | null = $state(null);
  let sk: any = $state(null);
  user.subscribe((v) => usr = v);
  socket.subscribe((v) => sk = v);

  let userId = $derived(usr?.id || 0);

  let tabs = $derived([
    { key: 'pinned', label: 'Pinned', icon: 'star', count: $pinnedChats.length },
    { key: 'chats', label: 'Chats', count: $regularChats.length },
    { key: 'groups', label: 'Groups', count: $groupChats.length }
  ]);

  let visibleChats = $derived.by(() => {
    const tab = $subTab;
    if (tab === 'pinned') return { chats: $pinnedChats, key: 'pinned' as const };
    if (tab === 'groups') return { chats: $groupChats, key: 'groups' as const };
    return { chats: $regularChats, key: 'chats' as const };
  });

  function newItem() {
    if ($subTab === 'groups') showCreateGroup.set(true);
    else showNewChat.set(true);
  }
</script>

<DefaultLayout title="Vibe">
  {#snippet rightContent()}
    <IconButton name="search" size={20} onclick={newItem} />
    <HeaderAvatar {userId} avatar={usr?.avatar} notificationCount={$unreadNotifications} onclick={() => goto('/profile')} />
  {/snippet}

  <StoriesBar {userId} avatar={usr?.avatar} />

  <InboxTabs tabs={tabs} active={$subTab} onTabChange={(k) => subTab.set(k as 'pinned' | 'chats' | 'groups')} />

  <div class="chat-list">
    {#each visibleChats.chats as chat (chat.id)}
      <ChatListItem {chat} {userId} onclick={() => goto(`/chat?id=${chat.id}`, { noScroll: true })} />
    {/each}

    {#if visibleChats.chats.length === 0}
      {#if visibleChats.key === 'pinned'}
        <ChatEmptyState icon="star" title="No pinned chats" hint="Long-press a chat to pin it" blob={1} />
      {:else if visibleChats.key === 'groups'}
        <ChatEmptyState icon="users" title="No groups" hint="Create a group to chat with multiple contacts" blob={2} />
      {:else}
        <ChatEmptyState icon="message" title="No chats yet" hint="Tap + to start a conversation" blob={3} />
      {/if}
    {/if}
  </div>

  <button class="fab" onclick={newItem}>
    <Icon name="plus" />
    <span>New</span>
  </button>
</DefaultLayout>

<style>
  .fab {
    position: fixed; bottom: calc(80px + var(--safe-area-bottom)); right: calc(50% - 215px + 16px);
    display: flex; align-items: center; justify-content: center; gap: 8px;
    padding: 15px 24px; min-height: 52px;
    background: var(--accent); color: #000; border: none; border-radius: 12px;
    font-size: 16px; font-weight: 700; cursor: pointer;
    box-shadow: 0 4px 20px var(--shadow-accent); z-index: 10;
    transition: background 0.2s, transform 0.15s;
  }
  .fab:hover { background: var(--accent-hover); }
  .fab:active { transform: scale(0.98); }
  @media (max-width: 430px) { .fab { right: 16px; } }
  .chat-list { flex: 1; overflow-y: auto; display: flex; flex-direction: column; }
</style>
