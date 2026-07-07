<script lang="ts">
  import { avatarUrl, formatDate, formatDuration } from '$lib/helpers';
  import Icon from '$lib/icon/Icon.svelte';
  import { user, socket, calls, activeCall } from '$lib/stores';
  import type { User } from '$lib/types';
  import CallOverlay from '$lib/components/CallOverlay.svelte';

  let usr: User | null = $state(null);
  let sk: any = $state(null);
  let callList: any[] = $state([]);

  user.subscribe((v) => usr = v);
  socket.subscribe((v) => sk = v);
  calls.subscribe((v) => callList = v);

  function callFromHistory(c: any) {
    activeCall.set({
      callId: 0,
      peerId: c.other_id,
      peerName: c.other_name,
      type: 'audio',
      direction: 'outgoing',
      status: 'ringing',
      muted: false,
      speakerOn: false,
    });
  }
</script>

<div class="call-list">
  {#each callList as c}
    <div class="chat-item">
      <div class="call-icon-wrap" class:call-missed={c.status === 'missed'}>
        {#if c.direction === 'incoming' || c.direction === 'outgoing'}
          <Icon name="send" size={20} />
        {:else}
          <Icon name="phone" size={20} />
        {/if}
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
      <button class="call-action-btn" onclick={() => callFromHistory(c)} style="color: var(--accent)">
        <Icon name="phone" size={20} />
      </button>
    </div>
  {/each}
  {#if callList.length === 0}
    <div class="empty-state">
      <Icon name="phone" size={48} />
      <p>No hay llamadas recientes</p>
    </div>
  {/if}
</div>

<CallOverlay />

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
  .call-icon-wrap { color: var(--accent); }
  .call-icon-wrap.call-missed { color: var(--danger); }
  .chat-info { flex: 1; min-width: 0; }
  .chat-top, .chat-bottom { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .chat-top { margin-bottom: 4px; }
  .chat-name { font-size: 15px; font-weight: 600; color: var(--text); }
  .chat-time { font-size: 10px; color: var(--text-3); white-space: nowrap; }
  .chat-preview { font-size: 13px; color: var(--text-2); }
  .chat-preview.missed { color: var(--danger); font-weight: 500; }
  .call-action-btn { background: none; border: none; cursor: pointer; padding: 8px; flex-shrink: 0; }
  .empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 64px 24px; gap: 12px; color: var(--text-3); }
  .empty-state p { color: var(--text-3); font-size: 14px; }
</style>
