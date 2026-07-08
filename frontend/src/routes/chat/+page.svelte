<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { scrollToBottom, loadMyStickers, uploadViaSocket, loadChats } from '$lib/helpers';
  import { user, socket, messages, typingText, activeChat, chatInput, chats, contacts, myStickers, showToast, activeCall } from '$lib/stores';
  import type { Chat, Message, User as UserType, Sticker } from '$lib/types';
  import CallOverlay from '$lib/components/CallOverlay.svelte';
  import BottomSheet from '$lib/components/BottomSheet.svelte';
  import ChatHeader from '$lib/components/chat/ChatHeader.svelte';
  import ChatMessage from '$lib/components/chat/ChatMessage.svelte';
  import ChatContextMenu from '$lib/components/chat/ChatContextMenu.svelte';
  import ChatInput from '$lib/components/chat/ChatInput.svelte';
  import StickerPicker from './components/StickerPicker.svelte';
  import ForwardSheet from './components/ForwardSheet.svelte';
  import ChatMenu from './components/ChatMenu.svelte';

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
  let showCallOptions = $state(false);
  let showChatMenu = $state(false);
  let myStkr: Sticker[] = $state([]);
  let recording = $state(false);
  let recorder: MediaRecorder | null = $state(null);
  let recordingTimer: number | undefined = $state();
  let recordingSecs = $state(0);
  let uploading = $state(false);
  let replyToMsg: Message | null = $state(null);
  let editingMsg: Message | null = $state(null);
  let ctxX = $state(0);
  let ctxY = $state(0);
  let longPressTimer: ReturnType<typeof setTimeout> | undefined = $state();
  let _ignoreNextClick = $state(false);
  let audioEl2: HTMLAudioElement | undefined = $state();

  function playAudio(msg: any) {
    if (!audioEl2) {
      audioEl2 = new Audio(mediaUrl(msg.text));
      audioEl2.onended = () => { audioEl2 = undefined; };
    }
    if (audioEl2.paused) {
      (audioEl2 as HTMLAudioElement).src = mediaUrl(msg.text);
      audioEl2.play().catch(() => showToast('Error al reproducir'));
    } else {
      audioEl2.pause();
    }
  }

  import Icon from '$lib/icon/Icon.svelte';
  import type { IconName } from '$lib/icon/icons';
  import { mediaUrl, avatarUrl } from '$lib/helpers';

  user.subscribe((v) => usr = v);
  socket.subscribe((v) => sk = v);
  messages.subscribe((v) => msgs = v);
  typingText.subscribe((v) => typing = v);
  chatInput.subscribe((v) => input = v);
  chats.subscribe((v) => chatList = v);
  myStickers.subscribe((v) => myStkr = v);

  const chatId = $derived(Number($page.url.searchParams.get('id')));

  const otherMember = $derived.by(() => {
    if (!chatInfo || chatInfo.type === 'group' || !chatInfo.members) return null;
    return chatInfo.members.find((m: any) => m.id !== usr?.id) || null;
  });

  const otherOnline = $derived.by(() => {
    if (!otherMember) return false;
    return !!$contacts.find((c: any) => c.id === otherMember.id)?.online;
  });

  const otherLastSeen = $derived.by(() => {
    if (!otherMember) return '';
    const c = $contacts.find((c: any) => c.id === otherMember.id);
    return c?.last_seen_at || '';
  });

  onMount(() => {
    if (!sk || !chatId) return;
    sk.emit('join_chat', { chatId });
    sk.emit('get_messages', { chatId }, (list: Message[]) => {
      messages.set(list);
      const otherMsgs = list.filter((m) => m.sender_id !== usr?.id);
      otherMsgs.forEach((m) => sk?.emit('mark_read', { messageId: m.id }));
      if (otherMsgs.length > 0) loadChats();
      scrollToBottom(messagesEl);
    });
    sk.emit('get_chats', null, (chatsArr: Chat[]) => {
      const found = chatsArr.find((c) => c.id === chatId);
      if (found) { chatInfo = found; activeChat.set(found); }
    });

    sk?.on('message_edited', (data: any) => {
      messages.update((m: Message[]) => m.map((x) => x.id === data.messageId ? { ...x, text: data.text, edited_at: data.edited_at } : x));
    });

    sk?.on('message_deleted', (data: any) => {
      if (data.deleteForAll) {
        messages.update((m: Message[]) => m.filter((x) => x.id !== data.messageId));
      }
    });

    return () => {
      sk?.emit('leave_chat', { chatId });
      messages.set([]);
      activeChat.set(null);
    };
  });

  function sendMessage() {
    if (!sk || !chatId) return;
    if (editingMsg) {
      if (!input.trim()) return;
      sk.emit('edit_message', { messageId: editingMsg.id, text: input, chatId }, (res: any) => {
        if (res?.ok) editCancel();
        else showToast('No se pudo editar el mensaje');
      });
      return;
    }
    if (!input.trim()) return;
    const payload: any = { chatId, text: input, type: 'text' };
    if (replyToMsg) payload.replyToId = replyToMsg.id;
    sk.emit('send_message', payload, () => {});
    replyCancel();
    chatInput.set('');
    input = '';
    sk.emit('stop_typing', { chatId });
    scrollToBottom(messagesEl);
  }

  function toggleStickers() {
    showStickers = !showStickers;
    if (showStickers) loadMyStickers();
  }

  function startRecording() {
    if (!navigator.mediaDevices?.getUserMedia) { showToast('GrabaciA3n no soportada'); return; }
    navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
      const r = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      const chunks: Blob[] = [];
      r.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      r.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunks, { type: 'audio/webm' });
        sendAudio(blob);
      };
      r.start();
      recorder = r;
      recording = true;
      recordingSecs = 0;
      recordingTimer = window.setInterval(() => { recordingSecs++; }, 1000);
    }).catch(() => showToast('Permiso de micrA3fono denegado'));
  }

  function stopRecording() {
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
      recorder = null;
    }
    recording = false;
    clearInterval(recordingTimer);
    recordingSecs = 0;
  }

  async function sendAudio(blob: Blob) {
    if (!sk || !chatId) return;
    uploading = true;
    const buf = await blob.arrayBuffer();
    const res = await uploadViaSocket(sk, { name: 'voice.webm', type: 'audio/webm', data: buf }, (pct) => {});
    uploading = false;
    if (res?.ok && res.url) {
      const payload: any = { chatId, text: res.url, type: 'audio' };
      if (replyToMsg) payload.replyToId = replyToMsg.id;
      sk.emit('send_message', payload, () => {});
      replyCancel();
      scrollToBottom(messagesEl);
    } else {
      showToast('Error al subir audio');
    }
  }

  function handleAttach(file: File) {
    if (!sk || !chatId) return;
    uploading = true;
    uploadViaSocket(sk, file, (pct) => {}).then(res => {
      uploading = false;
      if (res?.ok && res.url) {
        const isImg = file.type.startsWith('image/');
        const isVid = file.type.startsWith('video/');
        const isAud = file.type.startsWith('audio/');
        const msgType = isImg ? 'image' : isVid ? 'video' : isAud ? 'audio' : 'document';
        const payload: any = { chatId, text: res.url, type: msgType };
        if (replyToMsg) payload.replyToId = replyToMsg.id;
        sk.emit('send_message', payload, () => {});
        replyCancel();
        scrollToBottom(messagesEl);
      } else {
        showToast('Error al subir archivo');
      }
    });
  }

  function sendSticker(sticker: Sticker) {
    if (!sk || !chatId) return;
    const payload: any = { chatId, text: sticker.image_url, type: 'image' };
    if (replyToMsg) payload.replyToId = replyToMsg.id;
    sk.emit('send_message', payload, () => {});
    replyCancel();
    showStickers = false;
    scrollToBottom(messagesEl);
  }

  function onChatInput(val: string) {
    input = val;
    chatInput.set(val);
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

  function openContext(e: MouseEvent | TouchEvent, msg: Message) {
    e.stopPropagation();
    e.preventDefault();
    if ('touches' in e) {
      ctxX = (e as TouchEvent).touches[0]?.clientX || 0;
      ctxY = (e as TouchEvent).touches[0]?.clientY || 0;
    } else {
      ctxX = (e as MouseEvent).clientX;
      ctxY = (e as MouseEvent).clientY;
    }
    contextMsg = contextMsg?.id === msg.id ? null : msg;
  }

  function closeContext() {
    if (_ignoreNextClick) { _ignoreNextClick = false; return; }
    contextMsg = null;
  }

  function handleLongPressStart(e: TouchEvent, msg: Message) {
    e.preventDefault();
    ctxX = e.touches[0]?.clientX || 0;
    ctxY = e.touches[0]?.clientY || 0;
    longPressTimer = setTimeout(() => {
      contextMsg = contextMsg?.id === msg.id ? null : msg;
      _ignoreNextClick = true;
      setTimeout(() => { _ignoreNextClick = false; }, 300);
    }, 500);
  }

  function handleLongPressEnd(e?: TouchEvent) {
    clearTimeout(longPressTimer);
  }

  function handleTouchMove(e: TouchEvent) {
    clearTimeout(longPressTimer);
  }

  function deleteForMe(msg: Message) {
    if (!sk) return;
    sk.emit('delete_for_me', { messageId: msg.id, chatId }, (res: any) => {
      if (res?.ok) {
        messages.update((m: Message[]) => m.filter((x) => x.id !== msg.id));
      }
    });
    closeContext();
  }

  function deleteForEveryone(msg: Message) {
    if (!sk) return;
    sk.emit('delete_for_everyone', { messageId: msg.id, chatId }, (res: any) => {
      if (!res?.ok) showToast('No se pudo eliminar para todos');
    });
    closeContext();
  }

  function copyText(msg: Message) {
    if (msg.text) {
      navigator.clipboard.writeText(msg.text).then(() => showToast('Copiado')).catch(() => {});
    }
    closeContext();
  }

  function startReply(msg: Message) {
    replyToMsg = msg;
    editingMsg = null;
    closeContext();
  }

  function replyCancel() {
    replyToMsg = null;
  }

  function startEdit(msg: Message) {
    editingMsg = msg;
    replyToMsg = null;
    input = msg.text;
    chatInput.set(msg.text);
    closeContext();
  }

  function editCancel() {
    editingMsg = null;
    input = '';
    chatInput.set('');
  }

  function openForward(msg: Message) {
    forwardMsg = msg;
    showForward = true;
    closeContext();
  }

  function startCall(callType: 'audio' | 'video') {
    showCallOptions = false;
    if (!sk || !chatInfo || chatInfo.type === 'group') return;
    const otherId = chatInfo.members?.find((m: any) => m.id !== usr?.id)?.id;
    if (!otherId) return;
    sk.emit('start_call', { calleeId: otherId, callType }, (res: any) => {
      if (res?.ok) {
        activeCall.set({ callId: res.callId, peerId: otherId, peerName: chatInfo?.name, type: callType, direction: 'outgoing', status: 'ringing' });
      } else {
        showToast(res?.error || 'Error al iniciar llamada');
      }
    });
  }

  function doDeleteChat() {
    showChatMenu = false;
    if (!sk || !chatId) return;
    sk.emit('delete_chat', { chatId }, (res: any) => {
      if (res?.ok) {
        showToast('Chat eliminado');
        goto('/');
      } else {
        showToast('Error al eliminar chat');
      }
    });
  }

  function doClearChat() {
    showChatMenu = false;
    if (!sk || !chatId) return;
    sk.emit('clear_chat', { chatId }, (res: any) => {
      if (res?.ok) {
        messages.set([]);
        showToast('Chat vaciado');
      } else {
        showToast('Error al vaciar chat');
      }
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

  function scrollToMsg(id: number) {
    const el = messagesEl?.querySelector(`[data-msg-id="${id}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function getRepliedMsgText(msg: Message): string {
    const found = msgs.find((m) => m.id === msg.reply_to_id);
    return found ? found.text.slice(0, 80) : 'Mensaje original';
  }

  function shouldShowDate(created_at: string, i: number, arr: Message[]): boolean {
    if (i === 0) return true;
    const prev = new Date(arr[i - 1].created_at);
    const curr = new Date(created_at);
    return prev.toDateString() !== curr.toDateString();
  }

  function formatDateHeader(date: string): string {
    const d = new Date(date);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return 'Hoy';
    if (d.toDateString() === yesterday.toDateString()) return 'Ayer';
    return d.toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' });
  }
</script>

<div class="chat-page" onclick={closeContext}>
  <ChatHeader
    {chatInfo}
    {typing}
    {otherOnline}
    {otherLastSeen}
    {otherMember}
    onBack={() => goto('/')}
    onShowCallOptions={() => showCallOptions = true}
    onShowChatMenu={() => showChatMenu = true}
    onContactClick={() => { closeContext(); goto(`/contact?id=${otherMember?.id || chatId}`); }}
  />

  <div class="chat-messages-area">
    <div class="messages" bind:this={messagesEl} onclick={closeContext}>
    {#if showSearch && searchQuery.trim()}
      {#if searching}
        <div class="search-status">Buscando...</div>
      {:else if searchResults.length === 0}
        <div class="search-status">Sin resultados</div>
      {:else}
        <div class="search-count">{searchResults.length} resultados</div>
        {#each searchResults as msg}
          <ChatMessage
            message={msg}
            isOwn={msg.sender_id === usr?.id}
            chatType={chatInfo?.type || 'private'}
            {chatInfo}
            showDate={false}
            dateLabel=""
            onPlayAudio={playAudio}
          />
        {/each}
      {/if}
    {:else}
      {#each msgs as msg, i}
        <ChatMessage
          message={msg}
          isOwn={msg.sender_id === usr?.id}
          chatType={chatInfo?.type || 'private'}
          {chatInfo}
          showDate={shouldShowDate(msg.created_at, i, msgs)}
          dateLabel={formatDateHeader(msg.created_at)}
          onContextMenu={openContext}
          onLongPressStart={handleLongPressStart}
          onLongPressEnd={handleLongPressEnd}
          onTouchMove={handleTouchMove}
          onPlayAudio={playAudio}
          onReplyClick={scrollToMsg}
        />
      {/each}
    {/if}
    </div>

    {#if contextMsg}
      <ChatContextMenu
        message={contextMsg}
        isOwn={contextMsg.sender_id === usr?.id}
        x={ctxX}
        y={ctxY}
        onStartReply={startReply}
        onStartEdit={startEdit}
        onOpenForward={openForward}
        onCopyText={copyText}
        onDeleteForMe={deleteForMe}
        onDeleteForEveryone={deleteForEveryone}
        onClose={closeContext}
      />
    {/if}
  </div>

  <ChatInput
    bind:value={input}
    {editingMsg}
    {replyToMsg}
    {recording}
    {recordingSecs}
    {uploading}
    {typing}
    onSend={sendMessage}
    onCancelReply={replyCancel}
    onCancelEdit={editCancel}
    onInput={onChatInput}
    onStartRecording={startRecording}
    onStopRecording={stopRecording}
    onAttach={handleAttach}
    onToggleStickers={toggleStickers}
  />
</div>

<StickerPicker show={showStickers} stickers={myStkr} onclose={() => showStickers = false} onSelect={sendSticker} />

<ForwardSheet show={showForward} chats={chatList} excludeChatId={chatId} onclose={() => { showForward = false; forwardMsg = null; }} onForward={doForward} />

<CallOverlay />

<BottomSheet show={showCallOptions} title="Llamar" onclose={() => showCallOptions = false}>
  <div class="call-options">
    <button class="call-opt-btn" onclick={() => startCall('audio')}>
      <div class="call-opt-icon" style="background: rgba(var(--accent-rgb),0.15)">
        <Icon name="phone" size={24} style="color: var(--accent)" />
      </div>
      <span>Llamada de voz</span>
    </button>
    <button class="call-opt-btn" onclick={() => startCall('video')}>
      <div class="call-opt-icon" style="background: rgba(var(--accent-rgb),0.15)">
        <Icon name="video" size={24} style="color: var(--accent)" />
      </div>
      <span>Videollamada</span>
    </button>
  </div>
</BottomSheet>

<ChatMenu show={showChatMenu} {chatInfo} otherMemberId={otherMember?.id || chatId} onclose={() => showChatMenu = false} onSearch={() => showSearch = true} onClearChat={doClearChat} onDeleteChat={doDeleteChat} />

<style>
  .chat-page { height: 100%; display: grid; grid-template-rows: auto 1fr auto; background: var(--bg-chat); max-width: 430px; margin: 0 auto; overflow: hidden; background: var(--bg-2); padding-top: var(--safe-area-top); }
  .chat-messages-area { overflow-y: auto; position: relative; background-image: var(--chat-bg-pattern); background-size: 40px; background-color: var(--bg-chat); display: flex; flex-direction: column; }
  .messages { flex: 1; overflow-y: auto; padding: 16px 12px; display: flex; flex-direction: column; gap: 2px; scroll-behavior: smooth; }
  .search-status { align-self: center; color: var(--text-3); font-size: 13px; padding: 20px 0; }
  .search-count { align-self: center; color: var(--text-3); font-size: 12px; padding: 8px 0; }
  .sticker-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: flex-end; justify-content: center; z-index: 100; padding: 12px; }
  .sticker-sheet { background: var(--bg-2); border-radius: 16px 16px 0 0; width: 100%; max-width: 400px; max-height: 50%; display: flex; flex-direction: column; box-shadow: 0 -8px 32px var(--shadow); }
  .sticker-header { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; border-bottom: 1px solid var(--border); }
  .sticker-header h3 { font-size: 16px; font-weight: 600; color: var(--text); margin: 0; }
  .sticker-grid { flex: 1; overflow-y: auto; padding: 12px; display: flex; flex-wrap: wrap; gap: 8px; align-content: flex-start; }
  .sticker-item { width: calc(25% - 6px); aspect-ratio: 1; background: var(--bg-3); border-radius: 12px; border: none; cursor: pointer; padding: 4px; display: flex; align-items: center; justify-content: center; transition: background 0.15s; }
  .sticker-item:hover { background: var(--accent); }
  .sticker-img { width: 100%; height: 100%; object-fit: contain; }
  .sticker-empty { width: 100%; display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 32px 16px; }
  .sticker-empty p { color: var(--text-3); font-size: 14px; margin: 0; }
  .sticker-shop-btn { display: flex; align-items: center; gap: 6px; padding: 10px 20px; background: var(--accent); color: #000; border: none; border-radius: 10px; font-size: 14px; font-weight: 600; cursor: pointer; font-family: inherit; }
  .sticker-shop-link { width: 100%; display: flex; align-items: center; justify-content: center; gap: 6px; padding: 10px; margin-top: 4px; background: none; border: none; color: var(--accent); font-size: 13px; font-weight: 600; cursor: pointer; border-radius: 8px; transition: background 0.15s; font-family: inherit; }
  .sticker-shop-link:hover { background: var(--bg-3); }
  .forward-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: flex-end; justify-content: center; z-index: 100; padding: 24px; }
  .forward-sheet { background: var(--bg-2); border-radius: 16px 16px 0 0; width: 100%; max-width: 400px; max-height: 60%; display: flex; flex-direction: column; box-shadow: 0 -8px 32px var(--shadow); }
  .forward-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; border-bottom: 1px solid var(--border); }
  .forward-header h3 { font-size: 17px; font-weight: 600; color: var(--text); margin: 0; }
  .forward-list { flex: 1; overflow-y: auto; padding: 8px; }
  .forward-item { display: flex; align-items: center; gap: 12px; width: 100%; padding: 12px; background: none; border: none; cursor: pointer; border-radius: 10px; transition: background 0.15s; color: var(--text); font-size: 15px; font-weight: 500; }
  .forward-item:hover { background: var(--bg-3); }
  .forward-avatar { width: 40px; height: 40px; border-radius: 50%; object-fit: cover; }
  .call-options { display: flex; flex-direction: column; gap: 8px; padding: 8px 0; }
  .call-opt-btn { display: flex; align-items: center; gap: 14px; padding: 14px 16px; background: none; border: none; cursor: pointer; border-radius: 12px; transition: background 0.15s; color: var(--text); font-size: 15px; font-weight: 500; width: 100%; text-align: left; font-family: inherit; }
  .call-opt-btn:hover { background: var(--bg-3); }
  .call-opt-icon { width: 48px; height: 48px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .chat-menu-options { display: flex; flex-direction: column; gap: 4px; padding: 8px 0; }
  .chat-menu-btn { display: flex; align-items: center; gap: 14px; padding: 12px 16px; background: none; border: none; cursor: pointer; border-radius: 10px; transition: background 0.15s; color: var(--text); font-size: 15px; font-weight: 500; width: 100%; text-align: left; font-family: inherit; }
  .chat-menu-btn:hover { background: var(--bg-3); }
  .chat-menu-danger { color: var(--danger); }
  .icon-btn { background: none; border: none; color: var(--text-2); cursor: pointer; padding: 6px; border-radius: 50%; display: flex; align-items: center; justify-content: center; transition: background 0.2s; }
  .icon-btn:hover { background: var(--border); }
</style>