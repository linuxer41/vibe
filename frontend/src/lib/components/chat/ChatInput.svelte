<script lang="ts">
  import Icon from '$lib/icon/Icon.svelte';
  import type { Message } from '$lib/types';

  let {
    value,
    editingMsg,
    replyToMsg,
    recording,
    recordingSecs,
    uploading,
    typing,
    onSend,
    onCancelReply,
    onCancelEdit,
    onInput,
    onStartRecording,
    onStopRecording,
    onAttach,
    onToggleStickers,
  }: {
    value: string;
    editingMsg: Message | null;
    replyToMsg: Message | null;
    recording: boolean;
    recordingSecs: number;
    uploading: boolean;
    typing: string;
    onSend?: () => void;
    onCancelReply?: () => void;
    onCancelEdit?: () => void;
    onInput?: (val: string) => void;
    onStartRecording?: () => void;
    onStopRecording?: () => void;
    onAttach?: (file: File) => void;
    onToggleStickers?: () => void;
  } = $props();

  let inputEl: HTMLTextAreaElement | undefined = $state();
  let attachInput: HTMLInputElement | undefined = $state();

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend?.();
    }
    if (e.key === 'Escape' && editingMsg) onCancelEdit?.();
  }

  function handleInput(e: Event) {
    const el = e.target as HTMLTextAreaElement;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
    onInput?.(el.value);
  }

  function handleAttach(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) onAttach?.(file);
    (e.target as HTMLInputElement).value = '';
  }

  function handleMicClick() {
    if (value.trim() || editingMsg) onSend?.();
    else onStartRecording?.();
  }


</script>

<div class="chat-input-area">
  {#if replyToMsg}
    <div class="reply-preview">
      <div class="reply-preview-line"></div>
      <div class="reply-preview-content">
        <span class="reply-preview-label">Respondiendo a {replyToMsg.sender_id === replyToMsg.sender_id ? 'ti mismo' : (replyToMsg.sender_name || '')}</span>
        <span class="reply-preview-text">{replyToMsg.text?.slice(0, 100) || (replyToMsg.type === 'image' ? '📷 Imagen' : replyToMsg.type === 'audio' ? '🎤 Audio' : replyToMsg.type === 'video' ? '🎬 Video' : replyToMsg.type === 'document' ? '📄 Documento' : '')}</span>
      </div>
      <button class="reply-preview-close" onclick={onCancelReply}>
        <Icon name="x" size={16} />
      </button>
    </div>
  {/if}
  {#if editingMsg}
    <div class="reply-preview edit-preview">
      <div class="reply-preview-line" style="background: var(--accent)"></div>
      <div class="reply-preview-content">
        <span class="reply-preview-label" style="color: var(--accent)">Editando mensaje</span>
        <span class="reply-preview-text">{editingMsg.text?.slice(0, 100)}</span>
      </div>
      <button class="reply-preview-close" onclick={onCancelEdit}>
        <Icon name="x" size={16} />
      </button>
    </div>
  {/if}
  <div class="typing-indicator" class:visible={typing !== '' && !replyToMsg && !editingMsg}>{typing}</div>
  <div class="input-bar">
    <button class="icon-btn" onclick={onToggleStickers}>
      <Icon name="image" size={22} style="color: var(--text-3)" />
    </button>
    <div class="input-wrap">
      <button class="icon-btn input-icon" onclick={() => attachInput?.click()} title="Adjuntar archivo">
        <Icon name="link" size={20} style="color: var(--text-3)" />
      </button>
      <input type="file" bind:this={attachInput} onchange={handleAttach} style="display:none" accept="image/*,video/*,audio/*,.pdf,.zip,.doc,.docx" />
      <textarea bind:this={inputEl} bind:value={value} placeholder={editingMsg ? 'Editar mensaje...' : 'Message'}
        onkeydown={handleKeydown}
        oninput={handleInput}
        rows={1}></textarea>
    </div>
    {#if recording}
      <div class="rec-indicator">
        <span class="rec-dot"></span>
        <span class="rec-time">{Math.floor(recordingSecs / 60)}:{String(recordingSecs % 60).padStart(2, '0')}</span>
        <button class="rec-stop-btn" onclick={onStopRecording}>
          <Icon name="stop" size={16} variant="filled" style="color: #fff" />
        </button>
      </div>
    {:else if uploading}
      <button class="mic-btn loading" disabled>
        <Icon name="refresh" size={20} style="color: #fff" />
      </button>
    {:else}
      <button class="mic-btn" onclick={handleMicClick}>
        {#if value.trim() || editingMsg}
          <Icon name="send" size={20} strokeWidth={2.5} style="color: #fff" />
        {:else}
          <Icon name="mic" size={20} variant="filled" style="color: #fff" />
        {/if}
      </button>
    {/if}
  </div>
</div>

<style>
  .chat-input-area { flex-shrink: 0; }
  .reply-preview { display: flex; align-items: center; gap: 8px; padding: 6px 16px; background: var(--bg-3); border-top: 1px solid var(--border); min-height: 36px; }
  .edit-preview { border-top: 2px solid var(--accent); }
  .reply-preview-line { width: 3px; border-radius: 2px; background: var(--accent); flex-shrink: 0; align-self: stretch; }
  .reply-preview-content { flex: 1; min-width: 0; }
  .reply-preview-label { font-size: 11px; font-weight: 600; color: var(--accent); display: block; }
  .reply-preview-text { font-size: 12px; color: var(--text-2); display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .reply-preview-close { background: none; border: none; color: var(--text-3); cursor: pointer; padding: 4px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .reply-preview-close:hover { background: var(--bg-3); }
  .typing-indicator { padding: 4px 16px; font-size: 11px; color: var(--accent); min-height: 24px; flex-shrink: 0; visibility: hidden; font-style: italic; }
  .typing-indicator.visible { visibility: visible; }
  .input-bar { display: flex; align-items: center; gap: 8px; padding: 12px 12px 14px; background: var(--bg-2); flex-shrink: 0; border-top: 1px solid var(--border); }
  .rec-indicator { display: flex; align-items: center; gap: 8px; background: var(--bg-3); border-radius: 24px; padding: 8px 12px; flex-shrink: 0; }
  .rec-dot { width: 10px; height: 10px; border-radius: 50%; background: #ff3b30; animation: pulse 1s infinite; }
  @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }
  .rec-time { font-size: 15px; color: var(--text); font-weight: 500; min-width: 40px; }
  .rec-stop-btn { width: 32px; height: 32px; border-radius: 50%; background: #ff3b30; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .input-wrap { flex: 1; display: flex; align-items: center; background: var(--bg-3); border-radius: 24px; padding: 0 6px; }
  .input-icon { flex-shrink: 0; }
  .input-wrap textarea { flex: 1; background: none; border: none; outline: none; padding: 12px 6px; font-size: 16px; color: var(--text); font-family: inherit; resize: none; max-height: 120px; }
  .input-wrap textarea::placeholder { color: var(--text-3); }
  .mic-btn { width: 48px; height: 48px; border-radius: 50%; background: var(--accent); border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: background 0.2s; }
  .mic-btn:hover { background: var(--accent-hover); }
  .mic-btn.loading { animation: spin 1s linear infinite; pointer-events: none; opacity: 0.7; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .icon-btn { background: none; border: none; color: var(--text-2); cursor: pointer; padding: 6px; border-radius: 50%; display: flex; align-items: center; justify-content: center; transition: background 0.2s; }
  .icon-btn:hover { background: var(--border); }
</style>