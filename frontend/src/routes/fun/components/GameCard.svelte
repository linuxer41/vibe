<script lang="ts">
  import Icon from '$lib/icon/Icon.svelte';
  import type { Game } from '$lib/types';

  let { game, onclick }: { game: Game; onclick: () => void } = $props();
</script>

<div class="game-card" {onclick}>
  <div class="game-icon">
    {#if game.type === 'wordle'}
      <Icon name="grid" size={32} style="color: var(--accent)" />
    {:else if game.type === 'trivia'}
      <Icon name="info" size={32} style="color: var(--accent)" />
    {:else}
      <Icon name="play" size={32} style="color: var(--accent)" />
    {/if}
  </div>
  <div class="game-info">
    <span class="game-name">{game.name}</span>
    <span class="game-type">{game.type} · {game.max_players} jugadores</span>
  </div>
  <div class="game-start-hint">
    <Icon name="chevron-right" size={16} strokeWidth={2.5} style="color: var(--text-3)" />
  </div>
</div>

<style>
  .game-card { display: flex; align-items: center; gap: 12px; padding: 14px; background: var(--bg-2); border-radius: 12px; margin-bottom: 8px; cursor: pointer; transition: background 0.15s; }
  .game-card:hover { background: var(--bg-3); }
  .game-icon { width: 48px; height: 48px; border-radius: 12px; background: var(--bg-3); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .game-info { flex: 1; }
  .game-name { display: block; font-size: 15px; font-weight: 600; color: var(--text); }
  .game-type { font-size: 12px; color: var(--text-3); }
  .game-start-hint { opacity: 0.4; }
</style>
