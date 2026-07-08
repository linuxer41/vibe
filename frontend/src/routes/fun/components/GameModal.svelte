<script lang="ts">
  import type { Game, Chat } from '$lib/types';

  let { game, chats, onStart, onCancel }: { game: Game; chats: Chat[]; onStart: (chatId: string) => void; onCancel: () => void } = $props();

  let selectedChat = $state('');
</script>

<div class="game-start-dialog">
  <p>Iniciar <strong>{game.name}</strong></p>
  <select bind:value={selectedChat} class="modal-input">
    <option value="">Selecciona un chat</option>
    {#each chats as c}
      <option value={c.id}>{c.name}</option>
    {/each}
  </select>
  <button class="modal-btn" onclick={() => onStart(selectedChat)}>Iniciar juego</button>
  <button class="modal-btn secondary" onclick={onCancel}>Cancelar</button>
</div>

<style>
  .game-start-dialog { margin: 12px; padding: 16px; background: var(--bg-2); border-radius: 16px; }
  .game-start-dialog p { font-size: 15px; color: var(--text); margin-bottom: 12px; }
  .modal-input { width: 100%; padding: 12px 16px; border: 2px solid var(--border); border-radius: 12px; font-size: 15px; outline: none; background: var(--bg-3); color: var(--text); margin-bottom: 12px; box-sizing: border-box; font-family: inherit; }
  .modal-btn { width: 100%; padding: 13px; background: var(--accent); color: #000; font-weight: 700; border: none; border-radius: 12px; font-size: 15px; cursor: pointer; margin-bottom: 6px; font-family: inherit; }
  .modal-btn.secondary { background: var(--bg-3); color: var(--text); }
</style>
