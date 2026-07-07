<script lang="ts">
  import Icon from '$lib/icon/Icon.svelte';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { avatarUrl, formatTime, formatDateHeader, shouldShowDate, scrollToBottom, loadMyStickers } from '$lib/helpers';
  import { user, socket, messages, typingText, activeChat, chatInput, chats, myStickers, showToast, activeCall } from '$lib/stores';
  import type { Chat, Message, User as UserType, Sticker } from '$lib/types';
  import CallOverlay from '$lib/components/CallOverlay.svelte';

  let usr: UserType | null = $state(null);
  let sk: any = $state(null);
  let msgs: Message[] = $state([]);
  let chatInfo: Chat | null = $state(null);
  let typing = $state('');
  let input = $state('');
  let messagesEl: HTMLDivElement | undefined = $state();
  let showSearch = $state(false);
  let searchQuery = $state('');
  let searchResults: Message[] = $state([]);
  let searching = $state(false);
  let contextMsg: Message | null = $state(null);
  let showForward = $state(false);
  let forwardMsg: Message | null = $state(null);
  let chatList: Chat[] = $state([]);
  let showStickers = $state(false);
  let myStkr: Sticker[] = $state([]);

  user.subscribe((v) => usr = v);
  socket.subscribe((v) => sk = v);
  messages.subscribe((v) => msgs = v);
  typingText.subscribe((v) => typing = v);
  chatInput.subscribe((v) => input = v);
  chats.subscribe((v) => chatList = v);
  myStickers.subscribe((v) => myStkr = v);

  const chatId = $derived(Number($page.url.searchParams.get('id')));

  onMount(() => {
    if (!sk || !chatId) return;
    sk.emit('join_chat', { chatId });
    sk.emit('get_messages', { chatId }, (list: Message[]) => {
      messages.set(list);
      list.forEach((m) => sk?.emit('mark_read', { messageId: m.id }));
      scrollToBottom(messagesEl);
    });
    sk.emit('get_chats', null, (chatsArr: Chat[]) => {
      const found = chatsArr.find((c) => c.id === chatId);
      if (found) { chatInfo = found; activeChat.set(found); }
    });

    return () => {
      sk?.emit('leave_chat', { chatId });
      messages.set([]);
      activeChat.set(null);
    };
  });

  function sendMessage() {
    if (!input.trim() || !sk || !chatId) return;
    sk.emit('send_message', { chatId, text: input, type: 'text' }, () => {});
    chatInput.set('');
    input = '';
    sk.emit('stop_typing', { chatId });
    scrollToBottom(messagesEl);
  }

  function toggleStickers() {
    showStickers = !showStickers;
    if (showStickers) loadMyStickers();
  }

  function sendSticker(sticker: Sticker) {
    if (!sk || !chatId) return;
    sk.emit('send_message', { chatId, text: sticker.image_url, type: 'image' }, () => {});
    showStickers = false;
    scrollToBottom(messagesEl);
  }

  function onChatInput() {
    if (!chatId) return;
    sk?.emit('typing', { chatId });
    clearTimeout((window as any)._typingTimer);
    (window as any)._typingTimer = setTimeout(() => sk?.emit('stop_typing', { chatId }), 1000);
  }

  function doSearch() {
    const q = searchQuery.trim();
    if (!q || !sk || !chatId) { searchResults = []; return; }
    searching = true;
    sk.emit('search_messages', { chatId, query: q }, (list: Message[]) => {
      searchResults = list || [];
      searching = false;
    });
  }

  function openContext(e: MouseEvent, msg: Message) {
    e.stopPropagation();
    contextMsg = contextMsg?.id === msg.id ? null : msg;
  }

  function closeContext() {
    contextMsg = null;
  }

  function deleteMessage(msg: Message) {
    if (!sk) return;
    sk.emit('delete_message', { messageId: msg.id }, (res: any) => {
      if (res?.ok) {
        messages.update((m: Message[]) => m.filter((x) => x.id !== msg.id));
        showToast('Mensaje eliminado');
      } else {
        showToast('No se pudo eliminar el mensaje');
      }
    });
    closeContext();
  }

  function openForward(msg: Message) {
    forwardMsg = msg;
    showForward = true;
    closeContext();
  }

  function startVoiceCall() {
    if (!chatInfo || chatInfo.type !== 'private' || !chatInfo.members?.[0]) return;
    const peer = chatInfo.members[0];
    activeCall.set({
      callId: 0,
      peerId: peer.id,
      peerName: chatInfo.name,
      type: 'audio',
      direction: 'outgoing',
      status: 'ringing',
      muted: false,
      speakerOn: false,
    });
  }

  function startVideoCall() {
    if (!chatInfo || chatInfo.type !== 'private' || !chatInfo.members?.[0]) return;
    const peer = chatInfo.members[0];
    activeCall.set({
      callId: 0,
      peerId: peer.id,
      peerName: chatInfo.name,
      type: 'video',
      direction: 'outgoing',
      status: 'ringing',
      muted: false,
      speakerOn: false,
    });
  }

  function doForward(targetChatId: number) {
    if (!sk || !forwardMsg) return;
    sk.emit('forward_message', { messageId: forwardMsg.id, targetChatId }, (res: any) => {
      if (res?.ok) {
        showToast('Mensaje reenviado');
      }
    });
    showForward = false;
    forwardMsg = null;
  }
