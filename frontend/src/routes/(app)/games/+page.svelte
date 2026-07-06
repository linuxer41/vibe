<script lang="ts">
  import { onMount } from 'svelte';
  import { avatarUrl, formatDate, loadGames, loadMemes } from '$lib/helpers';
  import { user, socket, games, memes, chats, stickerPacks, showToast } from '$lib/stores';
  import type { User, Game, Meme } from '$lib/types';

  let usr: User | null = $state(null);
  let sk: any = $state(null);
  let activeTab: 'games' | 'memes' | 'stickers' = $state('games');
  let memeInput = $state({ imageUrl: '', caption: '', template: '' });
  let selectedGame: Game | null = $state(null);
  let selectedChat = $state('');

  user.subscribe((v) => usr = v);
  socket.subscribe((v) => sk = v);

  onMount(() => { loadGames(); loadMemes(); });

  function createMeme() {
    const m = memeInput;
    if (!m.imageUrl) return showToast('URL de imagen requerida');
    sk?.emit('create_meme', { imageUrl: m.imageUrl, caption: m.caption, template: m.template }, (res: any) => {
      if (res?.ok) { showToast('Meme creado'); memeInput = { imageUrl: '', caption: '', template: '' }; loadMemes(); }
    });
  }

  function likeMeme(memeId: number) {
    sk?.emit('like_meme', { memeId });
  }

  function startGame(game: Game) {
    selectedGame = game;
    if (!selectedChat) return showToast('Selecciona un chat');
    const chatId = parseInt(selectedChat);
    sk?.emit('create_game', { gameId: game.id, chatId }, (res: any) => {
      if (res?.ok) showToast(`Juego iniciado en el chat!`);
    });
  }
</script>

