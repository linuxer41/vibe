<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { avatarUrl, formatDate } from '$lib/helpers';
  import {
    user, socket, vibeBalance, focusSession, notifications, showToast,
    avatarCustomization, authStep, token
  } from '$lib/stores';
  import type { User, VibeBalance, FocusSession, SmartNotification } from '$lib/types';

  let usr: User | null = $state(null);
  let sk: any = $state(null);
  let balance: VibeBalance = $state({ messaging_minutes: 0, feed_minutes: 0, live_minutes: 0, shop_minutes: 0, games_minutes: 0, calls_minutes: 0 });
  let focus: FocusSession | null = $state(null);
  let notifs: SmartNotification[] = $state([]);
  let activeTab: 'balance' | 'focus' | 'notifications' | 'channels' | 'communities' = $state('balance');
  let focusMode = $state<'focus' | 'work' | 'sleep'>('focus');
  let channelName = $state('');
  let channelDesc = $state('');
  let communityName = $state('');
  let communityDesc = $state('');
  let channels = $state<any[]>([]);
  let communities = $state<any[]>([]);

  user.subscribe((v) => usr = v);
  socket.subscribe((v) => sk = v);
  vibeBalance.subscribe((v) => balance = v);
  focusSession.subscribe((v) => focus = v);
  notifications.subscribe((v) => notifs = v);

  onMount(() => {
    sk?.emit('get_channels', (list: any[]) => channels = list || []);
    sk?.emit('get_communities', (list: any[]) => communities = list || []);
  });

  function startFocus() {
    sk?.emit('start_focus', { mode: focusMode }, (res: any) => {
      if (res?.ok) { focusSession.set(res.session); showToast(`Modo ${focusMode} activado`); }
    });
  }

  function endFocus() {
    sk?.emit('end_focus', (res: any) => {
      if (res?.ok) { focusSession.set(null); showToast('Sesión finalizada'); }
    });
  }

  function createChannel() {
    if (!channelName) return;
    sk?.emit('create_channel', { name: channelName, description: channelDesc }, (res: any) => {
      if (res?.ok) { showToast('Canal creado'); channelName = ''; channelDesc = ''; }
    });
  }

  function createCommunity() {
    if (!communityName) return;
    sk?.emit('create_community', { name: communityName, description: communityDesc }, (res: any) => {
      if (res?.ok) { showToast('Comunidad creada'); communityName = ''; communityDesc = ''; }
    });
  }

  function logout() {
    localStorage.removeItem('wa_token');
    authStep.set('phone');
    goto('/init', { replaceState: true });
  }

  const totalMinutes = $derived(balance.messaging_minutes + balance.feed_minutes + balance.live_minutes + balance.shop_minutes + balance.games_minutes + balance.calls_minutes);

  function percentage(val: number) { return totalMinutes > 0 ? Math.round((val / totalMinutes) * 100) : 0; }
</script>

