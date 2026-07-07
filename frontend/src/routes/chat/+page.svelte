<script lang="ts">
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
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M15 18l-6-6 6-6"/></svg>
    </button>

    {#if showSearch}
      <div class="search-bar">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
        <input type="text" bind:value={searchQuery} placeholder="Buscar en el chat..." oninput={doSearch} />
        <button class="icon-btn" onclick={() => { showSearch = false; searchQuery = ''; searchResults = []; }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </div>
    {:else}
      <img src={avatarUrl(chatInfo?.type === 'private' ? (chatInfo?.members?.[0]?.id || chatId) : chatId)} alt="" class="chat-header-avatar" />
      <div class="chat-header-info">
        <span class="chat-header-name">{chatInfo?.name || 'Chat'}</span>
        <span class="chat-header-status">{typing || 'En línea'}</span>
      </div>
      <button class="icon-btn" onclick={() => showSearch = true}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
      </button>
      <button class="icon-btn" onclick={startVideoCall}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M23 7l-7.5 3.5L23 7z"/><rect x="1" y="5" width="16" height="14" rx="2" ry="2"/></svg>
      </button>
      <button class="icon-btn" onclick={startVoiceCall}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
      </button>
      <button class="icon-btn">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>
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
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M14 5v4C7 9 4 15 2 19c3-3 6-5 12-5v4l8-7-8-7z"/></svg>
                  Reenviado
                </div>
              {/if}
              <div class="msg-text">{msg.text}</div>
              <div class="msg-meta">
                <span class="msg-time">{formatTime(msg.created_at)}</span>
                {#if msg.sender_id === usr?.id}
                  <svg width="14" height="14" viewBox="0 0 16 11" fill="#53bdeb"><path d="M11.071.653a.457.457 0 0 0-.304-.102.493.493 0 0 0-.381.178l-5.94 6.35-2.63-2.63a.458.458 0 0 0-.65.05.46.46 0 0 0-.05.56l2.92 3.32a.47.47 0 0 0 .35.18h.02a.47.47 0 0 0 .35-.15l6.38-6.81a.45.45 0 0 0-.075-.66z"/></svg>
                {/if}
              </div>
            </div>
            {#if msg.sender_id === usr?.id}
              <button class="msg-ctx-trigger" onclick={(e) => openContext(e, msg)}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><circle cx="8" cy="3" r="1.5"/><circle cx="8" cy="8" r="1.5"/><circle cx="8" cy="13" r="1.5"/></svg>
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
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          Eliminar mensaje
        </button>
      {/if}
      <button class="ctx-btn" onclick={() => openForward(contextMsg!)}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M14 5v4C7 9 4 15 2 19c3-3 6-5 12-5v4l8-7-8-7z"/></svg>
        Reenviar
      </button>
    </div>
  {/if}

  <div class="typing-indicator" class:visible={typing !== ''}>{typing}</div>

  <div class="input-bar">
    <button class="icon-btn" onclick={toggleStickers}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" stroke-width="2" stroke-linecap="round"><path d="M16 21a5 5 0 0 0 5-5V8a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h11z"/><path d="M9 14a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/><path d="M10 11h.01"/></svg>
    </button>
    <div class="input-wrap">
      <button class="icon-btn input-icon">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" stroke-width="2" stroke-linecap="round"><path d="M15 3h6v6M21 3l-7 7M3 21l7-7"/></svg>
      </button>
      <input type="text" bind:value={input} placeholder="Message" onkeydown={(e) => e.key === 'Enter' && sendMessage()} oninput={(e) => { chatInput.set((e.target as HTMLInputElement).value); onChatInput(); }} />
      <button class="icon-btn input-icon">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
      </button>
    </div>
    <button class="mic-btn" onclick={sendMessage}>
      {#if input.trim()}
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
      {:else}
        <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M12 14a4 4 0 0 0 4-4V6a4 4 0 0 0-8 0v4a4 4 0 0 0 4 4z"/><path d="M19 10a7 7 0 0 1-14 0H3a9 9 0 0 0 8 8.94V22h2v-3.06A9 9 0 0 0 21 10h-2z"/></svg>
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
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
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
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
                Tienda de Stickers
              </button>
            </div>
          {:else}
            <button class="sticker-shop-link" onclick={() => { showStickers = false; goto('/sticker-shop'); }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
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
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
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