</script>

<div class="chat-view" onclick={closeContext}>
  <div class="chat-header">
    <button class="back-btn" onclick={() => goto('/')}>
        <Icon name="chevron-left" size={24} />
    </button>

    {#if showSearch}
      <div class="search-bar">
        <Icon name="search" size={16} style="color: var(--text-3)" />
        <input type="text" bind:value={searchQuery} placeholder="Buscar en el chat..." oninput={doSearch} />
        <button class="icon-btn" onclick={() => { showSearch = false; searchQuery = ''; searchResults = []; }}>
          <Icon name="x" size={18} />
        </button>
      </div>
    {:else}
      <img src={avatarUrl(chatInfo?.type === 'private' ? (chatInfo?.members?.[0]?.id || chatId) : chatId)} alt="" class="chat-header-avatar" />
      <div class="chat-header-info">
        <span class="chat-header-name">{chatInfo?.name || 'Chat'}</span>
        <span class="chat-header-status">{typing || 'En línea'}</span>
      </div>
      <button class="icon-btn" onclick={() => showSearch = true}>
        <Icon name="search" size={20} />
      </button>
      <button class="icon-btn" onclick={startVideoCall}>
        <Icon name="video" size={22} />
      </button>
      <button class="icon-btn" onclick={startVoiceCall}>
        <Icon name="phone" size={22} />
      </button>
      <button class="icon-btn">
        <Icon name="more-v" size={20} variant="filled" />
      </button>
    {/if}
  </div>

  <div class="messages" bind:this={messagesEl} onclick={closeContext}>
    {#if showSearch && searchQuery.trim()}
      {#if searching}
        <div class="search-status">Buscando...</div>
      {:else if searchResults.length === 0}
        <div class="search-status">Sin resultados</div>
      {:else}
        <div class="search-count">{searchResults.length} resultados</div>
        {#each searchResults as msg}
          <div class="msg" class:own={msg.sender_id === usr?.id} class:other={msg.sender_id !== usr?.id}>
            {#if msg.type === 'image'}
              <img src={msg.text} alt="" class="msg-image" loading="lazy" />
            {:else}
              <div class="msg-bubble">
                <div class="msg-text">{msg.text}</div>
                <div class="msg-meta">
                  <span class="msg-time">{formatTime(msg.created_at)}</span>
                </div>
              </div>
            {/if}
          </div>
        {/each}
      {/if}
    {:else}
      {#each msgs as msg, i}
        {#if shouldShowDate(msg.created_at, i, msgs)}
          <div class="date-separator">{formatDateHeader(msg.created_at)}</div>
        {/if}
        <div class="msg" class:own={msg.sender_id === usr?.id} class:other={msg.sender_id !== usr?.id} class:image={msg.type === 'image'}>
          {#if msg.type === 'system'}
            <div class="msg-system">{msg.text}</div>
          {:else if msg.type === 'image'}
            <img src={msg.text} alt="" class="msg-image" loading="lazy" />
            <div class="msg-time">{formatTime(msg.created_at)}</div>
          {:else}
            {#if msg.sender_id !== usr?.id && chatInfo?.type === 'group'}
              <div class="msg-sender">{msg.sender_name}</div>
            {/if}
            <div class="msg-bubble" onclick={(e) => e.stopPropagation()}>
              {#if msg.reply_to_id}
                <div class="msg-reply-bar">Respondiendo a un mensaje</div>
              {/if}
              {#if msg.forwarded}
                <div class="msg-forwarded">
                  <Icon name="forward" size={12} variant="filled" />
                  Reenviado
                </div>
              {/if}
              <div class="msg-text">{msg.text}</div>
              <div class="msg-meta">
                <span class="msg-time">{formatTime(msg.created_at)}</span>
                {#if msg.sender_id === usr?.id}
                  <Icon name="check" size={14} variant="filled" style="color: #53bdeb" />
                {/if}
              </div>
            </div>
            {#if msg.sender_id === usr?.id}
              <button class="msg-ctx-trigger" onclick={(e) => openContext(e, msg)}>
                <Icon name="more-v" size={14} variant="filled" />
              </button>
            {/if}
          {/if}
        </div>
      {/each}
    {/if}
  </div>

  {#if contextMsg}
    <div class="ctx-menu" onclick={(e) => e.stopPropagation()}>
      {#if contextMsg.sender_id === usr?.id}
        <button class="ctx-btn ctx-danger" onclick={() => deleteMessage(contextMsg!)}>
          <Icon name="trash" size={16} />
          Eliminar mensaje
        </button>
      {/if}
      <button class="ctx-btn" onclick={() => openForward(contextMsg!)}>
        <Icon name="forward" size={16} />
        Reenviar
      </button>
    </div>
  {/if}

  <div class="typing-indicator" class:visible={typing !== ''}>{typing}</div>

  <div class="input-bar">
    <button class="icon-btn" onclick={toggleStickers}>
      <Icon name="image" size={22} style="color: var(--text-3)" />
    </button>
    <div class="input-wrap">
      <button class="icon-btn input-icon">
        <Icon name="link" size={20} style="color: var(--text-3)" />
      </button>
      <input type="text" bind:value={input} placeholder="Message" onkeydown={(e) => e.key === 'Enter' && sendMessage()} oninput={(e) => { chatInput.set((e.target as HTMLInputElement).value); onChatInput(); }} />
      <button class="icon-btn input-icon">
        <Icon name="globe" size={20} style="color: var(--text-3)" />
      </button>
    </div>
    <button class="mic-btn" onclick={sendMessage}>
      {#if input.trim()}
        <Icon name="send" size={20} strokeWidth={2.5} style="color: #fff" />
      {:else}
        <Icon name="mic" size={20} variant="filled" style="color: #fff" />
      {/if}
    </button>
  </div>
</div>

  {#if showStickers}
    <div class="sticker-overlay" onclick={() => showStickers = false}>
      <div class="sticker-sheet" onclick={(e) => e.stopPropagation()}>
        <div class="sticker-header">
          <h3>Stickers</h3>
          <button class="icon-btn" onclick={() => showStickers = false}>
            <Icon name="x" size={20} />
          </button>
        </div>
        <div class="sticker-grid">
          {#each myStkr as s (s.id)}
            <button class="sticker-item" onclick={() => sendSticker(s)}>
              <img src={s.image_url} alt={s.emoji} class="sticker-img" loading="lazy" />
            </button>
          {/each}
          {#if myStkr.length === 0}
            <div class="sticker-empty">
              <p>No tienes stickers</p>
              <button class="sticker-shop-btn" onclick={() => { showStickers = false; goto('/sticker-shop'); }}>
                <Icon name="cart" size={16} />
                Tienda de Stickers
              </button>
            </div>
          {:else}
            <button class="sticker-shop-link" onclick={() => { showStickers = false; goto('/sticker-shop'); }}>
              <Icon name="cart" size={16} />
              Tienda de Stickers
            </button>
          {/if}
        </div>
      </div>
    </div>
  {/if}

  {#if showForward}
  <div class="forward-overlay" onclick={() => { showForward = false; forwardMsg = null; }}>
    <div class="forward-sheet" onclick={(e) => e.stopPropagation()}>
      <div class="forward-header">
        <h3>Reenviar mensaje</h3>
        <button class="icon-btn" onclick={() => { showForward = false; forwardMsg = null; }}>
          <Icon name="x" size={20} />
        </button>
      </div>
      <div class="forward-list">
        {#each chatList.filter(c => c.id !== chatId) as c}
          <button class="forward-item" onclick={() => doForward(c.id)}>
            <img src={avatarUrl(c.type === 'private' ? (c.members?.[0]?.id || c.id) : c.id)} alt="" class="forward-avatar" />
            <span>{c.name}</span>
          </button>
        {/each}
      </div>
    </div>
  </div>
{/if}

<CallOverlay />

<style>
  .chat-view { height: 100dvh; display: flex; flex-direction: column; background: var(--bg-chat); max-width: 430px; margin: 0 auto; position: relative; }
  :global([data-theme="dark"]) .chat-view { background-image: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" opacity="0.05"><circle cx="16" cy="16" r="16" fill="white"/></svg>'); background-size: 32px; }
  :global([data-theme="light"]) .chat-view { background-image: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" opacity="0.05"><circle cx="16" cy="16" r="16" fill="black"/></svg>'); background-size: 32px; }
  .chat-header { display: flex; align-items: center; gap: 10px; padding: 10px 12px; background: var(--bg-2); flex-shrink: 0; border-bottom: 1px solid var(--border); }
  .back-btn { background: none; border: none; color: var(--text); cursor: pointer; padding: 4px; display: flex; align-items: center; justify-content: center; }
  .chat-header-avatar { width: 36px; height: 36px; border-radius: 50%; object-fit: cover; }
  .chat-header-info { flex: 1; min-width: 0; }
  .chat-header-name { font-size: 16px; font-weight: 600; color: var(--text); display: block; }
  .chat-header-status { font-size: 11px; color: var(--accent); }
  .icon-btn { background: none; border: none; color: var(--text-2); cursor: pointer; padding: 6px; border-radius: 50%; display: flex; align-items: center; justify-content: center; transition: background 0.2s; }
  .icon-btn:hover { background: var(--border); }
  .search-bar { display: flex; align-items: center; gap: 8px; flex: 1; background: var(--bg-3); border-radius: 8px; padding: 4px 8px; }
  .search-bar input { flex: 1; background: none; border: none; outline: none; font-size: 14px; color: var(--text); }
  .search-bar input::placeholder { color: var(--text-3); }
  .search-status { align-self: center; color: var(--text-3); font-size: 13px; padding: 20px 0; }
  .search-count { align-self: center; color: var(--text-3); font-size: 12px; padding: 8px 0; }
  .messages { flex: 1; overflow-y: auto; padding: 16px 12px; display: flex; flex-direction: column; gap: 2px; scroll-behavior: smooth; }
  .date-separator { align-self: center; font-size: 11px; color: var(--text-3); background: rgba(0,0,0,0.2); padding: 4px 12px; border-radius: 8px; margin: 12px 0; }
  :global([data-theme="light"]) .date-separator { background: rgba(0,0,0,0.04); }
  .msg { display: flex; flex-direction: column; max-width: 75%; position: relative; animation: msgIn 0.15s ease-out; }
  @keyframes msgIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
  .msg.own { align-self: flex-end; }
  .msg.image { max-width: 70%; }
  .msg-system { align-self: center; background: rgba(0,0,0,0.15); color: var(--text-2); font-size: 12px; padding: 6px 16px; text-align: center; border-radius: 8px; margin: 8px 0; max-width: 70%; }
  .msg-sender { font-size: 11px; font-weight: 600; color: var(--accent); margin-bottom: 2px; padding: 0 12px; }
  .msg-bubble {
    padding: 7px 10px 7px 12px;
    border-radius: var(--bubble-radius) var(--bubble-radius) var(--bubble-radius) 4px;
    word-wrap: break-word; line-height: 1.45; font-size: 14px;
    box-shadow: 0 1px 1px rgba(0,0,0,0.1);
    position: relative;
  }
  .own .msg-bubble {
    background: var(--bubble-own); color: #e9edef;
    border-radius: var(--bubble-radius) var(--bubble-radius) 4px var(--bubble-radius);
  }
  :global([data-theme="light"]) .own .msg-bubble { color: var(--text); }
  :global([data-theme="light"]) .msg-bubble { box-shadow: 0 1px 1px rgba(0,0,0,0.06); }
  .other .msg-bubble { background: var(--bubble-other); }
  .msg-reply-bar { border-left: 3px solid var(--accent); padding-left: 8px; margin-bottom: 4px; font-size: 11px; color: var(--text-3); }
  .msg-forwarded { display: flex; align-items: center; gap: 3px; font-size: 11px; color: var(--text-3); margin-bottom: 2px; }
  .msg-text { white-space: pre-wrap; padding-right: 4px; }
  .msg-meta { display: flex; align-items: center; justify-content: flex-end; gap: 3px; margin-top: 2px; }
  .msg-time { font-size: 10px; color: rgba(255,255,255,0.45); }
  .own .msg-time { color: rgba(233,237,239,0.6); }
  :global([data-theme="light"]) .msg-time { color: rgba(0,0,0,0.4); }
  :global([data-theme="light"]) .own .msg-time { color: rgba(0,0,0,0.45); }
  .msg-image { width: 100%; border-radius: 16px; display: block; }
  .msg-ctx-trigger {
    position: absolute; top: 0; right: -28px; background: none; border: none;
    color: var(--text-3); cursor: pointer; padding: 4px; display: none;
    opacity: 0.5; transition: opacity 0.2s;
  }
  .msg:hover .msg-ctx-trigger { display: flex; }
  .msg-ctx-trigger:hover { opacity: 1; }
  .ctx-menu {
    position: absolute; bottom: 60px; right: 12px;
    background: var(--bg-2); border: 1px solid var(--border);
    border-radius: 12px; padding: 4px; box-shadow: 0 4px 20px var(--shadow);
    z-index: 10; display: flex; flex-direction: column; min-width: 180px;
  }
  .ctx-btn {
    display: flex; align-items: center; gap: 10px;
    padding: 10px 14px; background: none; border: none;
    font-size: 14px; color: var(--text); cursor: pointer;
    border-radius: 8px; transition: background 0.15s; text-align: left;
  }
  .ctx-btn:hover { background: var(--bg-3); }
  .ctx-danger { color: var(--danger); }
  .ctx-danger:hover { background: rgba(255,59,48,0.1); }
  .typing-indicator { padding: 4px 16px; font-size: 11px; color: var(--accent); min-height: 24px; flex-shrink: 0; visibility: hidden; font-style: italic; }
  .typing-indicator.visible { visibility: visible; }
  .input-bar { display: flex; align-items: center; gap: 6px; padding: 8px 12px 10px; background: var(--bg-2); flex-shrink: 0; border-top: 1px solid var(--border); }
  .input-wrap { flex: 1; display: flex; align-items: center; background: var(--bg-3); border-radius: var(--input-radius); padding: 0 4px; }
  .input-icon { flex-shrink: 0; }
  .input-wrap input { flex: 1; background: none; border: none; outline: none; padding: 10px 4px; font-size: 15px; color: var(--text); }
  .input-wrap input::placeholder { color: var(--text-3); }
  .mic-btn { width: 40px; height: 40px; border-radius: 50%; background: var(--accent); border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: background 0.2s; }
  .mic-btn:hover { background: var(--accent-hover); }
  .forward-overlay {
    position: fixed; inset: 0; background: rgba(0,0,0,0.6);
    display: flex; align-items: flex-end; justify-content: center;
    z-index: 100; padding: 24px;
  }
  .forward-sheet {
    background: var(--bg-2); border-radius: 16px 16px 0 0;
    width: 100%; max-width: 400px; max-height: 60dvh;
    display: flex; flex-direction: column;
    box-shadow: 0 -8px 32px var(--shadow);
  }
  .forward-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 16px 20px; border-bottom: 1px solid var(--border);
  }
  .forward-header h3 { font-size: 17px; font-weight: 600; color: var(--text); margin: 0; }
  .forward-list { flex: 1; overflow-y: auto; padding: 8px; }
  .forward-item {
    display: flex; align-items: center; gap: 12px;
    width: 100%; padding: 12px; background: none; border: none;
    cursor: pointer; border-radius: 10px; transition: background 0.15s;
    color: var(--text); font-size: 15px; font-weight: 500;
  }
  .forward-item:hover { background: var(--bg-3); }
  .forward-avatar { width: 40px; height: 40px; border-radius: 50%; object-fit: cover; }

  .sticker-overlay {
    position: fixed; inset: 0; background: rgba(0,0,0,0.6);
    display: flex; align-items: flex-end; justify-content: center;
    z-index: 100; padding: 12px;
  }
  .sticker-sheet {
    background: var(--bg-2); border-radius: 16px 16px 0 0;
    width: 100%; max-width: 400px; max-height: 50dvh;
    display: flex; flex-direction: column;
    box-shadow: 0 -8px 32px var(--shadow);
  }
  .sticker-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 14px 16px; border-bottom: 1px solid var(--border);
  }
  .sticker-header h3 { font-size: 16px; font-weight: 600; color: var(--text); margin: 0; }
  .sticker-grid {
    flex: 1; overflow-y: auto; padding: 12px;
    display: flex; flex-wrap: wrap; gap: 8px; align-content: flex-start;
  }
  .sticker-item {
    width: calc(25% - 6px); aspect-ratio: 1;
    background: var(--bg-3); border-radius: 12px; border: none;
    cursor: pointer; padding: 4px; display: flex; align-items: center; justify-content: center;
    transition: background 0.15s;
  }
  .sticker-item:hover { background: var(--accent); }
  .sticker-img { width: 100%; height: 100%; object-fit: contain; }
  .sticker-empty {
    width: 100%; display: flex; flex-direction: column;
    align-items: center; gap: 12px; padding: 32px 16px;
  }
  .sticker-empty p { color: var(--text-3); font-size: 14px; margin: 0; }
  .sticker-shop-btn {
    display: flex; align-items: center; gap: 6px;
    padding: 10px 20px; background: var(--accent); color: #000;
    border: none; border-radius: 10px; font-size: 14px; font-weight: 600;
    cursor: pointer; font-family: inherit;
  }
  .sticker-shop-link {
    width: 100%; display: flex; align-items: center; justify-content: center;
    gap: 6px; padding: 10px; margin-top: 4px;
    background: none; border: none; color: var(--accent);
    font-size: 13px; font-weight: 600; cursor: pointer; border-radius: 8px;
    transition: background 0.15s; font-family: inherit;
  }
  .sticker-shop-link:hover { background: var(--bg-3); }
</style>