<div class="profile-view">
  <!-- User Info -->
  <div class="profile-header">
    <img src={avatarUrl(usr?.id || 0)} alt="" class="profile-avatar" />
    <h2 class="profile-name">{usr?.display_name || 'Usuario'}</h2>
    <p class="profile-username">@{usr?.username || ''}</p>
    {#if usr?.bio}
      <p class="profile-bio">{usr.bio}</p>
    {/if}
  </div>

  <!-- Tabs -->
  <div class="profile-tabs">
    <button class="p-tab" class:active={activeTab === 'balance'} onclick={() => activeTab = 'balance'}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
      Equilibrio
    </button>
    <button class="p-tab" class:active={activeTab === 'focus'} onclick={() => activeTab = 'focus'}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
      Enfoque
    </button>
    <button class="p-tab" class:active={activeTab === 'notifications'} onclick={() => activeTab = 'notifications'}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0"/></svg>
      Notificaciones {notifs.filter(n => !n.read).length > 0 ? `(${notifs.filter(n => !n.read).length})` : ''}
    </button>
    <button class="p-tab" class:active={activeTab === 'channels'} onclick={() => activeTab = 'channels'}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 11a9 9 0 0 1 9 9M4 4a16 16 0 0 1 16 16"/><circle cx="5" cy="19" r="1"/></svg>
      Canales
    </button>
    <button class="p-tab" class:active={activeTab === 'communities'} onclick={() => activeTab = 'communities'}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>
      Comunidades
    </button>
  </div>

  <!-- Tab Content -->
  {#if activeTab === 'balance'}
    <div class="balance-card">
      <h3>Vibe Balance</h3>
      <p class="balance-total">{totalMinutes} min hoy</p>
      <div class="balance-bars">
        <div class="balance-item">
          <span class="bl-label">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            Mensajes
          </span>
          <div class="bl-bar-wrap">
            <div class="bl-bar" style="width: {percentage(balance.messaging_minutes)}%"></div>
          </div>
          <span class="bl-val">{balance.messaging_minutes}m</span>
        </div>
        <div class="balance-item">
          <span class="bl-label">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
            Feed
          </span>
          <div class="bl-bar-wrap"><div class="bl-bar feed" style="width: {percentage(balance.feed_minutes)}%"></div></div>
          <span class="bl-val">{balance.feed_minutes}m</span>
        </div>
        <div class="balance-item">
          <span class="bl-label">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/></svg>
            Live
          </span>
          <div class="bl-bar-wrap"><div class="bl-bar live" style="width: {percentage(balance.live_minutes)}%"></div></div>
          <span class="bl-val">{balance.live_minutes}m</span>
        </div>
        <div class="balance-item">
          <span class="bl-label">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0"/></svg>
            Tienda
          </span>
          <div class="bl-bar-wrap"><div class="bl-bar shop" style="width: {percentage(balance.shop_minutes)}%"></div></div>
          <span class="bl-val">{balance.shop_minutes}m</span>
        </div>
        <div class="balance-item">
          <span class="bl-label">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 12h4M8 10v4M15 13h.01M18 11h.01"/></svg>
            Juegos
          </span>
          <div class="bl-bar-wrap"><div class="bl-bar games" style="width: {percentage(balance.games_minutes)}%"></div></div>
          <span class="bl-val">{balance.games_minutes}m</span>
        </div>
        <div class="balance-item">
          <span class="bl-label">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
            Llamadas
          </span>
          <div class="bl-bar-wrap"><div class="bl-bar calls" style="width: {percentage(balance.calls_minutes)}%"></div></div>
          <span class="bl-val">{balance.calls_minutes}m</span>
        </div>
      </div>
      {#if totalMinutes > 120}
        <div class="balance-tip">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
          Has usado Vibe por {totalMinutes} min hoy. ¡Considera tomar un descanso!
        </div>
      {/if}
    </div>

  {:else if activeTab === 'focus'}
    <div class="focus-card">
      {#if focus?.active}
        <div class="focus-active">
          <div class="focus-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
          </div>
          <p class="focus-mode-text">Modo {focus.mode} activo</p>
          <p class="focus-since">Desde {formatDate(focus.started_at)}</p>
          <button class="modal-btn danger" onclick={endFocus}>Finalizar sesión</button>
        </div>
      {:else}
        <div class="focus-select">
          <h3>Modo de enfoque</h3>
          <div class="focus-options">
            <button class="focus-opt" class:active={focusMode === 'focus'} onclick={() => focusMode = 'focus'}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
              <span>Focus</span>
              <small>Solo mensajes urgentes</small>
            </button>
            <button class="focus-opt" class:active={focusMode === 'work'} onclick={() => focusMode = 'work'}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              <span>Trabajo</span>
              <small>Oculta feed/live</small>
            </button>
            <button class="focus-opt" class:active={focusMode === 'sleep'} onclick={() => focusMode = 'sleep'}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
              <span>Dormir</span>
              <small>Silencio total</small>
            </button>
          </div>
          <button class="modal-btn" onclick={startFocus}>Activar modo {focusMode}</button>
        </div>
      {/if}
    </div>

  {:else if activeTab === 'notifications'}
    <div class="notifications-list">
      {#each notifs as n (n.id)}
        <div class="notif-item" class:unread={!n.read} onclick={() => sk?.emit('mark_notification_read', { id: n.id }, () => { n.read = 1; notifications.update((list) => list); })}>
          <div class="notif-icon">
            {#if n.notification_type === 'focus'}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
            {:else if n.notification_type === 'balance'}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83"/></svg>
            {:else}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
            {/if}
          </div>
          <div class="notif-body">
            <span class="notif-text">{n.message}</span>
            <span class="notif-time">{formatDate(n.created_at)}</span>
          </div>
          {#if n.priority === 'high'}
            <span class="notif-priority">!!</span>
          {/if}
        </div>
      {/each}
      {#if notifs.length === 0}
        <div class="empty-state"><p>Sin notificaciones</p></div>
      {/if}
    </div>

  {:else if activeTab === 'channels'}
    <div class="channels-view">
      <div class="create-channel">
        <input type="text" bind:value={channelName} placeholder="Nombre del canal" class="modal-input" />
        <input type="text" bind:value={channelDesc} placeholder="Descripción" class="modal-input" />
        <button class="modal-btn" onclick={createChannel}>Crear canal</button>
      </div>
      <div class="channels-list">
        {#each channels as ch (ch.id)}
          <div class="channel-card">
            <div class="ch-info">
              <span class="ch-name">{ch.name}</span>
              <span class="ch-desc">{ch.description || 'Sin descripción'}</span>
              <span class="ch-subs">{ch.subscribers || 0} suscriptores</span>
            </div>
            <button class="small-btn" onclick={() => sk?.emit('subscribe_channel', { channelId: ch.id }, () => showToast('Suscrito'))}>Seguir</button>
          </div>
        {/each}
        {#if channels.length === 0}
          <div class="empty-state"><p>No hay canales</p></div>
        {/if}
      </div>
    </div>

  {:else if activeTab === 'communities'}
    <div class="communities-view">
      <div class="create-community">
        <input type="text" bind:value={communityName} placeholder="Nombre de la comunidad" class="modal-input" />
        <input type="text" bind:value={communityDesc} placeholder="Descripción" class="modal-input" />
        <button class="modal-btn" onclick={createCommunity}>Crear comunidad</button>
      </div>
      <div class="communities-list">
        {#each communities as c (c.id)}
          <div class="community-card">
            <div class="com-info">
              <span class="com-name">{c.name}</span>
              <span class="com-members">{c.members_count || 0} miembros</span>
            </div>
            <button class="small-btn" onclick={() => sk?.emit('join_community', { communityId: c.id }, () => showToast('Te has unido'))}>Unirse</button>
          </div>
        {/each}
        {#if communities.length === 0}
          <div class="empty-state"><p>No hay comunidades</p></div>
        {/if}
      </div>
    </div>
  {/if}

  <!-- Quick Settings -->
  <div class="quick-settings">
    <button class="qs-item" onclick={() => goto('/notes')}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
      <span>Notas Compartidas</span>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" stroke-width="2.5" stroke-linecap="round"><path d="M9 18l6-6-6-6"/></svg>
    </button>
    <button class="qs-item" onclick={() => goto('/tasks')}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
      <span>Tareas</span>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" stroke-width="2.5" stroke-linecap="round"><path d="M9 18l6-6-6-6"/></svg>
    </button>
    <button class="qs-item" onclick={() => goto('/channels', { noScroll: true })}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 11a9 9 0 0 1 9 9M4 4a16 16 0 0 1 16 16"/><circle cx="5" cy="19" r="1"/></svg>
      <span>Canales y Comunidades</span>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" stroke-width="2.5" stroke-linecap="round"><path d="M9 18l6-6-6-6"/></svg>
    </button>
    <button class="qs-item" onclick={() => goto('/watch')}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/></svg>
      <span>Watch Together</span>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" stroke-width="2.5" stroke-linecap="round"><path d="M9 18l6-6-6-6"/></svg>
    </button>
    <button class="qs-item" onclick={() => goto('/settings')}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
      <span>Ajustes</span>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" stroke-width="2.5" stroke-linecap="round"><path d="M9 18l6-6-6-6"/></svg>
    </button>
    <button class="qs-item" onclick={() => goto('/calls')}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
      <span>Llamadas</span>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" stroke-width="2.5" stroke-linecap="round"><path d="M9 18l6-6-6-6"/></svg>
    </button>
    <button class="qs-item" onclick={logout}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>
      <span class="text-danger">Cerrar sesión</span>
    </button>
  </div>
</div>

<style>
  .profile-view { flex: 1; overflow-y: auto; padding-bottom: 80px; }
  .profile-header { display: flex; flex-direction: column; align-items: center; padding: 24px 16px 16px; }
  .profile-avatar { width: 80px; height: 80px; border-radius: 50%; object-fit: cover; margin-bottom: 12px; }
  .profile-name { font-size: 20px; font-weight: 700; color: var(--text); margin: 0; }
  .profile-username { font-size: 14px; color: var(--text-3); margin: 2px 0; }
  .profile-bio { font-size: 13px; color: var(--text-2); margin-top: 4px; text-align: center; }
  .profile-tabs { display: flex; gap: 2px; padding: 8px 12px; background: var(--bg-2); border-bottom: 1px solid var(--border); overflow-x: auto; }
  .p-tab { display: flex; align-items: center; gap: 4px; padding: 8px 10px; background: none; border: none; color: var(--text-3); font-size: 11px; font-weight: 500; cursor: pointer; border-radius: 8px; white-space: nowrap; transition: all 0.2s; }
  .p-tab.active { background: var(--accent); color: #000; font-weight: 600; }
  .balance-card { margin: 12px; padding: 16px; background: var(--bg-2); border-radius: 16px; }
  .balance-card h3 { font-size: 16px; font-weight: 600; color: var(--text); margin: 0 0 4px; }
  .balance-total { font-size: 13px; color: var(--text-3); margin-bottom: 16px; }
  .balance-bars { display: flex; flex-direction: column; gap: 10px; }
  .balance-item { display: flex; align-items: center; gap: 8px; }
  .bl-label { display: flex; align-items: center; gap: 4px; font-size: 11px; color: var(--text-2); width: 70px; flex-shrink: 0; }
  .bl-bar-wrap { flex: 1; height: 6px; background: var(--bg-3); border-radius: 3px; overflow: hidden; }
  .bl-bar { height: 100%; background: var(--accent); border-radius: 3px; transition: width 0.5s ease; min-width: 0; }
  .bl-bar.feed { background: #3b82f6; }
  .bl-bar.live { background: #ef4444; }
  .bl-bar.shop { background: #f59e0b; }
  .bl-bar.games { background: #8b5cf6; }
  .bl-bar.calls { background: #06b6d4; }
  .bl-val { font-size: 11px; color: var(--text-3); width: 30px; text-align: right; flex-shrink: 0; }
  .balance-tip { display: flex; align-items: center; gap: 6px; margin-top: 16px; padding: 10px; background: rgba(34,197,94,0.1); border-radius: 10px; font-size: 12px; color: var(--accent); }
  .focus-card { margin: 12px; padding: 16px; background: var(--bg-2); border-radius: 16px; }
  .focus-active { text-align: center; }
  .focus-icon { margin-bottom: 8px; }
  .focus-mode-text { font-size: 18px; font-weight: 700; color: var(--text); text-transform: capitalize; }
  .focus-since { font-size: 12px; color: var(--text-3); margin-bottom: 16px; }
  .modal-btn { width: 100%; padding: 13px; background: var(--accent); color: #000; font-weight: 700; border: none; border-radius: 12px; font-size: 15px; cursor: pointer; }
  .modal-btn.danger { background: var(--danger); color: #fff; }
  .focus-select h3 { font-size: 16px; font-weight: 600; color: var(--text); margin: 0 0 12px; }
  .focus-options { display: flex; gap: 8px; margin-bottom: 16px; }
  .focus-opt { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 12px 8px; background: var(--bg-3); border: 2px solid transparent; border-radius: 12px; cursor: pointer; transition: all 0.2s; text-align: center; }
  .focus-opt.active { border-color: var(--accent); background: rgba(34,197,94,0.1); }
  .focus-opt span { font-size: 12px; font-weight: 600; color: var(--text); }
  .focus-opt small { font-size: 9px; color: var(--text-3); }
  .notifications-list { padding: 8px 12px; }
  .notif-item { display: flex; align-items: center; gap: 10px; padding: 12px; background: var(--bg-2); border-radius: 12px; margin-bottom: 6px; cursor: pointer; }
  .notif-item.unread { border-left: 3px solid var(--accent); }
  .notif-icon { flex-shrink: 0; }
  .notif-body { flex: 1; }
  .notif-text { display: block; font-size: 13px; color: var(--text); }
  .notif-time { display: block; font-size: 10px; color: var(--text-3); }
  .notif-priority { color: var(--danger); font-weight: 700; font-size: 12px; }
  .channels-view, .communities-view { padding: 12px; }
  .create-channel, .create-community { margin-bottom: 12px; }
  .modal-input { width: 100%; padding: 14px 16px; border: 2px solid rgba(255,255,255,0.08); border-radius: 12px; font-size: 15px; outline: none; background: var(--bg-3); color: var(--text); margin-bottom: 12px; box-sizing: border-box; transition: border-color 0.2s; }
  .modal-input:focus { border-color: var(--accent); }
  .channel-card, .community-card { display: flex; align-items: center; gap: 12px; padding: 12px; background: var(--bg-2); border-radius: 12px; margin-bottom: 8px; }
  .ch-info, .com-info { flex: 1; }
  .ch-name, .com-name { display: block; font-size: 14px; font-weight: 600; color: var(--text); }
  .ch-desc { display: block; font-size: 11px; color: var(--text-3); }
  .ch-subs, .com-members { display: block; font-size: 10px; color: var(--text-3); margin-top: 2px; }
  .small-btn { padding: 6px 14px; background: var(--accent); color: #000; font-weight: 600; border: none; border-radius: 8px; font-size: 12px; cursor: pointer; white-space: nowrap; flex-shrink: 0; }
  .empty-state { display: flex; flex-direction: column; align-items: center; padding: 48px 24px; }
  .empty-state p { color: var(--text-3); font-size: 14px; }
  .quick-settings { margin: 12px; border-top: 1px solid var(--border); padding-top: 12px; }
  .qs-item { display: flex; align-items: center; gap: 12px; width: 100%; padding: 14px; background: none; border: none; cursor: pointer; border-radius: 12px; transition: background 0.15s; color: var(--text); font-size: 14px; }
  .qs-item:hover { background: var(--bg-2); }
  .qs-item span { flex: 1; text-align: left; }
  .text-danger { color: var(--danger) !important; }
</style>
