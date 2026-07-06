<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { avatarUrl, formatTime, formatDateHeader, shouldShowDate, scrollToBottom } from '$lib/helpers';
  import { user, socket, messages, typingText, activeChat, chatInput } from '$lib/stores';
  import type { Chat, Message, User as UserType } from '$lib/types';

  let usr: UserType | null = $state(null);
  let sk: any = $state(null);
  let msgs: Message[] = $state([]);
  let chatInfo: Chat | null = $state(null);
  let typing = $state('');
  let input = $state('');
  let messagesEl: HTMLDivElement | undefined = $state();

  user.subscribe((v) => usr = v);
  socket.subscribe((v) => sk = v);
  messages.subscribe((v) => msgs = v);
  typingText.subscribe((v) => typing = v);
  chatInput.subscribe((v) => input = v);

  const chatId = $derived(Number($page.url.searchParams.get('id')));

  onMount(() => {
    if (!sk || !chatId) return;
    sk.emit('join_chat', { chatId });
    sk.emit('get_messages', { chatId }, (list: Message[]) => {
      messages.set(list);
      list.forEach((m) => sk?.emit('mark_read', { messageId: m.id }));
      scrollToBottom(messagesEl);
    });
    sk.emit('get_chats', null, (chats: Chat[]) => {
      const found = chats.find((c) => c.id === chatId);
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

  function onChatInput() {
    if (!chatId) return;
    sk?.emit('typing', { chatId });
    clearTimeout((window as any)._typingTimer);
    (window as any)._typingTimer = setTimeout(() => sk?.emit('stop_typing', { chatId }), 1000);
  }
</script>

<div class="chat-view">
  <div class="chat-header">
    <button class="back-btn" onclick={() => goto('/')}>
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M15 18l-6-6 6-6"/></svg>
    </button>
    <img src={avatarUrl(chatInfo?.type === 'private' ? (chatInfo?.members?.[0]?.id || chatId) : chatId)} alt="" class="chat-header-avatar" />
    <div class="chat-header-info">
      <span class="chat-header-name">{chatInfo?.name || 'Chat'}</span>
      <span class="chat-header-status">{typing || 'En línea'}</span>
    </div>
    <button class="icon-btn">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M23 7l-7.5 3.5L23 7z"/><rect x="1" y="5" width="16" height="14" rx="2" ry="2"/></svg>
    </button>
    <button class="icon-btn">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
    </button>
    <button class="icon-btn">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>
    </button>
  </div>

  <div class="messages" bind:this={messagesEl}>
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
          <div class="msg-bubble">
            <div class="msg-text">{msg.text}</div>
            <div class="msg-meta">
              <span class="msg-time">{formatTime(msg.created_at)}</span>
              {#if msg.sender_id === usr?.id}
                <svg width="14" height="14" viewBox="0 0 16 11" fill="#53bdeb"><path d="M11.071.653a.457.457 0 0 0-.304-.102.493.493 0 0 0-.381.178l-5.94 6.35-2.63-2.63a.458.458 0 0 0-.65.05.46.46 0 0 0-.05.56l2.92 3.32a.47.47 0 0 0 .35.18h.02a.47.47 0 0 0 .35-.15l6.38-6.81a.45.45 0 0 0-.075-.66z"/></svg>
              {/if}
            </div>
          </div>
        {/if}
      </div>
    {/each}
  </div>

  <div class="typing-indicator" class:visible={typing !== ''}>{typing}</div>

  <div class="input-bar">
    <button class="icon-btn">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" stroke-width="2" stroke-linecap="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
    </button>
    <div class="input-wrap">
      <button class="icon-btn input-icon">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" stroke-width="2" stroke-linecap="round"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
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
  }
  .own .msg-bubble {
    background: var(--bubble-own); color: #e9edef;
    border-radius: var(--bubble-radius) var(--bubble-radius) 4px var(--bubble-radius);
  }
  :global([data-theme="light"]) .own .msg-bubble { color: var(--text); }
  :global([data-theme="light"]) .msg-bubble { box-shadow: 0 1px 1px rgba(0,0,0,0.06); }
  .other .msg-bubble { background: var(--bubble-other); }
  .msg-text { white-space: pre-wrap; padding-right: 4px; }
  .msg-meta { display: flex; align-items: center; justify-content: flex-end; gap: 3px; margin-top: 2px; }
  .msg-time { font-size: 10px; color: rgba(255,255,255,0.45); }
  .own .msg-time { color: rgba(233,237,239,0.6); }
  :global([data-theme="light"]) .msg-time { color: rgba(0,0,0,0.4); }
  :global([data-theme="light"]) .own .msg-time { color: rgba(0,0,0,0.45); }
  .msg-image { width: 100%; border-radius: 16px; display: block; }
  .typing-indicator { padding: 4px 16px; font-size: 11px; color: var(--accent); min-height: 24px; flex-shrink: 0; visibility: hidden; font-style: italic; }
  .typing-indicator.visible { visibility: visible; }
  .input-bar { display: flex; align-items: center; gap: 6px; padding: 8px 12px 10px; background: var(--bg-2); flex-shrink: 0; border-top: 1px solid var(--border); }
  .input-wrap { flex: 1; display: flex; align-items: center; background: var(--bg-3); border-radius: var(--input-radius); padding: 0 4px; }
  .input-icon { flex-shrink: 0; }
  .input-wrap input { flex: 1; background: none; border: none; outline: none; padding: 10px 4px; font-size: 15px; color: var(--text); }
  .input-wrap input::placeholder { color: var(--text-3); }
  .mic-btn { width: 40px; height: 40px; border-radius: 50%; background: var(--accent); border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: background 0.2s; }
  .mic-btn:hover { background: var(--accent-hover); }
</style>
