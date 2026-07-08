<script lang="ts">
  import { emit } from '$lib/socket';
  import Icon from '$lib/icon/Icon.svelte';
  import { onMount, onDestroy } from 'svelte';
  import { loadGames } from '$lib/helpers';
  import { user, socket, games, chats, showToast } from '$lib/stores';
  import type { User, Game, GameSession, GameParticipant } from '$lib/types';
  import GameCard from './components/GameCard.svelte';
  import GameModal from './components/GameModal.svelte';
  import TriviaGame from './components/TriviaGame.svelte';

  let usr: User | null = $state(null);
  let sk: any = $state(null);
  user.subscribe((v) => usr = v);
  socket.subscribe((v) => sk = v);

  let selectedGame: Game | null = $state(null);

  let view: 'browse' | 'play' = $state('browse');
  let currentSession = $state<GameSession | null>(null);
  let participants = $state<GameParticipant[]>([]);
  let gamePhase: 'lobby' | 'question' | 'revealed' | 'finished' = $state('lobby');
  let questionText = $state('');
  let allAnswers = $state<Map<number, string>>(new Map());
  let roundNumber = $state(0);
  let isCreator = $derived(currentSession?.creator_id === usr?.id);
  let hasAnswered = $derived(allAnswers.has(usr?.id ?? -1));

  onMount(() => { loadGames(); });

  onDestroy(() => {
    sk?.off('game_update', handleGameEvent);
    sk?.off('game_action', handleGameEvent);
    sk?.off('player_joined', handlePlayerJoined);
  });

  async function startGame(game: Game, chatId: string) {
    if (!chatId) return showToast('Selecciona un chat');
    const chatIdNum = parseInt(chatId);
    try {
      const res = await emit('create_game', { gameId: game.id, chatId: chatIdNum });
      if (res?.ok) {
        const session: GameSession = res.session || { id: res.sessionId, game_id: game.id, chat_id: chatIdNum, creator_id: usr!.id, status: 'waiting' };
        enterPlay(session);
        showToast('Juego creado');
      } else { showToast('Error al crear juego'); }
    } catch { showToast('Error al crear juego'); }
  }

  function enterPlay(session: GameSession) {
    currentSession = session;
    participants = [{ userId: usr!.id, name: usr!.display_name || usr!.username, score: 0 }];
    allAnswers = new Map();
    gamePhase = 'lobby';
    roundNumber = 0;
    view = 'play';
    selectedGame = null;
    emit('join_game', { sessionId: session.id });
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
      if (allAnswers.size === participants.length) { gamePhase = 'revealed'; }
    } else if (data.action === 'reveal') { gamePhase = 'revealed'; }
    else if (data.action === 'end_game') { gamePhase = 'finished'; }
    else if (data.action === 'player_joined' && data.userId !== usr?.id) { handlePlayerJoined(data); }
  }

  function onStartTrivia(question: string) {
    if (!isCreator || !question.trim()) return showToast('Escribe una pregunta');
    roundNumber++;
    gamePhase = 'question';
    questionText = question;
    allAnswers = new Map();
    emit('game_action', { sessionId: currentSession!.id, action: 'start_round', data: { question, round: roundNumber } });
  }

  function onSubmitAnswer(answer: string) {
    if (!answer.trim()) return;
    allAnswers.set(usr!.id, answer);
    allAnswers = new Map(allAnswers);
    emit('game_action', { sessionId: currentSession!.id, action: 'answer', data: { answer } });
  }

  function revealRound() {
    emit('game_action', { sessionId: currentSession!.id, action: 'reveal', data: { round: roundNumber } });
    gamePhase = 'revealed';
  }

  function endGame() {
    emit('game_action', { sessionId: currentSession!.id, action: 'end_game' });
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
</script>

{#if view === 'play' && currentSession}
  <TriviaGame
    {usr}
    {currentSession}
    {participants}
    {gamePhase}
    {questionText}
    {roundNumber}
    {isCreator}
    {hasAnswered}
    {allAnswers}
    onleave={leaveGame}
    onstartTrivia={onStartTrivia}
    onsubmitAnswer={onSubmitAnswer}
    onrevealRound={revealRound}
    onendGame={endGame}
  />
{:else}
  <div class="games-grid">
    {#each $games as g (g.id)}
      <GameCard game={g} onclick={() => { selectedGame = g; }} />
    {/each}
    {#if $games.length === 0}
      <div class="empty-state">
        <Icon name="gamepad" size={48} strokeWidth={1.5} style="color: var(--text-3)" />
        <p>No hay juegos disponibles</p>
      </div>
    {/if}
  </div>
  {#if selectedGame}
    {@const game = selectedGame}
    <GameModal game={game} chats={$chats} onStart={(chatId) => startGame(game, chatId)} onCancel={() => { selectedGame = null; }} />
  {/if}
{/if}

<style>
  .games-grid { padding: 8px 12px; }
  .empty-state { display: flex; flex-direction: column; align-items: center; padding: 48px 24px; gap: 8px; }
  .empty-state p { color: var(--text-3); font-size: 14px; }
</style>
