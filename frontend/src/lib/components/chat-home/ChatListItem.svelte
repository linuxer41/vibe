<script lang="ts">
  import { avatarUrl, formatDate } from '$lib/helpers';
  import { contacts } from '$lib/stores';
  import Icon from '$lib/icon/Icon.svelte';
  import type { Chat, User } from '$lib/types';

  let {
    chat,
    userId,
    onclick
  }: {
    chat: Chat;
    userId: number;
    onclick?: () => void | Promise<void>;
  } = $props();

  let status = $derived.by(() => {
    if (chat.type === 'group' || !chat.members) return '';
    const otherId = chat.members.find((m: any) => m.id !== userId)?.id;
    if (!otherId) return '';
    const c = $contacts.find((c: User) => c.id === otherId);
    return c?.online ? 'online' : '';
  });

  let avatarSrc = $derived(
    chat.type === 'private'
      ? avatarUrl(chat.members?.[0]?.id || chat.id, chat.members?.[0]?.avatar)
      : avatarUrl(chat.id, chat.avatar)
  );
</script>

<div class="chat-item" role="button" tabindex="0" {onclick} onkeydown={(e) => e.key === 'Enter' && onclick?.()}>
  <div class="chat-avatar-wrap">
    <img src={avatarSrc} alt="" class="chat-avatar" />
    <div class="status-indicator {status || 'offline'}"></div>
  </div>
  <div class="chat-info">
    <div class="chat-top">
      <span class="chat-name">{chat.name}</span>
      <span class="chat-time">{chat.last_message_time ? formatDate(chat.last_message_time) : ''}</span>
    </div>
    <div class="chat-bottom">
      <span class="chat-preview">
        {#if chat.last_sender_id === userId}
          <Icon
            name={chat.last_message_status === 'read' ? 'check-double' : 'check'}
            size={14}
            style="color: {chat.last_message_status === 'read' ? 'var(--check-read)' : 'var(--check-sent)'};margin-right:2px;vertical-align:middle"
          />
        {/if}
        {chat.last_message || ''}
      </span>
      {#if chat.unread && chat.unread > 0}
        <span class="unread-badge">{chat.unread}</span>
      {/if}
    </div>
  </div>
</div>

<style>
  .chat-item {
    display: flex; align-items: center; gap: 12px;
    padding: 12px 16px; cursor: pointer;
    transition: background 0.15s; border-bottom: 1px solid var(--border-2);
  }
  .chat-item:hover { background: var(--bg-2); }
  .chat-item:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
  .chat-avatar-wrap { position: relative; flex-shrink: 0; }
  .chat-avatar { width: 48px; height: 48px; border-radius: 50%; object-fit: cover; }
  .status-indicator {
    position: absolute; bottom: 1px; right: 1px;
    width: 12px; height: 12px; border-radius: 50%;
    border: 2px solid var(--bg-2);
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
</style>
