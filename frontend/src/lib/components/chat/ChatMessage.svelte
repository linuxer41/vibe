<script lang="ts">
  import Icon from '$lib/icon/Icon.svelte';
  import type { IconName } from '$lib/icon/icons';
  import { formatTime, mediaUrl, extractFileName } from '$lib/helpers';
  import type { Message, Chat } from '$lib/types';

  let {
    message,
    isOwn,
    chatType,
    chatInfo,
    showDate,
    dateLabel,
    onContextMenu,
    onLongPressStart,
    onLongPressEnd,
    onTouchMove,
    onPlayAudio,
    onReplyClick,
  }: {
    message: Message;
    isOwn: boolean;
    chatType: string;
    chatInfo: Chat | null;
    showDate: boolean;
    dateLabel: string;
    onContextMenu?: (e: MouseEvent | TouchEvent, msg: Message) => void;
    onLongPressStart?: (e: TouchEvent, msg: Message) => void;
    onLongPressEnd?: (e: TouchEvent) => void;
    onTouchMove?: (e: TouchEvent) => void;
    onPlayAudio?: (msg: Message) => void;
    onReplyClick?: (msgId: number) => void;
  } = $props();

  function statusIcon(status?: string): { name: IconName; color: string } {
    if (status === 'read') return { name: 'check-double', color: '#53bdeb' };
    if (status === 'delivered') return { name: 'check-double', color: 'var(--text-3)' };
    return { name: 'check', color: 'var(--text-3)' };
  }

  function handlePlay(e: Event, msg: Message) {
    e.stopPropagation();
    onPlayAudio?.(msg);
  }

  function handleReplyClick(e: Event, id: number) {
    e.stopPropagation();
    onReplyClick?.(id);
  }
</script>

