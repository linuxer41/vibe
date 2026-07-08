<script lang="ts">
  import Icon from '$lib/icon/Icon.svelte';
  import { avatarUrl } from '$lib/helpers';
  import type { User, GameSession, GameParticipant } from '$lib/types';

  let {
    usr,
    currentSession,
    participants,
    gamePhase,
    questionText,
    roundNumber,
    isCreator,
    hasAnswered,
    allAnswers,
    onleave,
    onstartTrivia,
    onsubmitAnswer,
    onrevealRound,
    onendGame
  }: {
    usr: User | null;
    currentSession: GameSession;
    participants: GameParticipant[];
    gamePhase: string;
    questionText: string;
    roundNumber: number;
    isCreator: boolean;
    hasAnswered: boolean;
    allAnswers: Map<number, string>;
    onleave: () => void;
    onstartTrivia: (question: string) => void;
    onsubmitAnswer: (answer: string) => void;
    onrevealRound: () => void;
    onendGame: () => void;
  } = $props();

  let myAnswer = $state('');
  let creatorQuestion = $state('');
</script>

<div class="play-header">
  <button class="back-btn" onclick={onleave}>
    <Icon name="chevron-right" size={22} />
  </button>
  <span class="play-title">Trivia</span>
  <span class="play-round">Ronda {roundNumber || '-'}</span>
</div>
<div class="play-body">
  <div class="participants-section">
    <span class="section-label">Jugadores ({participants.length})</span>
    <div class="participants-list">
      {#each participants as p}
        <div class="participant-chip" class:is-me={p.userId === usr?.id}>
          <img src={avatarUrl(p.userId)} alt="" class="participant-avatar" />
          <span class="participant-name">{p.name}</span>
          {#if p.userId === currentSession?.creator_id}<span class="host-badge">Host</span>{/if}
        </div>
      {/each}
    </div>
  </div>
  <div class="game-area">
    {#if gamePhase === 'lobby'}
      {#if isCreator}
        <div class="question-setup">
          <p class="phase-hint">Escribe la primera pregunta para empezar</p>
          <input type="text" bind:value={creatorQuestion} placeholder="Escribe tu pregunta..." class="game-input" onkeydown={(e) => { if (e.key === 'Enter') onstartTrivia(creatorQuestion); }} />
          <button class="game-btn primary" onclick={() => onstartTrivia(creatorQuestion)} disabled={!creatorQuestion.trim()}>Iniciar Ronda</button>
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
            <input type="text" bind:value={myAnswer} placeholder="Tu respuesta..." class="game-input" onkeydown={(e) => { if (e.key === 'Enter') onsubmitAnswer(myAnswer); }} />
            <button class="game-btn primary" onclick={() => onsubmitAnswer(myAnswer)} disabled={!myAnswer.trim()}>Enviar</button>
          </div>
        {:else}
          <div class="answered-msg">
            <Icon name="check" size={20} strokeWidth={2.5} style="color: var(--accent)" />
            <span>Respuesta enviada · {allAnswers.size}/{participants.length} respondieron</span>
          </div>
          {#if isCreator && allAnswers.size === participants.length}
            <button class="game-btn primary" onclick={onrevealRound}>Revelar respuestas</button>
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
            <input type="text" bind:value={creatorQuestion} placeholder="Siguiente pregunta..." class="game-input" onkeydown={(e) => { if (e.key === 'Enter') onstartTrivia(creatorQuestion); }} />
            <button class="game-btn primary" onclick={() => onstartTrivia(creatorQuestion)} disabled={!creatorQuestion.trim()}>Siguiente ronda</button>
            <button class="game-btn danger" onclick={onendGame}>Finalizar juego</button>
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
              <span class="finish-name">{p.name}</span>
            </div>
          {/each}
        </div>
        <button class="game-btn primary" onclick={onleave}>Volver a juegos</button>
      </div>
    {/if}
  </div>
</div>

<style>
  .play-header { display: flex; align-items: center; gap: 10px; padding: 10px 12px; background: var(--bg-2); border-bottom: 1px solid var(--border); flex-shrink: 0; }
  .back-btn { background: none; border: none; color: var(--text); cursor: pointer; padding: 4px; display: flex; border-radius: 50%; }
  .back-btn:hover { background: rgba(255,255,255,0.08); }
  .play-title { font-size: 16px; font-weight: 700; color: var(--text); flex: 1; }
  .play-round { font-size: 12px; color: var(--text-3); font-weight: 500; padding: 4px 10px; background: var(--bg-3); border-radius: 8px; }
  .play-body { flex: 1; overflow-y: auto; padding: 12px; display: flex; flex-direction: column; gap: 12px; }
  .section-label { font-size: 11px; font-weight: 600; color: var(--text-3); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; display: block; }
  .participants-list { display: flex; flex-wrap: wrap; gap: 6px; }
  .participant-chip { display: flex; align-items: center; gap: 6px; padding: 4px 10px 4px 4px; background: var(--bg-2); border-radius: 20px; }
  .participant-chip.is-me { background: rgba(var(--accent-rgb),0.12); }
  .participant-avatar { width: 24px; height: 24px; border-radius: 50%; object-fit: cover; }
  .participant-name { font-size: 12px; font-weight: 500; color: var(--text); }
  .host-badge { font-size: 9px; font-weight: 700; color: var(--accent); background: rgba(255,255,255,0.08); padding: 1px 6px; border-radius: 4px; }
  .game-area { flex: 1; }
  .phase-hint { font-size: 14px; color: var(--text-2); margin-bottom: 12px; }
  .game-input { width: 100%; padding: 14px 16px; border: 2px solid var(--border); border-radius: 12px; font-size: 15px; outline: none; background: var(--bg-3); color: var(--text); margin-bottom: 12px; box-sizing: border-box; font-family: inherit; }
  .game-input:focus { border-color: var(--accent); }
  .game-btn { width: 100%; padding: 13px; border: none; border-radius: 12px; font-size: 14px; font-weight: 700; cursor: pointer; margin-bottom: 8px; transition: opacity 0.15s, transform 0.1s; font-family: inherit; }
  .game-btn:active { transform: scale(0.97); }
  .game-btn:disabled { opacity: 0.4; cursor: not-allowed; transform: none; }
  .game-btn.primary { background: var(--accent); color: #000; }
  .game-btn.danger { background: #ef4444; color: #fff; }
  .waiting-msg { display: flex; flex-direction: column; align-items: center; gap: 16px; padding: 48px 24px; text-align: center; }
  .waiting-msg p { color: var(--text-3); font-size: 15px; }
  .question-card, .reveal-card, .finish-card { background: var(--bg-2); border-radius: 16px; padding: 20px; }
  .question-badge { display: inline-block; font-size: 10px; font-weight: 700; color: var(--accent); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; background: rgba(255,255,255,0.06); padding: 4px 10px; border-radius: 6px; }
  .question-text { font-size: 18px; font-weight: 600; color: var(--text); margin: 0 0 16px; line-height: 1.4; }
  .answer-row { display: flex; gap: 8px; align-items: flex-start; }
  .answer-row .game-input { flex: 1; margin-bottom: 0; }
  .answer-row .game-btn { width: auto; padding: 14px 20px; white-space: nowrap; margin-bottom: 0; }
  .answered-msg { display: flex; align-items: center; gap: 8px; color: var(--text-2); font-size: 14px; margin-bottom: 12px; }
  .answers-grid { display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px; }
  .answer-item { display: flex; align-items: center; gap: 10px; padding: 10px; background: var(--bg-3); border-radius: 12px; }
  .answer-item.is-me { background: rgba(var(--accent-rgb),0.1); }
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
