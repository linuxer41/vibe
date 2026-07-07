<script lang="ts">
  import Icon from '$lib/icon/Icon.svelte';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { avatarUrl, formatDate } from '$lib/helpers';
  import { socket, showToast } from '$lib/stores';
  import ChannelCard from '$lib/components/ChannelCard.svelte';
  import type { Channel, Community, ChannelPost } from '$lib/types';

  let sk: any = $state(null);
  let activeTab: 'channels' | 'communities' = $state('channels');
  let channels: Channel[] = $state([]);
  let communities: Community[] = $state([]);

  // Selection / Detail
  let selectedChannel: Channel | null = $state(null);
  let selectedCommunity: Community | null = $state(null);
  let channelPosts: ChannelPost[] = $state([]);

  // Create modals
  let showCreateChannel = $state(false);
  let showCreateCommunity = $state(false);
  let newChannelName = $state('');
  let newChannelDesc = $state('');
  let newCommunityName = $state('');
  let newCommunityDesc = $state('');
  let newPostText = $state('');

  socket.subscribe((v) => sk = v);

  onMount(() => {
    loadChannels();
    loadCommunities();
  });

  function loadChannels() {
    sk?.emit('get_channels', (list: any[]) => channels = list || []);
  }

  function loadCommunities() {
    sk?.emit('get_communities', (list: any[]) => communities = list || []);
  }

  function createChannel() {
    if (!newChannelName) return;
    sk?.emit('create_channel', { name: newChannelName, description: newChannelDesc }, (res: any) => {
      if (res?.ok) {
        showToast('Canal creado');
        newChannelName = '';
        newChannelDesc = '';
        showCreateChannel = false;
        loadChannels();
      }
    });
  }

  function createCommunity() {
    if (!newCommunityName) return;
    sk?.emit('create_community', { name: newCommunityName, description: newCommunityDesc }, (res: any) => {
      if (res?.ok) {
        showToast('Comunidad creada');
        newCommunityName = '';
        newCommunityDesc = '';
        showCreateCommunity = false;
        loadCommunities();
      }
    });
  }

  function openChannel(ch: Channel) {
    selectedChannel = ch;
    selectedCommunity = null;
    sk?.emit('get_channel_posts', { channelId: ch.id }, (list: any[]) => channelPosts = list || []);
  }

  function openCommunity(c: Community) {
    selectedCommunity = c;
    selectedChannel = null;
  }

  function closeDetail() {
    selectedChannel = null;
    selectedCommunity = null;
    channelPosts = [];
  }

  function createPost() {
    if (!newPostText || !selectedChannel) return;
    sk?.emit('create_channel_post', { channelId: selectedChannel.id, text: newPostText }, (res: any) => {
      if (res?.ok) {
        showToast('Post publicado');
        newPostText = '';
        sk?.emit('get_channel_posts', { channelId: selectedChannel!.id }, (list: any[]) => channelPosts = list || []);
      }
    });
  }

  function subscribeChannel(ch: Channel) {
    sk?.emit('subscribe_channel', { channelId: ch.id }, () => {
      showToast('Suscrito al canal');
      loadChannels();
    });
  }

  function unsubscribeChannel(ch: Channel) {
    sk?.emit('unsubscribe_channel', { channelId: ch.id }, () => {
      showToast('Suscripción cancelada');
      loadChannels();
    });
  }

  function joinCommunity(c: Community) {
    sk?.emit('join_community', { communityId: c.id }, () => {
      showToast('Te has unido a la comunidad');
      loadCommunities();
    });
  }

  function leaveCommunity(c: Community) {
    sk?.emit('leave_community', { communityId: c.id }, () => {
      showToast('Has salido de la comunidad');
      loadCommunities();
    });
  }
</script>

