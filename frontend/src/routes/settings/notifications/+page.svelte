<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import Page from '$lib/components/Page.svelte';
  import Header from '$lib/components/Header.svelte';
  import { socket, notifications, showToast } from '$lib/stores';
  import type { SmartNotification } from '$lib/types';

  let sk: any = $state(null);
  socket.subscribe((v) => sk = v);

  onMount(() => {
    sk?.emit('get_notifications', (list: SmartNotification[]) => {
      notifications.set(list);
    });
  });

  function markRead(n: SmartNotification) {
    if (n.read) return;
    notifications.update((list) =>
      list.map((x) => x.id === n.id ? { ...x, read: 1 } : x)
    );
    sk?.emit('mark_notification_read', { id: n.id });
  }

  function formatDate(iso: string) {
    const d = new Date(iso);
    const today = new Date();
    if (d.toDateString() === today.toDateString()) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return 'Ayer';
    return d.toLocaleDateString('es', { day: 'numeric', month: 'short' });
  }

  function notifIcon(type: string): string {
    switch (type) {
      case 'new_message': return '💬';
      case 'missed_call': return '📞';
      case 'channel_subscribe': return '📡';
      case 'community_join': return '👥';
      default: return '🔔';
    }
  }
</script>

<Page>
  <Header title="Notificaciones" onback={() => goto('/settings')} />
  <div class="content">
    {#if $notifications.length === 0}
      <div class="empty">
        <span class="empty-icon">🔔</span>
        <span class="empty-text">No hay notificaciones</span>
      </div>
    {:else}
      {#each $notifications as n (n.id)}
        <button class="notif-row" class:unread={!n.read} onclick={() => markRead(n)}>
          <span class="notif-icon">{notifIcon(n.notification_type)}</span>
          <div class="notif-body">
            <span class="notif-message">{n.message}</span>
            <span class="notif-time">{formatDate(n.created_at)}</span>
          </div>
          {#if !n.read}
            <span class="notif-dot" />
          {/if}
        </button>
      {/each}
    {/if}
  </div>
</Page>

<style>
  .content { flex: 1; overflow-y: auto; }
  .empty {
    display: flex; flex-direction: column; align-items: center;
    justify-content: center; gap: 12px; padding: 80px 20px;
    color: var(--text-3);
  }
  .empty-icon { font-size: 48px; }
  .empty-text { font-size: 15px; }
  .notif-row {
    display: flex; align-items: center; gap: 12px;
    padding: 14px 18px; width: 100%; border: none; background: none;
    cursor: pointer; text-align: left; transition: background 0.15s;
    border-bottom: 1px solid var(--border);
  }
  .notif-row:hover { background: rgba(255,255,255,0.03); }
  .notif-row.unread { background: rgba(255,255,255,0.02); }
  .notif-icon { font-size: 24px; flex-shrink: 0; width: 36px; text-align: center; }
  .notif-body { flex: 1; display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .notif-message { font-size: 14px; color: var(--text); line-height: 1.4; word-break: break-word; }
  .notif-row.unread .notif-message { font-weight: 600; }
  .notif-time { font-size: 12px; color: var(--text-3); }
  .notif-dot {
    width: 8px; height: 8px; border-radius: 50%;
    background: var(--accent); flex-shrink: 0;
  }
</style>
