<script lang="ts">
  import { avatarUrl } from '$lib/helpers';
  import Icon from '$lib/icon/Icon.svelte';
  import type { Chat } from '$lib/types';

  let {
    show,
    chats,
    excludeChatId,
    onclose,
    onForward
  }: {
    show: boolean;
    chats: Chat[];
    excludeChatId: number;
    onclose: () => void;
    onForward: (chatId: number) => void;
  } = $props();

  let filtered = $derived(chats.filter(c => c.id !== excludeChatId));
</script>

{#if show}
  <div class="forward-overlay" onclick={onclose}>
    <div class="forward-sheet" onclick={(e) => e.stopPropagation()}>
      <div class="forward-header">
        <h3>Reenviar mensaje</h3>
        <button class="close-btn" onclick={onclose}>
          <Icon name="x" size={20} />
        </button>
      </div>
      <div class="forward-list">
        {#each filtered as c}
          <button class="forward-item" onclick={() => onForward(c.id)}>
            <img src={avatarUrl(c.type === 'private' ? (c.members?.[0]?.id || c.id) : c.id)} alt="" class="forward-avatar" />
            <span>{c.name}</span>
          </button>
        {/each}
      </div>
    </div>
  </div>
{/if}

<style>
  .forward-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 100; display: flex; align-items: flex-end; }
  .forward-sheet { width: 100%; max-width: 430px; margin: 0 auto; background: var(--bg-2); border-radius: 16px 16px 0 0; max-height: 70vh; display: flex; flex-direction: column; }
  .forward-header { display: flex; align-items: center; justify-content: space-between; padding: 16px; border-bottom: 1px solid var(--border); }
  .forward-header h3 { font-size: 16px; color: var(--text); }
  .close-btn { background: none; border: none; color: var(--text-2); cursor: pointer; padding: 4px; border-radius: 50%; display: flex; }
  .forward-list { overflow-y: auto; padding: 8px 0; }
  .forward-item { display: flex; align-items: center; gap: 12px; width: 100%; padding: 12px 16px; background: none; border: none; color: var(--text); font-size: 14px; cursor: pointer; text-align: left; }
  .forward-item:hover { background: var(--bg-3); }
  .forward-avatar { width: 40px; height: 40px; border-radius: 50%; object-fit: cover; }
</style>
