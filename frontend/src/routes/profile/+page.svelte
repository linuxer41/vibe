<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { avatarUrl, formatDate } from '$lib/helpers';
  import {
    user, socket, vibeBalance, focusSession, notifications, showToast,
    avatarCustomization, authStep, token
  } from '$lib/stores';
  import type { User, VibeBalance, FocusSession, SmartNotification } from '$lib/types';
  import Icon from '$lib/icon/Icon.svelte';

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
      <Icon name="clock" size={14} />
      Equilibrio
    </button>
    <button class="p-tab" class:active={activeTab === 'focus'} onclick={() => activeTab = 'focus'}>
      <Icon name="sun" size={14} />
      Enfoque
    </button>
    <button class="p-tab" class:active={activeTab === 'notifications'} onclick={() => activeTab = 'notifications'}>
      <Icon name="bell" size={14} />
      Notificaciones {notifs.filter(n => !n.read).length > 0 ? `(${notifs.filter(n => !n.read).length})` : ''}
    </button>
    <button class="p-tab" class:active={activeTab === 'channels'} onclick={() => activeTab = 'channels'}>
      <Icon name="cast" size={14} />
      Canales
    </button>
    <button class="p-tab" class:active={activeTab === 'communities'} onclick={() => activeTab = 'communities'}>
      <Icon name="users" size={14} />
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
            <Icon name="message" size={12} style="color: var(--accent)" />
            Mensajes
          </span>
          <div class="bl-bar-wrap">
            <div class="bl-bar" style="width: {percentage(balance.messaging_minutes)}%"></div>
          </div>
          <span class="bl-val">{balance.messaging_minutes}m</span>
        </div>
        <div class="balance-item">
          <span class="bl-label">
            <Icon name="grid" size={12} style="color: var(--accent)" />
            Feed
          </span>
          <div class="bl-bar-wrap"><div class="bl-bar feed" style="width: {percentage(balance.feed_minutes)}%"></div></div>
          <span class="bl-val">{balance.feed_minutes}m</span>
        </div>
        <div class="balance-item">
          <span class="bl-label">
            <Icon name="play" size={12} style="color: var(--accent)" />
            Live
          </span>
          <div class="bl-bar-wrap"><div class="bl-bar live" style="width: {percentage(balance.live_minutes)}%"></div></div>
          <span class="bl-val">{balance.live_minutes}m</span>
        </div>
        <div class="balance-item">
          <span class="bl-label">
            <Icon name="shop" size={12} style="color: var(--accent)" />
            Tienda
          </span>
          <div class="bl-bar-wrap"><div class="bl-bar shop" style="width: {percentage(balance.shop_minutes)}%"></div></div>
          <span class="bl-val">{balance.shop_minutes}m</span>
        </div>
        <div class="balance-item">
          <span class="bl-label">
            <Icon name="gamepad" size={12} style="color: var(--accent)" />
            Juegos
          </span>
          <div class="bl-bar-wrap"><div class="bl-bar games" style="width: {percentage(balance.games_minutes)}%"></div></div>
          <span class="bl-val">{balance.games_minutes}m</span>
        </div>
        <div class="balance-item">
          <span class="bl-label">
            <Icon name="phone" size={12} style="color: var(--accent)" />
            Llamadas
          </span>
          <div class="bl-bar-wrap"><div class="bl-bar calls" style="width: {percentage(balance.calls_minutes)}%"></div></div>
          <span class="bl-val">{balance.calls_minutes}m</span>
        </div>
      </div>
      {#if totalMinutes > 120}
        <div class="balance-tip">
          <Icon name="info" size={16} style="color: var(--accent)" />
          Has usado Vibe por {totalMinutes} min hoy. ¡Considera tomar un descanso!
        </div>
      {/if}
    </div>

  {:else if activeTab === 'focus'}
    <div class="focus-card">
      {#if focus?.active}
        <div class="focus-active">
          <div class="focus-icon">
            <Icon name="clock" size={32} style="color: var(--accent)" />
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
              <Icon name="sun" size={20} />
              <span>Focus</span>
              <small>Solo mensajes urgentes</small>
            </button>
            <button class="focus-opt" class:active={focusMode === 'work'} onclick={() => focusMode = 'work'}>
              <Icon name="users" size={20} />
              <span>Trabajo</span>
              <small>Oculta feed/live</small>
            </button>
            <button class="focus-opt" class:active={focusMode === 'sleep'} onclick={() => focusMode = 'sleep'}>
              <Icon name="moon" size={20} />
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
              <Icon name="clock" size={16} style="color: var(--accent)" />
            {:else if n.notification_type === 'balance'}
              <Icon name="sun" size={16} style="color: var(--accent)" />
            {:else}
              <Icon name="info" size={16} style="color: var(--accent)" />
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
      <Icon name="edit" size={18} />
      <span>Notas Compartidas</span>
      <Icon name="chevron-right" size={14} style="color: var(--text-3)" strokeWidth={2.5} />
    </button>
    <button class="qs-item" onclick={() => goto('/tasks')}>
      <Icon name="check" size={18} />
      <span>Tareas</span>
      <Icon name="chevron-right" size={14} style="color: var(--text-3)" strokeWidth={2.5} />
    </button>
    <button class="qs-item" onclick={() => goto('/channels', { noScroll: true })}>
      <Icon name="cast" size={18} />
      <span>Canales y Comunidades</span>
      <Icon name="chevron-right" size={14} style="color: var(--text-3)" strokeWidth={2.5} />
    </button>
    <button class="qs-item" onclick={() => goto('/watch')}>
      <Icon name="play" size={18} />
      <span>Watch Together</span>
      <Icon name="chevron-right" size={14} style="color: var(--text-3)" strokeWidth={2.5} />
    </button>
    <button class="qs-item" onclick={() => goto('/settings')}>
      <Icon name="settings" size={18} />
      <span>Ajustes</span>
      <Icon name="chevron-right" size={14} style="color: var(--text-3)" strokeWidth={2.5} />
    </button>
    <button class="qs-item" onclick={() => goto('/calls')}>
      <Icon name="phone" size={18} />
      <span>Llamadas</span>
      <Icon name="chevron-right" size={14} style="color: var(--text-3)" strokeWidth={2.5} />
    </button>
    <button class="qs-item" onclick={logout}>
      <Icon name="arrow-right" size={18} style="color: var(--danger)" />
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