<div class="msg" class:own={isOwn} class:other={!isOwn}
     class:image={message.type === 'image'} class:audio={message.type === 'audio'}
     class:video={message.type === 'video'} class:document={message.type === 'document'}
     data-msg-id={message.id}
     ontouchstart={(e) => onLongPressStart?.(e, message)}
     ontouchend={(e) => onLongPressEnd?.(e)}
     ontouchmove={(e) => onTouchMove?.(e)}
     oncontextmenu={(e) => onContextMenu?.(e, message)}>
  {#if showDate}
    <div class="date-separator">{dateLabel}</div>
  {/if}

  {#if message.type === 'system'}
    <div class="msg-system">{message.text}</div>
  {:else if message.type === 'image'}
    <div class="msg-image-wrap" onclick={(e) => e.stopPropagation()}>
      <img src={mediaUrl(message.text)} alt="" class="msg-image" loading="lazy" />
      <div class="msg-image-meta">
        <span class="msg-time">{formatTime(message.created_at)}</span>
        {#if message.edited_at}<span class="msg-edited">editado</span>{/if}
        {#if isOwn}
          {@const s = statusIcon(message.status)}
          <Icon name={s.name} size={12} variant="filled" style="color: {s.color}" />
        {/if}
      </div>
    </div>
  {:else if message.type === 'audio'}
    <div class="msg-bubble msg-audio-bubble" onclick={(e) => e.stopPropagation()}>
      <div class="msg-audio-row">
        <button class="audio-play-btn" onclick={(e) => handlePlay(e, message)}>
          <Icon name="play" size={18} variant="filled" />
        </button>
        <div class="audio-wave"><div class="audio-wave-bar" style="height: {8 + Math.random() * 16}px"></div></div>
        <span class="audio-duration">0:30</span>
      </div>
      <div class="msg-meta">
        <span class="msg-time">{formatTime(message.created_at)}</span>
        {#if message.edited_at}<span class="msg-edited">editado</span>{/if}
        {#if isOwn}
          {@const s = statusIcon(message.status)}
          <Icon name={s.name} size={14} variant="filled" style="color: {s.color}" />
        {/if}
      </div>
    </div>
  {:else if message.type === 'video'}
    <div class="msg-bubble msg-video-bubble" onclick={(e) => e.stopPropagation()}>
      <div class="msg-video-thumb">
        <img src={mediaUrl(message.text, { w: 240 })} alt="" class="msg-video-preview" loading="lazy" />
        <div class="msg-video-play"><Icon name="play" size={28} variant="filled" style="color: #fff" /></div>
      </div>
      <div class="msg-meta" style="padding: 6px 12px">
        <span class="msg-time">{formatTime(message.created_at)}</span>
        {#if message.edited_at}<span class="msg-edited">editado</span>{/if}
        {#if isOwn}
          {@const s = statusIcon(message.status)}
          <Icon name={s.name} size={14} variant="filled" style="color: {s.color}" />
        {/if}
      </div>
    </div>
  {:else if message.type === 'document'}
    <div class="msg-bubble msg-doc-bubble" onclick={(e) => e.stopPropagation()}>
      <div class="msg-doc-row">
        <div class="msg-doc-icon"><Icon name="link" size={24} style="color: var(--accent)" /></div>
        <div class="msg-doc-info">
          <span class="msg-doc-name">{extractFileName(message.text) || 'Documento'}</span>
          <span class="msg-doc-size">Archivo adjunto</span>
        </div>
        <button class="msg-download-btn" onclick={() => window.open(mediaUrl(message.text), '_blank')}>
          <Icon name="download" size={18} />
        </button>
      </div>
      <div class="msg-meta">
        <span class="msg-time">{formatTime(message.created_at)}</span>
        {#if message.edited_at}<span class="msg-edited">editado</span>{/if}
        {#if isOwn}
          {@const s = statusIcon(message.status)}
          <Icon name={s.name} size={14} variant="filled" style="color: {s.color}" />
        {/if}
      </div>
    </div>
  {:else}
    {#if !isOwn && chatType === 'group'}
      <div class="msg-sender">{message.sender_name}</div>
    {/if}
    <div class="msg-bubble" onclick={(e) => e.stopPropagation()}>
      {#if message.reply_to_id}
        <div class="msg-reply-bar" onclick={(e) => handleReplyClick(e, message.reply_to_id!)}>
          <div class="msg-reply-border"></div>
          <div class="msg-reply-content">
            <span class="msg-reply-sender">{isOwn ? 'Tú' : message.sender_name}</span>
            <span class="msg-reply-text">{message.text.slice(0, 80) || 'Mensaje original'}</span>
          </div>
        </div>
      {/if}
      {#if message.forwarded}
        <div class="msg-forwarded">
          <Icon name="forward" size={12} variant="filled" />
          Reenviado
        </div>
      {/if}
      <div class="msg-text">{message.text}</div>
      <div class="msg-meta">
        <span class="msg-time">{formatTime(message.created_at)}</span>
        {#if message.edited_at}<span class="msg-edited">editado</span>{/if}
        {#if isOwn}
          {@const s = statusIcon(message.status)}
          <Icon name={s.name} size={14} variant="filled" style="color: {s.color}" />
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .msg { display: flex; flex-direction: column; max-width: 75%; position: relative; animation: msgIn 0.15s ease-out; -webkit-user-select: none; user-select: none; }
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
    background: var(--bubble-own); color: var(--bubble-own-text, #e9edef);
    border-radius: var(--bubble-radius) var(--bubble-radius) 4px var(--bubble-radius);
  }
  .other .msg-bubble {
    background: var(--bubble-other); box-shadow: var(--bubble-shadow, 0 1px 1px rgba(0,0,0,0.1));
  }
  .msg-reply-bar { display: flex; align-items: stretch; gap: 8px; margin-bottom: 4px; font-size: 12px; color: var(--text-3); cursor: pointer; border-radius: 4px; transition: background 0.15s; }
  .msg-reply-bar:hover { background: rgba(255,255,255,0.05); }
  .msg-reply-border { width: 3px; border-radius: 2px; background: var(--accent); flex-shrink: 0; }
  .msg-reply-content { flex: 1; min-width: 0; padding: 2px 0; }
  .msg-reply-sender { font-weight: 600; color: var(--accent); display: block; font-size: 12px; }
  .msg-reply-text { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block; font-size: 11px; opacity: 0.7; }
  .msg-forwarded { display: flex; align-items: center; gap: 3px; font-size: 11px; color: var(--text-3); margin-bottom: 2px; }
  .msg-text { white-space: pre-wrap; padding-right: 4px; }
  .msg-meta { display: flex; align-items: center; justify-content: flex-end; gap: 3px; margin-top: 2px; }
  .msg-time { font-size: 10px; color: var(--msg-time, rgba(255,255,255,0.45)); }
  .msg-edited { font-size: 10px; color: var(--msg-edited, rgba(255,255,255,0.35)); font-style: italic; }
  .own .msg-edited { color: var(--msg-time-own, rgba(233,237,239,0.5)); }
  .own .msg-time { color: var(--msg-time-own, rgba(233,237,239,0.6)); }
  .msg-image { width: 100%; border-radius: 16px; display: block; }
  .msg-audio-bubble { padding: 8px 12px; min-width: 200px; }
  .msg-audio-row { display: flex; align-items: center; gap: 8px; }
  .audio-play-btn { width: 36px; height: 36px; border-radius: 50%; background: var(--accent); border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; color: #fff; }
  .audio-wave { flex: 1; height: 32px; display: flex; align-items: center; }
  .audio-wave-bar { width: 100%; background: linear-gradient(90deg, var(--text-3) 0%, var(--text-3) 100%); border-radius: 2px; opacity: 0.3; }
  .own .audio-wave-bar { background: linear-gradient(90deg, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0.5) 100%); }
  .audio-duration { font-size: 12px; color: var(--text-3); flex-shrink: 0; }
  .msg-video-bubble { padding: 0; overflow: hidden; }
  .msg-video-thumb { position: relative; width: 200px; height: 150px; overflow: hidden; }
  .msg-video-preview { width: 100%; height: 100%; object-fit: cover; }
  .msg-video-play { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.3); }
  .msg-doc-bubble { padding: 10px 12px; }
  .msg-doc-row { display: flex; align-items: center; gap: 10px; }
  .msg-doc-icon { width: 40px; height: 40px; border-radius: 10px; background: var(--bg-3); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .msg-doc-info { flex: 1; min-width: 0; }
  .msg-doc-name { font-size: 13px; font-weight: 500; color: var(--text); display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .msg-doc-size { font-size: 11px; color: var(--text-3); }
  .msg-download-btn { width: 32px; height: 32px; border-radius: 50%; background: none; border: none; cursor: pointer; color: var(--accent); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .date-separator { align-self: center; font-size: 11px; color: var(--text-3); background: var(--date-sep-bg, rgba(0,0,0,0.2)); padding: 4px 12px; border-radius: 8px; margin: 12px 0; }
</style>