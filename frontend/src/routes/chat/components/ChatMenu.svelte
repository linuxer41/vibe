<script lang="ts">
  import { goto } from '$app/navigation';
  import Icon from '$lib/icon/Icon.svelte';
  import type { Chat } from '$lib/types';

  let {
    show,
    chatInfo,
    otherMemberId,
    onclose,
    onSearch,
    onClearChat,
    onDeleteChat
  }: {
    show: boolean;
    chatInfo: Chat | null;
    otherMemberId: number;
    onclose: () => void;
    onSearch?: () => void;
    onClearChat?: () => void;
    onDeleteChat?: () => void;
  } = $props();
</script>

<div class="overlay" class:hidden={!show} onclick={onclose} role="presentation">
  <div class="sheet" onclick={(e) => e.stopPropagation()} role="dialog">
    <div class="handle"></div>
    <div class="options">
      <button class="opt-btn" onclick={() => { onclose(); onSearch?.(); }}>
        <Icon name="search" size={20} />
        <span>Buscar en chat</span>
      </button>
      <button class="opt-btn" onclick={() => { onclose(); }}>
        <Icon name="image" size={20} />
        <span>Archivos compartidos</span>
      </button>
      <button class="opt-btn" onclick={() => { onclose(); onClearChat?.(); }}>
        <Icon name="trash" size={20} />
        <span>Vaciar chat</span>
      </button>
      {#if chatInfo?.type === 'private'}
        <button class="opt-btn" onclick={() => { onclose(); goto(`/contact?id=${otherMemberId}`); }}>
          <Icon name="user" size={20} />
          <span>Ver contacto</span>
        </button>
      {/if}
      <button class="opt-btn danger" onclick={() => { onclose(); onDeleteChat?.(); }}>
        <Icon name="x" size={20} />
        <span>Eliminar chat</span>
      </button>
    </div>
  </div>
</div>

<style>
  .overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 100; display: flex; align-items: flex-end; justify-content: center; transition: opacity 0.2s; }
  .overlay.hidden { opacity: 0; pointer-events: none; }
  .sheet { width: 100%; max-width: 430px; background: var(--bg-2); border-radius: 16px 16px 0 0; padding-bottom: env(safe-area-inset-bottom); }
  .handle { width: 36px; height: 4px; background: var(--bg-3); border-radius: 2px; margin: 8px auto; }
  .options { padding: 8px 0; }
  .opt-btn { display: flex; align-items: center; gap: 14px; width: 100%; padding: 14px 20px; background: none; border: none; color: var(--text); font-size: 15px; cursor: pointer; text-align: left; }
  .opt-btn:hover { background: var(--bg-3); }
  .opt-btn.danger { color: var(--danger); }
</style>
