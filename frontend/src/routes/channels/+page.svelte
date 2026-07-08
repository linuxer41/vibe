<script lang="ts">
  import { emit } from '$lib/socket';
  import Icon from '$lib/icon/Icon.svelte';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { showToast } from '$lib/stores';
  import ChannelCard from '$lib/components/ChannelCard.svelte';
  import type { Channel, Community } from '$lib/types';
  import HeaderLayout from '$lib/layouts/HeaderLayout.svelte';
  import CreateChannelModal from './components/CreateChannelModal.svelte';
  import CreateCommunityModal from './components/CreateCommunityModal.svelte';
  import ChannelDetail from './components/ChannelDetail.svelte';
  import CommunityDetail from './components/CommunityDetail.svelte';

  let activeTab: 'channels' | 'communities' = $state('channels');
  let channels: Channel[] = $state([]);
  let communities: Community[] = $state([]);

  // Selection / Detail
  let selectedChannel: Channel | null = $state(null);
  let selectedCommunity: Community | null = $state(null);
  let channelPosts: any[] = $state([]);

  // Create modals
  let showCreateChannel = $state(false);
  let showCreateCommunity = $state(false);

  onMount(() => {
    loadChannels();
    loadCommunities();
  });

  async function loadChannels() {
    try { channels = await emit<any[]>('get_channels') || []; } catch {}
  }

  async function loadCommunities() {
    try { communities = await emit<any[]>('get_communities') || []; } catch {}
  }

  async function handleCreateChannel(name: string, desc: string) {
    try {
      const res = await emit('create_channel', { name, description: desc });
      if (res?.ok) {
        showToast('Canal creado');
        showCreateChannel = false;
        loadChannels();
      }
    } catch {}
  }

  async function handleCreateCommunity(name: string, desc: string) {
    try {
      const res = await emit('create_community', { name, description: desc });
      if (res?.ok) {
        showToast('Comunidad creada');
        showCreateCommunity = false;
        loadCommunities();
      }
    } catch {}
  }

  async function openChannel(ch: Channel) {
    selectedChannel = ch;
    selectedCommunity = null;
    try { channelPosts = await emit<any[]>('get_channel_posts', { channelId: ch.id }) || []; } catch {}
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

  async function handleCreatePost(text: string) {
    if (!selectedChannel) return;
    try {
      const res = await emit('create_channel_post', { channelId: selectedChannel.id, text });
      if (res?.ok) {
        showToast('Post publicado');
        try { channelPosts = await emit<any[]>('get_channel_posts', { channelId: selectedChannel!.id }) || []; } catch {}
      }
    } catch {}
  }

  async function subscribeChannel(ch: Channel) {
    try {
      await emit('subscribe_channel', { channelId: ch.id });
      showToast('Suscrito al canal');
      loadChannels();
    } catch {}
  }

  async function unsubscribeChannel(ch: Channel) {
    try {
      await emit('unsubscribe_channel', { channelId: ch.id });
      showToast('Suscripción cancelada');
      loadChannels();
    } catch {}
  }

  async function joinCommunity(c: Community) {
    try {
      await emit('join_community', { communityId: c.id });
      showToast('Te has unido a la comunidad');
      loadCommunities();
    } catch {}
  }

  async function leaveCommunity(c: Community) {
    try {
      await emit('leave_community', { communityId: c.id });
      showToast('Has salido de la comunidad');
      loadCommunities();
    } catch {}
  }
</script>

<HeaderLayout title="Canales">
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
    <ChannelDetail channel={selectedChannel} posts={channelPosts} oncreatepost={handleCreatePost} />
  {:else if selectedCommunity}
    <CommunityDetail community={selectedCommunity} />
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
            <ChannelCard item={ch} type="channel" onaction={() => openChannel(ch)} />
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
            <ChannelCard item={c} type="community" onaction={() => openCommunity(c)} />
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

<CreateChannelModal show={showCreateChannel} onclose={() => showCreateChannel = false} oncreate={handleCreateChannel} />
<CreateCommunityModal show={showCreateCommunity} onclose={() => showCreateCommunity = false} oncreate={handleCreateCommunity} />
</HeaderLayout>

<style>
  .channels-page { flex: 1; display: flex; flex-direction: column; overflow: hidden; background: var(--bg); }

  .ch-header { display: flex; align-items: center; gap: 12px; padding: 12px 16px; background: var(--bg-2); border-bottom: 1px solid var(--border); flex-shrink: 0; }
  .ch-back { background: none; border: none; color: var(--text); cursor: pointer; padding: 4px; display: flex; }
  .ch-title { font-size: 17px; font-weight: 600; color: var(--text); flex: 1; }
  .ch-header-right { display: flex; align-items: center; gap: 8px; }
  .ch-add { background: none; border: none; color: var(--accent); cursor: pointer; padding: 6px; border-radius: 50%; display: flex; align-items: center; justify-content: center; transition: background 0.15s; }
  .ch-add:hover { background: var(--bg-3); }

  .ch-tabs { display: flex; gap: 0; background: var(--bg-2); border-bottom: 1px solid var(--border); flex-shrink: 0; }
  .ch-tab { flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px; padding: 10px 0; background: none; border: none; color: var(--text-2); font-size: 13px; font-weight: 500; cursor: pointer; border-bottom: 2px solid transparent; transition: all 0.2s; }
  .ch-tab.active { color: var(--accent); border-bottom-color: var(--accent); }

  .ch-list { flex: 1; overflow-y: auto; }
  .ch-item-wrap { position: relative; }
  .ch-item-actions { position: absolute; right: 16px; top: 50%; transform: translateY(-50%); z-index: 2; }
  .ch-action-btn { display: flex; align-items: center; gap: 4px; padding: 6px 12px; background: var(--accent); color: #000; font-weight: 600; border: none; border-radius: 8px; font-size: 11px; cursor: pointer; white-space: nowrap; transition: opacity 0.15s; }
  .ch-action-btn:hover { opacity: 0.85; }

  .empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 64px 24px; gap: 12px; }
  .empty-state p { color: var(--text-3); font-size: 14px; }
</style>