<div class="games-view">
  <div class="games-tabs">
    <button class="games-tab" class:active={activeTab === 'games'} onclick={() => activeTab = 'games'}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 12h4M8 10v4M15 13h.01M18 11h.01"/></svg>
      Juegos
    </button>
    <button class="games-tab" class:active={activeTab === 'memes'} onclick={() => activeTab = 'memes'}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
      Memes
    </button>
    <button class="games-tab" class:active={activeTab === 'stickers'} onclick={() => activeTab = 'stickers'}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
      Stickers
    </button>
  </div>

  {#if activeTab === 'games'}
    <div class="games-grid">
      {#each $games as g (g.id)}
        <div class="game-card" onclick={() => startGame(g)}>
          <div class="game-icon">
            {#if g.type === 'wordle'}
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
            {:else if g.type === 'trivia'}
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9 9a3 3 0 0 1 6 0c0 2-3 3-3 5M12 17h.01"/></svg>
            {:else}
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/></svg>
            {/if}
          </div>
          <div class="game-info">
            <span class="game-name">{g.name}</span>
            <span class="game-type">{g.type} · {g.max_players} jugadores</span>
          </div>
          <div class="game-start-hint">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" stroke-width="2.5" stroke-linecap="round"><path d="M9 18l6-6-6-6"/></svg>
          </div>
        </div>
      {/each}
      {#if $games.length === 0}
        <div class="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" stroke-width="1.5"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 12h4M8 10v4M15 13h.01M18 11h.01"/></svg>
          <p>No hay juegos disponibles</p>
        </div>
      {/if}
    </div>

    {#if selectedGame}
      <div class="game-start-dialog">
        <p>Iniciar <strong>{selectedGame.name}</strong></p>
        <select bind:value={selectedChat} class="modal-input">
          <option value="">Selecciona un chat</option>
          {#each $chats as c}
            <option value={c.id}>{c.name}</option>
          {/each}
        </select>
        <button class="modal-btn" onclick={() => startGame(selectedGame)}>Iniciar juego</button>
      </div>
    {/if}

  {:else if activeTab === 'memes'}
    <!-- Create Meme -->
    <div class="meme-create">
      <input type="text" bind:value={memeInput.imageUrl} placeholder="URL de la imagen" class="modal-input" />
      <input type="text" bind:value={memeInput.caption} placeholder="Texto del meme" class="modal-input" />
      <input type="text" bind:value={memeInput.template} placeholder="Plantilla (opcional)" class="modal-input" />
      <button class="modal-btn" onclick={createMeme}>Crear Meme</button>
    </div>

    <!-- Memes Feed -->
    <div class="memes-feed">
      {#each $memes as m (m.id)}
        <div class="meme-card">
          <img src={m.image_url} alt={m.caption} class="meme-img" loading="lazy" />
          {#if m.caption}
            <p class="meme-caption">{m.caption}</p>
          {/if}
          <div class="meme-footer">
            <div class="meme-author">
              <img src={avatarUrl(m.user_id)} alt="" class="meme-avatar" />
              <span>{m.display_name}</span>
            </div>
            <button class="like-btn" onclick={() => likeMeme(m.id)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" stroke-width="2"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>
              <span>{m.likes_count || 0}</span>
            </button>
          </div>
        </div>
      {/each}
      {#if $memes.length === 0}
        <div class="empty-state"><p>No hay memes aún</p></div>
      {/if}
    </div>

  {:else if activeTab === 'stickers'}
    <div class="stickers-view">
      {#each $stickerPacks as pack (pack.id)}
        <div class="pack-card">
          <div class="pack-header">
            <span class="pack-name">{pack.name}</span>
            <span class="pack-author">por {pack.display_name}</span>
            {#if pack.price > 0}
              <span class="pack-price">${pack.price}</span>
            {:else}
              <span class="pack-free">Gratis</span>
            {/if}
          </div>
        </div>
      {/each}
      {#if $stickerPacks.length === 0}
        <div class="empty-state"><p>No hay packs de stickers</p></div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .games-view { flex: 1; overflow-y: auto; padding-bottom: 80px; }
  .games-tabs { display: flex; gap: 2px; padding: 8px 12px; background: var(--bg-2); border-bottom: 1px solid var(--border); }
  .games-tab { flex: 1; display: flex; align-items: center; justify-content: center; gap: 4px; padding: 8px 6px; background: none; border: none; color: var(--text-3); font-size: 11px; font-weight: 500; cursor: pointer; border-radius: 8px; transition: all 0.2s; }
  .games-tab.active { background: var(--accent); color: #000; font-weight: 600; }
  .games-grid { padding: 8px 12px; }
  .game-card { display: flex; align-items: center; gap: 12px; padding: 14px; background: var(--bg-2); border-radius: 12px; margin-bottom: 8px; cursor: pointer; transition: background 0.15s; }
  .game-card:hover { background: var(--bg-3); }
  .game-icon { width: 48px; height: 48px; border-radius: 12px; background: var(--bg-3); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .game-info { flex: 1; }
  .game-name { display: block; font-size: 15px; font-weight: 600; color: var(--text); }
  .game-type { font-size: 12px; color: var(--text-3); }
  .game-start-hint { opacity: 0.4; }
  .empty-state { display: flex; flex-direction: column; align-items: center; padding: 48px 24px; gap: 8px; }
  .empty-state p { color: var(--text-3); font-size: 14px; }
  .game-start-dialog { margin: 12px; padding: 16px; background: var(--bg-2); border-radius: 16px; }
  .game-start-dialog p { font-size: 15px; color: var(--text); margin-bottom: 12px; }
  .modal-input { width: 100%; padding: 12px 16px; border: 2px solid rgba(255,255,255,0.08); border-radius: 12px; font-size: 15px; outline: none; background: var(--bg-3); color: var(--text); margin-bottom: 12px; box-sizing: border-box; }
  .modal-btn { width: 100%; padding: 13px; background: var(--accent); color: #000; font-weight: 700; border: none; border-radius: 12px; font-size: 15px; cursor: pointer; }
  .meme-create { padding: 12px; border-bottom: 1px solid var(--border); }
  .memes-feed { padding: 8px 12px; }
  .meme-card { margin-bottom: 12px; background: var(--bg-2); border-radius: 12px; overflow: hidden; }
  .meme-img { width: 100%; display: block; }
  .meme-caption { padding: 8px 12px; font-size: 14px; color: var(--text); font-weight: 500; }
  .meme-footer { display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; border-top: 1px solid var(--border); }
  .meme-author { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--text-2); }
  .meme-avatar { width: 20px; height: 20px; border-radius: 50%; object-fit: cover; }
  .like-btn { display: flex; align-items: center; gap: 4px; background: none; border: none; cursor: pointer; color: var(--danger); font-size: 12px; }
  .stickers-view { padding: 12px; }
  .pack-card { padding: 12px; background: var(--bg-2); border-radius: 12px; margin-bottom: 8px; }
  .pack-header { display: flex; align-items: center; gap: 8px; }
  .pack-name { font-size: 15px; font-weight: 600; color: var(--text); }
  .pack-author { font-size: 12px; color: var(--text-3); flex: 1; }
  .pack-price { font-size: 14px; font-weight: 700; color: var(--accent); }
  .pack-free { font-size: 12px; color: var(--accent); font-weight: 600; padding: 2px 8px; background: rgba(34,197,94,0.15); border-radius: 4px; }
</style>
