<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import Page from '$lib/components/Page.svelte';
  import Header from '$lib/components/Header.svelte';
  import SettingSection from '$lib/components/SettingSection.svelte';
  import SettingRow from '$lib/components/SettingRow.svelte';
  import Icon from '$lib/icon/Icon.svelte';
  import { socket, sessions } from '$lib/stores';
  import type { Session } from '$lib/types';

  let sk: any = $state(null);
  socket.subscribe((v) => sk = v);

  onMount(() => {
    sk?.emit('get_sessions', (res: any) => sessions.set(res));
  });

  function terminate(sessionId: number) {
    sk?.emit('terminate_session', { sessionId }, () => {
      sessions.update((list) => list.filter((s) => s.id !== sessionId));
    });
  }

  function terminateAll() {
    sk?.emit('terminate_other_sessions', {}, () => {
      sk?.emit('get_sessions', (res: any) => sessions.set(res));
    });
  }

  function formatDate(d: string) {
    if (!d) return '';
    const date = new Date(d + 'Z');
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    if (diff < 60000) return 'Ahora';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
    return date.toLocaleDateString('es', { day: 'numeric', month: 'short' });
  }

  function deviceIcon(name: string) {
    const n = (name || '').toLowerCase();
    if (n.includes('iphone') || n.includes('ios')) return 'phone';
    if (n.includes('android') || n.includes('samsung') || n.includes('xiaomi')) return 'phone';
    if (n.includes('windows') || n.includes('mac') || n.includes('linux') || n.includes('chrome')) return 'monitor';
    return 'smartphone';
  }
</script>

<Page>
  <Header title="Dispositivos" onback={() => goto('/settings/security')} />
  <div class="content">
    {#if $sessions.length > 1}
      <button class="terminate-all" onclick={terminateAll}>
        <Icon name="cast" size={16} />
        Cerrar todas las demás sesiones
      </button>
    {/if}
    <SettingSection>
      {#each $sessions as s, i}
        <div class="session-row">
          <div class="session-icon">
            {#if deviceIcon(s.device_name) === 'phone'}
              <Icon name="phone" size={22} style="color: var(--accent)" />
            {:else}
              <Icon name="cast" size={22} style="color: var(--accent)" />
            {/if}
          </div>
          <div class="session-info">
            <span class="session-name">{s.device_name || 'Dispositivo desconocido'}</span>
            <span class="session-meta">{s.device_id || ''} · Activo {formatDate(s.last_active)}</span>
          </div>
          {#if i > 0}
            <button class="terminate-btn" onclick={() => terminate(s.id)} title="Cerrar sesión">
              <Icon name="arrow-right" size={18} style="color: var(--danger)" />
            </button>
          {:else}
            <span class="current-badge">Actual</span>
          {/if}
        </div>
      {/each}
    </SettingSection>
    <div class="info-text">
      Puedes cerrar sesión en cualquier dispositivo. Las sesiones aparecen ordenadas por actividad reciente.
    </div>
  </div>
</Page>

<style>
  .content { flex: 1; overflow-y: auto; }
  .terminate-all {
    width: calc(100% - 32px); margin: 16px auto; display: flex;
    align-items: center; justify-content: center; gap: 8px;
    padding: 12px; background: none; border: 1.5px solid var(--danger);
    border-radius: 12px; color: var(--danger); font-size: 14px;
    font-weight: 600; cursor: pointer; transition: background 0.2s;
  }
  .terminate-all:hover { background: rgba(239,68,68,0.08); }
  .session-row {
    display: flex; align-items: center; gap: 12px;
    padding: 14px 16px; border-bottom: 1px solid var(--border-2);
  }
  .session-icon { width: 22px; display: flex; justify-content: center; flex-shrink: 0; }
  .session-info { flex: 1; min-width: 0; }
  .session-name { display: block; font-size: 15px; font-weight: 500; color: var(--text); }
  .session-meta { display: block; font-size: 12px; color: var(--text-3); margin-top: 2px; }
  .terminate-btn {
    background: none; border: none; cursor: pointer; padding: 6px;
    border-radius: 50%; display: flex; transition: background 0.2s;
  }
  .terminate-btn:hover { background: var(--border); }
  .current-badge {
    font-size: 11px; font-weight: 600; padding: 3px 10px;
    border-radius: 6px; background: var(--accent); color: #000;
  }
  .info-text { padding: 16px; font-size: 12px; color: var(--text-3); line-height: 1.5; }
</style>
