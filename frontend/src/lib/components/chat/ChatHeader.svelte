<script lang="ts">
  import Icon from '$lib/icon/Icon.svelte';
  import type { IconName } from '$lib/icon/icons';
  import { avatarUrl, formatLastSeen } from '$lib/helpers';
  import type { Chat } from '$lib/types';

  let {
    chatInfo,
    typing,
    otherOnline,
    otherLastSeen,
    otherMember,
    onBack,
    onShowCallOptions,
    onShowChatMenu,
    onContactClick,
  }: {
    chatInfo: Chat | null;
    typing: string;
    otherOnline: boolean;
    otherLastSeen: string;
    otherMember: any;
    onBack?: () => void;
    onShowCallOptions?: () => void;
    onShowChatMenu?: () => void;
    onContactClick?: () => void;
  } = $props();
</script>

<div class="app-header chat-header">
  <button class="back-btn" onclick={onBack}>
    <Icon name="chevron-left" size={24} />
  </button>
  <div class="chat-header-info" onclick={onContactClick}>
    <img src={avatarUrl(chatInfo?.type === 'private' ? (otherMember?.id || chatInfo?.id) : chatInfo?.id, chatInfo?.type === 'private' ? otherMember?.avatar : chatInfo?.avatar)} alt="" class="chat-header-avatar" />
    <div>
      <span class="chat-header-name">{chatInfo?.type === 'private' ? (otherMember?.display_name || chatInfo?.name || 'Chat') : (chatInfo?.name || 'Chat')}</span>
      <span class="chat-header-status">{typing || (otherOnline ? 'En línea' : chatInfo?.type === 'group' ? chatInfo?.members?.length ? `${chatInfo.members.length} miembros` : 'Grupo' : otherLastSeen ? 'últ. vez ' + formatLastSeen(otherLastSeen) : '')}</span>
    </div>
  </div>
  <div class="chat-header-actions">
    {#if chatInfo?.type === 'private'}
      <button class="icon-btn" onclick={onShowCallOptions} title="Llamar">
        <Icon name="phone" size={18} />
      </button>
    {/if}
    <button class="icon-btn" onclick={onShowChatMenu} title="Más opciones">
      <Icon name="more-v" size={20} />
    </button>
  </div>
</div>

<style>
  .chat-header { display: flex; align-items: center; gap: 10px; padding: 10px 12px; background: var(--bg-2); border-bottom: 1px solid var(--border); }
  .back-btn { background: none; border: none; color: var(--text); cursor: pointer; padding: 4px; display: flex; align-items: center; justify-content: center; }
  .chat-header-info { display: flex; align-items: center; gap: 10px; flex: 1; cursor: pointer; }
  .chat-header-avatar { width: 36px; height: 36px; border-radius: 50%; object-fit: cover; }
  .chat-header-name { font-size: 15px; font-weight: 600; color: var(--text); display: block; }
  .chat-header-status { font-size: 11px; color: var(--text-3); display: block; }
  .chat-header-actions { display: flex; align-items: center; gap: 2px; }
  .icon-btn { background: none; border: none; color: var(--text-2); cursor: pointer; padding: 6px; border-radius: 50%; display: flex; align-items: center; justify-content: center; transition: background 0.2s; }
  .icon-btn:hover { background: var(--border); }
</style>