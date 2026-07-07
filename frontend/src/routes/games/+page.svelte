<script lang="ts">
  import Icon from '$lib/icon/Icon.svelte';
  import { onMount, onDestroy } from 'svelte';
  import { avatarUrl, formatDate, loadGames, loadMemes } from '$lib/helpers';
  import { user, socket, games, chats, memes, stickerPacks, showToast } from '$lib/stores';
  import type { User, Game, GameSession, GameParticipant } from '$lib/types';

  let usr: User | null = $state(null);
  let sk: any = $state(null);
  user.subscribe((v) => usr = v);
  socket.subscribe((v) => sk = v);

  let activeTab: 'games' | 'memes' | 'stickers' = $state('games');
  let memeInput = $state({ imageUrl: '', caption: '', template: '' });
  let selectedGame: Game | null = $state(null);
  let selectedChat = $state('');

  // Play state
  let view: 'browse' | 'play' = $state('browse');
  let currentSession = $state<GameSession | null>(null);
  let participants = $state<GameParticipant[]>([]);
  let gamePhase: 'lobby' | 'question' | 'revealed' | 'finished' = $state('lobby');
  let questionText = $state('');
  let myAnswer = $state('');
  let allAnswers = $state<Map<number, string>>(new Map());
  let roundNumber = $state(0);
  let creatorQuestion = $state('');
  let isCreator = $derived(currentSession?.creator_id === usr?.id);
  let hasAnswered = $derived(allAnswers.has(usr?.id ?? -1));

  onMount(() => { loadGames(); loadMemes(); });

  onDestroy(() => {
    sk?.off('game_update', handleGameEvent);
    sk?.off('game_action', handleGameEvent);
    sk?.off('player_joined', handlePlayerJoined);
  });

  // ── Memes ──
  function createMeme() {
    const m = memeInput;
    if (!m.imageUrl) return showToast('URL de imagen requerida');
    sk?.emit('create_meme', { imageUrl: m.imageUrl, caption: m.caption, template: m.template }, (res: any) => {
      if (res?.ok) { showToast('Meme creado'); memeInput = { imageUrl: '', caption: '', template: '' }; loadMemes(); }
    });
  }
  function likeMeme(memeId: number) { sk?.emit('like_meme', { memeId }); }

  // ── Game helpers ──
  function startGame(game: Game) {
    selectedGame = game;
    if (!selectedChat) return showToast('Selecciona un chat');
    const chatId = parseInt(selectedChat);
    sk?.emit('create_game', { gameId: game.id, chatId }, (res: any) => {
      if (res?.ok) {
        const session: GameSession = res.session || { id: res.sessionId, game_id: game.id, chat_id: chatId, creator_id: usr!.id, status: 'waiting' };
        enterPlay(session);
        showToast('Juego creado');
      } else {
        showToast('Error al crear juego');
      }
    });
  }

  function enterPlay(session: GameSession) {
    currentSession = session;
    participants = [{ userId: usr!.id, name: usr!.display_name || usr!.username, score: 0 }];
    allAnswers = new Map();
    gamePhase = 'lobby';
    roundNumber = 0;
    view = 'play';
    selectedGame = null;
    // Join socket room
    sk?.emit('join_game', { sessionId: session.id });
    // Attach listeners
    sk?.on('game_update', handleGameEvent);
    sk?.on('game_action', handleGameEvent);
    sk?.on('player_joined', handlePlayerJoined);
  }

  function handlePlayerJoined(data: any) {
    if (!participants.find(p => p.userId === data.userId)) {
      participants = [...participants, { userId: data.userId, name: data.name || `Player ${data.userId}`, score: 0 }];
    }
  }

  function handleGameEvent(data: any) {
    if (data.action === 'start_round' && data.userId !== usr?.id) {
      questionText = data.data.question;
      roundNumber = data.data.round;
      allAnswers = new Map();
      gamePhase = 'question';
    } else if (data.action === 'answer' && data.userId !== usr?.id) {
      allAnswers.set(data.userId, data.data.answer);
      allAnswers = new Map(allAnswers);
      if (allAnswers.size === participants.length) {
        gamePhase = 'revealed';
      }
    } else if (data.action === 'reveal') {
      gamePhase = 'revealed';
    } else if (data.action === 'end_game') {
      gamePhase = 'finished';
    } else if (data.action === 'player_joined' && data.userId !== usr?.id) {
      handlePlayerJoined(data);
    }
  }

  // ── Game actions ──
  function startTrivia() {
    if (!isCreator || !creatorQuestion.trim()) return showToast('Escribe una pregunta');
    roundNumber++;
    gamePhase = 'question';
    questionText = creatorQuestion;
    allAnswers = new Map();
    sk?.emit('game_action', { sessionId: currentSession!.id, action: 'start_round', data: { question: creatorQuestion, round: roundNumber } });
    creatorQuestion = '';
  }

  function submitAnswer() {
    if (!myAnswer.trim()) return;
    const ans = myAnswer.trim();
    allAnswers.set(usr!.id, ans);
    allAnswers = new Map(allAnswers);
    myAnswer = '';
    sk?.emit('game_action', { sessionId: currentSession!.id, action: 'answer', data: { answer: ans } });
  }

  function revealRound() {
    sk?.emit('game_action', { sessionId: currentSession!.id, action: 'reveal', data: { round: roundNumber } });
    gamePhase = 'revealed';
  }

  function endGame() {
    sk?.emit('game_action', { sessionId: currentSession!.id, action: 'end_game' });
    gamePhase = 'finished';
  }

  function leaveGame() {
    view = 'browse';
    currentSession = null;
    participants = [];
    allAnswers = new Map();
    gamePhase = 'lobby';
    roundNumber = 0;
    sk?.off('game_update', handleGameEvent);
    sk?.off('game_action', handleGameEvent);
    sk?.off('player_joined', handlePlayerJoined);
  }

  function participantName(p: GameParticipant) {
    return p.name;
  }