<div class="channels-page">
  <!-- Header -->
  <div class="ch-header">
    <button class="ch-back" onclick={() => goto('/profile', { noScroll: true })}>
      <Icon name="chevron-left" size={24} />
    </button>
    <h2 class="ch-title">{selectedChannel ? selectedChannel.name : selectedCommunity ? selectedCommunity.name : 'Canales y Comunidades'}</h2>
    <div class="ch-header-right">
      {#if !selectedChannel && !selectedCommunity && activeTab === 'channels'}
        <button class="ch-add" onclick={() => showCreateChannel = true} title="Crear canal">
          <Icon name="plus" size={20} strokeWidth={2.5} />
        </button>
      {:else if !selectedChannel && !selectedCommunity && activeTab === 'communities'}
        <button class="ch-add" onclick={() => showCreateCommunity = true} title="Crear comunidad">
          <Icon name="plus" size={20} strokeWidth={2.5} />
        </button>
      {/if}
    </div>
  </div>

  {#if selectedChannel}
    <!-- Channel Detail -->
    <div class="ch-detail-header">
      <div class="ch-detail-info">
        <span class="ch-detail-desc">{selectedChannel.description || 'Sin descripción'}</span>
        <span class="ch-detail-meta">{selectedChannel.subscribers || 0} suscriptores</span>
      </div>
    </div>

    <div class="ch-posts">
      {#each channelPosts as post (post.id)}
        <div class="ch-post-item">
          <div class="ch-post-header">
            <img src={avatarUrl(post.sender_id || 0)} alt="" class="ch-post-avatar" />
            <div class="ch-post-info">
              <span class="ch-post-author">{post.display_name || 'Usuario'}</span>
              <span class="ch-post-time">{formatDate(post.created_at)}</span>
            </div>
          </div>
          <p class="ch-post-text">{post.text}</p>
          {#if post.media_type === 'image' && post.media}
            <img src={post.media} alt="" class="ch-post-media" />
          {/if}
          {#if post.likes_count > 0 || post.comments_count > 0}
            <div class="ch-post-stats">
              {#if post.likes_count > 0}<span>{post.likes_count} likes</span>{/if}
              {#if post.comments_count > 0}<span>{post.comments_count} comentarios</span>{/if}
            </div>
          {/if}
        </div>
      {/each}
      {#if channelPosts.length === 0}
        <div class="empty-state">
          <p>No hay publicaciones en este canal</p>
        </div>
      {/if}
    </div>

    <div class="ch-post-input">
      <input
        type="text"
        bind:value={newPostText}
        placeholder="Escribe una publicación..."
        class="ch-input"
        onkeydown={(e) => { if (e.key === 'Enter') createPost(); }}
      />
      <button class="ch-send" onclick={createPost} disabled={!newPostText}>
        <Icon name="send" size={18} strokeWidth={2.5} />
      </button>
    </div>

  {:else if selectedCommunity}
    <!-- Community Detail -->
    <div class="ch-detail-header">
      <div class="ch-detail-info">
        <span class="ch-detail-desc">{selectedCommunity.description || 'Sin descripción'}</span>
        <span class="ch-detail-meta">{selectedCommunity.members_count || 0} miembros</span>
      </div>
    </div>

    <div class="ch-members">
      <p class="ch-members-placeholder">Has seleccionado la comunidad <strong>{selectedCommunity.name}</strong>. Comparte el nombre de la comunidad con otros para que se unan.</p>
    </div>

  {:else}
    <!-- Tab Bar -->
    <div class="ch-tabs">
      <button class="ch-tab" class:active={activeTab === 'channels'} onclick={() => activeTab = 'channels'}>
        <Icon name="cast" size={14} />
        Canales
      </button>
      <button class="ch-tab" class:active={activeTab === 'communities'} onclick={() => activeTab = 'communities'}>
        <Icon name="users" size={14} />
        Comunidades
      </button>
    </div>

    <!-- Channels List -->
    {#if activeTab === 'channels'}
      <div class="ch-list">
        {#each channels as ch (ch.id)}
          <div class="ch-item-wrap">
            <ChannelCard item={ch} type="channel" onclick={() => openChannel(ch)} />
            <div class="ch-item-actions">
              <button class="ch-action-btn subscribe" onclick={() => subscribeChannel(ch)}>
                <Icon name="arrow-left" size={14} />
                Seguir
              </button>
            </div>
          </div>
        {/each}
        {#if channels.length === 0}
          <div class="empty-state">
            <Icon name="cast" size={48} strokeWidth={1.5} style="color: var(--text-3)" />
            <p>No hay canales disponibles</p>
          </div>
        {/if}
      </div>

    {:else}
      <!-- Communities List -->
      <div class="ch-list">
        {#each communities as c (c.id)}
          <div class="ch-item-wrap">
            <ChannelCard item={c} type="community" onclick={() => openCommunity(c)} />
            <div class="ch-item-actions">
              <button class="ch-action-btn join" onclick={() => joinCommunity(c)}>
                <Icon name="plus-circle" size={14} />
                Unirse
              </button>
            </div>
          </div>
        {/each}
        {#if communities.length === 0}
          <div class="empty-state">
            <Icon name="users" size={48} strokeWidth={1.5} style="color: var(--text-3)" />
            <p>No hay comunidades</p>
          </div>
        {/if}
      </div>
    {/if}
  {/if}
</div>

<!-- Create Channel Modal -->
{#if showCreateChannel}
  <div class="modal-overlay" onclick={() => showCreateChannel = false} role="presentation">
    <div class="modal-content" onclick={(e) => e.stopPropagation()} role="dialog">
      <h3 class="modal-title">Crear canal</h3>
      <input type="text" bind:value={newChannelName} placeholder="Nombre del canal" class="modal-input" />
      <input type="text" bind:value={newChannelDesc} placeholder="Descripción" class="modal-input" />
      <div class="modal-actions">
        <button class="modal-btn cancel" onclick={() => { showCreateChannel = false; newChannelName = ''; newChannelDesc = ''; }}>Cancelar</button>
        <button class="modal-btn primary" onclick={createChannel} disabled={!newChannelName}>Crear</button>
      </div>
    </div>
  </div>
{/if}

<!-- Create Community Modal -->
{#if showCreateCommunity}
  <div class="modal-overlay" onclick={() => showCreateCommunity = false} role="presentation">
    <div class="modal-content" onclick={(e) => e.stopPropagation()} role="dialog">
      <h3 class="modal-title">Crear comunidad</h3>
      <input type="text" bind:value={newCommunityName} placeholder="Nombre de la comunidad" class="modal-input" />
      <input type="text" bind:value={newCommunityDesc} placeholder="Descripción" class="modal-input" />
      <div class="modal-actions">
        <button class="modal-btn cancel" onclick={() => { showCreateCommunity = false; newCommunityName = ''; newCommunityDesc = ''; }}>Cancelar</button>
        <button class="modal-btn primary" onclick={createCommunity} disabled={!newCommunityName}>Crear</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .channels-page { flex: 1; display: flex; flex-direction: column; overflow: hidden; background: var(--bg); }

  /* Header */
  .ch-header { display: flex; align-items: center; gap: 12px; padding: 12px 16px; background: var(--bg-2); border-bottom: 1px solid var(--border); flex-shrink: 0; }
  .ch-back { background: none; border: none; color: var(--text); cursor: pointer; padding: 4px; display: flex; }
  .ch-title { font-size: 17px; font-weight: 600; color: var(--text); flex: 1; }
  .ch-header-right { display: flex; align-items: center; gap: 8px; }
  .ch-add { background: none; border: none; color: var(--accent); cursor: pointer; padding: 6px; border-radius: 50%; display: flex; align-items: center; justify-content: center; transition: background 0.15s; }
  .ch-add:hover { background: var(--bg-3); }

  /* Tabs */
  .ch-tabs { display: flex; gap: 0; background: var(--bg-2); border-bottom: 1px solid var(--border); flex-shrink: 0; }
  .ch-tab { flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px; padding: 10px 0; background: none; border: none; color: var(--text-2); font-size: 13px; font-weight: 500; cursor: pointer; border-bottom: 2px solid transparent; transition: all 0.2s; }
  .ch-tab.active { color: var(--accent); border-bottom-color: var(--accent); }

  /* Lists */
  .ch-list { flex: 1; overflow-y: auto; }
  .ch-item-wrap { position: relative; }
  .ch-item-actions { position: absolute; right: 16px; top: 50%; transform: translateY(-50%); z-index: 2; }
  .ch-action-btn { display: flex; align-items: center; gap: 4px; padding: 6px 12px; background: var(--accent); color: #000; font-weight: 600; border: none; border-radius: 8px; font-size: 11px; cursor: pointer; white-space: nowrap; transition: opacity 0.15s; }
  .ch-action-btn:hover { opacity: 0.85; }

  /* Detail Header */
  .ch-detail-header { padding: 16px; background: var(--bg-2); border-bottom: 1px solid var(--border); flex-shrink: 0; }
  .ch-detail-info { display: flex; flex-direction: column; gap: 4px; }
  .ch-detail-desc { font-size: 13px; color: var(--text-2); }
  .ch-detail-meta { font-size: 11px; color: var(--text-3); }

  /* Posts */
  .ch-posts { flex: 1; overflow-y: auto; padding: 8px 0; }
  .ch-post-item { padding: 12px 16px; border-bottom: 1px solid var(--border-2); }
  .ch-post-header { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
  .ch-post-avatar { width: 32px; height: 32px; border-radius: 50%; object-fit: cover; }
  .ch-post-info { flex: 1; }
  .ch-post-author { display: block; font-size: 13px; font-weight: 600; color: var(--text); }
  .ch-post-time { display: block; font-size: 10px; color: var(--text-3); }
  .ch-post-text { font-size: 14px; color: var(--text); line-height: 1.4; margin: 0 0 8px; }
  .ch-post-media { max-width: 100%; max-height: 240px; border-radius: 10px; object-fit: contain; margin-bottom: 8px; }
  .ch-post-stats { display: flex; gap: 12px; font-size: 11px; color: var(--text-3); }

  /* Post Input */
  .ch-post-input { display: flex; align-items: center; gap: 8px; padding: 10px 16px; background: var(--bg-2); border-top: 1px solid var(--border); flex-shrink: 0; }
  .ch-input { flex: 1; padding: 10px 14px; border: none; border-radius: 10px; font-size: 14px; outline: none; background: var(--bg-3); color: var(--text); }
  .ch-input::placeholder { color: var(--text-3); }
  .ch-send { width: 36px; height: 36px; border-radius: 50%; background: var(--accent); color: #000; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: opacity 0.15s; }
  .ch-send:disabled { opacity: 0.4; cursor: default; }

  /* Members */
  .ch-members { flex: 1; overflow-y: auto; padding: 12px 16px; }
  .ch-members-placeholder { font-size: 14px; color: var(--text-2); line-height: 1.5; padding: 24px 0; }

  /* Empty State */
  .empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 64px 24px; gap: 12px; }
  .empty-state p { color: var(--text-3); font-size: 14px; }

  /* Modal */
  .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 100; padding: 24px; }
  .modal-content { width: 100%; max-width: 360px; background: var(--bg-2); border-radius: 16px; padding: 24px; }
  .modal-title { font-size: 18px; font-weight: 700; color: var(--text); margin: 0 0 16px; }
  .modal-input { width: 100%; padding: 14px 16px; border: 2px solid rgba(255,255,255,0.08); border-radius: 12px; font-size: 15px; outline: none; background: var(--bg-3); color: var(--text); margin-bottom: 12px; box-sizing: border-box; transition: border-color 0.2s; }
  .modal-input:focus { border-color: var(--accent); }
  .modal-input::placeholder { color: var(--text-3); }
  .modal-actions { display: flex; gap: 8px; margin-top: 4px; }
  .modal-btn { flex: 1; padding: 12px; border: none; border-radius: 12px; font-size: 15px; font-weight: 700; cursor: pointer; transition: opacity 0.15s; }
  .modal-btn:disabled { opacity: 0.4; cursor: default; }
  .modal-btn.primary { background: var(--accent); color: #000; }
  .modal-btn.cancel { background: var(--bg-3); color: var(--text-2); }
</style>
