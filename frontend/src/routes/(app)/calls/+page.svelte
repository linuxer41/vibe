<script lang="ts">
  import { avatarUrl, formatDate, formatDuration } from '$lib/helpers';
  import { calls } from '$lib/stores';
</script>

<div class="call-list">
  {#each $calls as c}
    <div class="chat-item">
      <div class="call-icon-wrap">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
          class:call-missed={c.status === 'missed'}>
          {#if c.direction === 'incoming'}
            <path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/>
          {:else if c.direction === 'outgoing'}
            <path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/>
          {:else}
            <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91"/>
          {/if}
        </svg>
      </div>
      <div class="chat-info">
        <div class="chat-top">
          <span class="chat-name">{c.other_name}</span>
          <span class="chat-time">{formatDate(c.created_at)}</span>
        </div>
        <div class="chat-bottom">
          <span class="chat-preview" class:missed={c.status === 'missed'}>
            {#if c.direction === 'incoming'}Entrante
            {:else if c.direction === 'outgoing'}Saliente
            {:else if c.status === 'missed'}Perdida
            {:else}Llamada{/if}
            {#if c.duration} · {formatDuration(c.duration)}{/if}
          </span>
        </div>
      </div>
      <button class="call-action-btn">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
      </button>
    </div>
  {/each}
  {#if $calls.length === 0}
    <div class="empty-state">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" stroke-width="1.5" stroke-linecap="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
      <p>No hay llamadas recientes</p>
    </div>
  {/if}
</div>

<style>
  .call-list { flex: 1; overflow-y: auto; }
  .chat-item {
    display: flex; align-items: center; gap: 12px;
    padding: 12px 16px; cursor: default;
    border-bottom: 1px solid var(--border-2);
  }
  .call-icon-wrap {
    width: 48px; height: 48px; border-radius: 50%;
    background: var(--bg-2); display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  }
  .call-icon-wrap svg { color: var(--accent); }
  .call-icon-wrap svg.call-missed { color: var(--danger); }
  .chat-info { flex: 1; min-width: 0; }
  .chat-top, .chat-bottom { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .chat-top { margin-bottom: 4px; }
  .chat-name { font-size: 15px; font-weight: 600; color: var(--text); }
  .chat-time { font-size: 10px; color: var(--text-3); white-space: nowrap; }
  .chat-preview { font-size: 13px; color: var(--text-2); }
  .chat-preview.missed { color: var(--danger); font-weight: 500; }
  .call-action-btn { background: none; border: none; cursor: pointer; padding: 8px; flex-shrink: 0; }
  .empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 64px 24px; gap: 12px; }
  .empty-state p { color: var(--text-3); font-size: 14px; }
</style>
