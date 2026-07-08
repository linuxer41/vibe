<script lang="ts">
  import Icon from '$lib/icon/Icon.svelte';
  import type { IconName } from '$lib/icon/icons';
  import type { Message } from '$lib/types';

  let {
    message,
    isOwn,
    x,
    y,
    onStartReply,
    onStartEdit,
    onOpenForward,
    onCopyText,
    onDeleteForMe,
    onDeleteForEveryone,
    onClose,
  }: {
    message: Message;
    isOwn: boolean;
    x: number;
    y: number;
    onStartReply?: (msg: Message) => void;
    onStartEdit?: (msg: Message) => void;
    onOpenForward?: (msg: Message) => void;
    onCopyText?: (msg: Message) => void;
    onDeleteForMe?: (msg: Message) => void;
    onDeleteForEveryone?: (msg: Message) => void;
    onClose?: () => void;
  } = $props();

  function handleClick(action: (msg: Message) => void) {
    action(message);
  }
</script>

<svelte:window onclick={onClose} />

<div class="ctx-menu" style="left: {Math.min(x, window.innerWidth - 200)}px; top: {Math.min(y, window.innerHeight - 360)}px;" onclick={(e) => e.stopPropagation()}>
  <button class="ctx-btn" onclick={() => handleClick(onStartReply!)}>
    <Icon name="reply" size={16} />
    Responder
  </button>
  {#if isOwn}
    <button class="ctx-btn" onclick={() => handleClick(onStartEdit!)}>
      <Icon name="edit" size={16} />
      Editar
    </button>
  {/if}
  <button class="ctx-btn" onclick={() => handleClick(onOpenForward!)}>
    <Icon name="forward" size={16} />
    Reenviar
  </button>
  {#if message.text}
    <button class="ctx-btn" onclick={() => handleClick(onCopyText!)}>
      <Icon name="copy" size={16} />
      Copiar texto
    </button>
  {/if}
  <div class="ctx-divider"></div>
  <button class="ctx-btn" onclick={() => handleClick(onDeleteForMe!)}>
    <Icon name="x" size={16} />
    Eliminar para mí
  </button>
  {#if isOwn}
    <button class="ctx-btn ctx-danger" onclick={() => handleClick(onDeleteForEveryone!)}>
      <Icon name="trash" size={16} />
      Eliminar para todos
    </button>
  {/if}
</div>

<style>
  .ctx-menu {
    position: fixed; z-index: 200;
    background: var(--bg-2); border: 1px solid var(--border);
    border-radius: 12px; padding: 4px; box-shadow: 0 4px 20px var(--shadow);
    display: flex; flex-direction: column; min-width: 200px;
  }
  .ctx-btn {
    display: flex; align-items: center; gap: 10px;
    padding: 10px 14px; background: none; border: none;
    font-size: 14px; color: var(--text); cursor: pointer;
    border-radius: 8px; transition: background 0.15s; text-align: left; font-family: inherit;
  }
  .ctx-btn:hover { background: var(--bg-3); }
  .ctx-danger { color: var(--danger); }
  .ctx-danger:hover { background: rgba(255,59,48,0.1); }
  .ctx-divider { height: 1px; background: var(--border); margin: 4px 8px; }
</style>