</script>

<div class="games-view">
  {#if view === 'play' && currentSession}
    <div class="play-header">
      <button class="back-btn" onclick={leaveGame}>
        <Icon name="chevron-right" size={22} />
      </button>
      <span class="play-title">Trivia</span>
      <span class="play-round">Ronda {roundNumber || '-'}</span>
    </div>

    <div class="play-body">
      <!-- Participants -->
      <div class="participants-section">
        <span class="section-label">Jugadores ({participants.length})</span>
        <div class="participants-list">
          {#each participants as p}
            <div class="participant-chip" class:is-me={p.userId === usr?.id}>
              <img src={avatarUrl(p.userId)} alt="" class="participant-avatar" />
              <span class="participant-name">{participantName(p)}</span>
              {#if p.userId === currentSession?.creator_id}
                <span class="host-badge">Host</span>
              {/if}
            </div>
          {/each}
        </div>
      </div>

      <!-- Game area -->
      <div class="game-area">
        {#if gamePhase === 'lobby'}
          {#if isCreator}
            <div class="question-setup">
              <p class="phase-hint">Escribe la primera pregunta para empezar</p>
              <input type="text" bind:value={creatorQuestion} placeholder="Escribe tu pregunta..." class="game-input" onkeydown={(e) => { if (e.key === 'Enter') startTrivia(); }} />
              <button class="game-btn primary" onclick={startTrivia} disabled={!creatorQuestion.trim()}>Iniciar Ronda</button>
            </div>
          {:else}
            <div class="waiting-msg">
              <Icon name="clock" size={40} strokeWidth={1.5} style="color: var(--text-3)" />
              <p>Esperando a que el host inicie la partida...</p>
            </div>
          {/if}

        {:else if gamePhase === 'question'}
          <div class="question-card">
            <div class="question-badge">Pregunta</div>
            <p class="question-text">{questionText}</p>
            {#if !hasAnswered}
              <div class="answer-row">
                <input type="text" bind:value={myAnswer} placeholder="Tu respuesta..." class="game-input" onkeydown={(e) => { if (e.key === 'Enter') submitAnswer(); }} />
                <button class="game-btn primary" onclick={submitAnswer} disabled={!myAnswer.trim()}>Enviar</button>
              </div>
            {:else}
              <div class="answered-msg">
                <Icon name="check" size={20} strokeWidth={2.5} style="color: var(--accent)" />
                <span>Respuesta enviada · {allAnswers.size}/{participants.length} respondieron</span>
              </div>
              {#if isCreator && allAnswers.size === participants.length}
                <button class="game-btn primary" onclick={revealRound}>Revelar respuestas</button>
              {/if}
            {/if}
          </div>

        {:else if gamePhase === 'revealed'}
          <div class="reveal-card">
            <div class="question-badge">Respuestas</div>
            <p class="question-text">{questionText}</p>
            <div class="answers-grid">
              {#each [...allAnswers.entries()] as [uid, ans]}
                {@const p = participants.find(x => x.userId === uid)}
                <div class="answer-item" class:is-me={uid === usr?.id}>
                  <img src={avatarUrl(uid)} alt="" class="answer-avatar" />
                  <div class="answer-body">
                    <span class="answer-name">{p?.name || 'Jugador'}</span>
                    <span class="answer-text">{ans}</span>
                  </div>
                </div>
              {/each}
            </div>
            {#if isCreator}
              <div class="reveal-actions">
                <input type="text" bind:value={creatorQuestion} placeholder="Siguiente pregunta..." class="game-input" onkeydown={(e) => { if (e.key === 'Enter') startTrivia(); }} />
                <button class="game-btn primary" onclick={startTrivia} disabled={!creatorQuestion.trim()}>Siguiente ronda</button>
                <button class="game-btn danger" onclick={endGame}>Finalizar juego</button>
              </div>
            {:else}
              <p class="wait-next">Esperando siguiente ronda...</p>
            {/if}
          </div>

        {:else if gamePhase === 'finished'}
          <div class="finish-card">
            <Icon name="check" size={48} strokeWidth={1.5} style="color: var(--accent)" />
            <h2>Juego finalizado</h2>
            <p class="finish-rounds">{participants.length} jugadores · {roundNumber} rondas</p>
            <div class="finish-players">
              {#each participants as p}
                <div class="finish-player">
                  <img src={avatarUrl(p.userId)} alt="" class="finish-avatar" />
                  <span class="finish-name">{participantName(p)}</span>
                </div>
              {/each}
            </div>
            <button class="game-btn primary" onclick={leaveGame}>Volver a juegos</button>
          </div>
        {/if}
      </div>
    </div>

  {:else}
    <!-- BROWSE VIEW: original tabs + game listing -->
    <div class="games-tabs">
      <button class="games-tab" class:active={activeTab === 'games'} onclick={() => activeTab = 'games'}>
        <Icon name="gamepad" size={16} />
        Juegos
      </button>
      <button class="games-tab" class:active={activeTab === 'memes'} onclick={() => activeTab = 'memes'}>
        <Icon name="edit" size={16} />
        Memes
      </button>
      <button class="games-tab" class:active={activeTab === 'stickers'} onclick={() => activeTab = 'stickers'}>
        <Icon name="emoji" size={16} />
        Stickers
      </button>
    </div>

    {#if activeTab === 'games'}
      <div class="games-grid">
        {#each $games as g (g.id)}
          <div class="game-card" onclick={() => { selectedGame = g; }}>
            <div class="game-icon">
              {#if g.type === 'wordle'}
                <Icon name="grid" size={32} style="color: var(--accent)" />
              {:else if g.type === 'trivia'}
                <Icon name="info" size={32} style="color: var(--accent)" />
              {:else}
                <Icon name="play" size={32} style="color: var(--accent)" />
              {/if}
            </div>
            <div class="game-info">
              <span class="game-name">{g.name}</span>
              <span class="game-type">{g.type} · {g.max_players} jugadores</span>
            </div>
            <div class="game-start-hint">
              <Icon name="chevron-right" size={16} strokeWidth={2.5} style="color: var(--text-3)" />
            </div>
          </div>
        {/each}
        {#if $games.length === 0}
          <div class="empty-state">
            <Icon name="gamepad" size={48} strokeWidth={1.5} style="color: var(--text-3)" />
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
          <button class="modal-btn secondary" onclick={() => { selectedGame = null; }}>Cancelar</button>
        </div>
      {/if}

    {:else if activeTab === 'memes'}
      <div class="meme-create">
        <input type="text" bind:value={memeInput.imageUrl} placeholder="URL de la imagen" class="modal-input" />
        <input type="text" bind:value={memeInput.caption} placeholder="Texto del meme" class="modal-input" />
        <input type="text" bind:value={memeInput.template} placeholder="Plantilla (opcional)" class="modal-input" />
        <button class="modal-btn" onclick={createMeme}>Crear Meme</button>
      </div>
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
                <Icon name="thumbs-up" size={16} style="color: var(--danger)" />
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
  {/if}
</div>

<style>
  .games-view { flex: 1; overflow-y: auto; padding-bottom: 80px; }

  /* ── Browse tabs ── */
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
  .modal-input { width: 100%; padding: 12px 16px; border: 2px solid rgba(255,255,255,0.08); border-radius: 12px; font-size: 15px; outline: none; background: var(--bg-3); color: var(--text); margin-bottom: 12px; box-sizing: border-box; font-family: inherit; }
  .modal-btn { width: 100%; padding: 13px; background: var(--accent); color: #000; font-weight: 700; border: none; border-radius: 12px; font-size: 15px; cursor: pointer; margin-bottom: 6px; font-family: inherit; }
  .modal-btn.secondary { background: var(--bg-3); color: var(--text); }
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

  /* ── Play view ── */
  .play-header {
    display: flex; align-items: center; gap: 10px;
    padding: 10px 12px; background: var(--bg-2); border-bottom: 1px solid var(--border); flex-shrink: 0;
  }
  .back-btn {
    background: none; border: none; color: var(--text); cursor: pointer;
    padding: 4px; display: flex; border-radius: 50%;
  }
  .back-btn:hover { background: rgba(255,255,255,0.08); }
  .play-title { font-size: 16px; font-weight: 700; color: var(--text); flex: 1; }
  .play-round { font-size: 12px; color: var(--text-3); font-weight: 500; padding: 4px 10px; background: var(--bg-3); border-radius: 8px; }

  .play-body { flex: 1; overflow-y: auto; padding: 12px; display: flex; flex-direction: column; gap: 12px; }

  .participants-section {}
  .section-label { font-size: 11px; font-weight: 600; color: var(--text-3); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; display: block; }
  .participants-list { display: flex; flex-wrap: wrap; gap: 6px; }
  .participant-chip {
    display: flex; align-items: center; gap: 6px;
    padding: 4px 10px 4px 4px; background: var(--bg-2); border-radius: 20px;
  }
  .participant-chip.is-me { background: rgba(34,197,94,0.12); }
  .participant-avatar { width: 24px; height: 24px; border-radius: 50%; object-fit: cover; }
  .participant-name { font-size: 12px; font-weight: 500; color: var(--text); }
  .host-badge { font-size: 9px; font-weight: 700; color: var(--accent); background: rgba(255,255,255,0.08); padding: 1px 6px; border-radius: 4px; }

  .game-area { flex: 1; }

  .phase-hint { font-size: 14px; color: var(--text-2); margin-bottom: 12px; }
  .game-input {
    width: 100%; padding: 14px 16px; border: 2px solid rgba(255,255,255,0.08); border-radius: 12px;
    font-size: 15px; outline: none; background: var(--bg-3); color: var(--text);
    margin-bottom: 12px; box-sizing: border-box; font-family: inherit;
  }
  .game-input:focus { border-color: var(--accent); }
  .game-btn {
    width: 100%; padding: 13px; border: none; border-radius: 12px;
    font-size: 14px; font-weight: 700; cursor: pointer; margin-bottom: 8px;
    transition: opacity 0.15s, transform 0.1s; font-family: inherit;
  }
  .game-btn:active { transform: scale(0.97); }
  .game-btn:disabled { opacity: 0.4; cursor: not-allowed; transform: none; }
  .game-btn.primary { background: var(--accent); color: #000; }
  .game-btn.danger { background: #ef4444; color: #fff; }

  .waiting-msg {
    display: flex; flex-direction: column; align-items: center; gap: 16px;
    padding: 48px 24px; text-align: center;
  }
  .waiting-msg p { color: var(--text-3); font-size: 15px; }

  .question-card, .reveal-card, .finish-card {
    background: var(--bg-2); border-radius: 16px; padding: 20px;
  }
  .question-badge {
    display: inline-block; font-size: 10px; font-weight: 700; color: var(--accent);
    text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;
    background: rgba(255,255,255,0.06); padding: 4px 10px; border-radius: 6px;
  }
  .question-text { font-size: 18px; font-weight: 600; color: var(--text); margin: 0 0 16px; line-height: 1.4; }

  .answer-row { display: flex; gap: 8px; align-items: flex-start; }
  .answer-row .game-input { flex: 1; margin-bottom: 0; }
  .answer-row .game-btn { width: auto; padding: 14px 20px; white-space: nowrap; margin-bottom: 0; }

  .answered-msg {
    display: flex; align-items: center; gap: 8px;
    color: var(--text-2); font-size: 14px; margin-bottom: 12px;
  }

  .answers-grid { display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px; }
  .answer-item {
    display: flex; align-items: center; gap: 10px;
    padding: 10px; background: var(--bg-3); border-radius: 12px;
  }
  .answer-item.is-me { background: rgba(34,197,94,0.1); }
  .answer-avatar { width: 28px; height: 28px; border-radius: 50%; object-fit: cover; }
  .answer-body { display: flex; flex-direction: column; gap: 2px; flex: 1; }
  .answer-name { font-size: 11px; font-weight: 600; color: var(--text-3); }
  .answer-text { font-size: 15px; font-weight: 500; color: var(--text); }

  .reveal-actions { border-top: 1px solid var(--border); padding-top: 16px; }
  .wait-next { text-align: center; color: var(--text-3); font-size: 14px; margin: 0; }

  .finish-card { text-align: center; display: flex; flex-direction: column; align-items: center; gap: 8px; }
  .finish-card h2 { font-size: 22px; color: var(--text); margin: 0; }
  .finish-rounds { font-size: 13px; color: var(--text-3); margin: 0; }
  .finish-players { display: flex; justify-content: center; gap: 16px; padding: 16px 0; }
  .finish-player { display: flex; flex-direction: column; align-items: center; gap: 4px; }
  .finish-avatar { width: 44px; height: 44px; border-radius: 50%; object-fit: cover; }
  .finish-name { font-size: 12px; color: var(--text); font-weight: 500; }
</style>
