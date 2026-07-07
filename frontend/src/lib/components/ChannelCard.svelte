<script lang="ts">
  import { avatarUrl } from '$lib/helpers';
  import type { Channel, Community } from '$lib/types';
  import Icon from '$lib/icon/Icon.svelte';

  let { item, type, subscribed, onaction }: {
    item: Channel | Community;
    type: 'channel' | 'community';
    subscribed?: boolean;
    onaction?: () => void;
  } = $props();
</script>

<div class="channel-card" onclick={onaction} role="button" tabindex="0" onkeydown={(e) => { if (e.key === 'Enter') onaction?.(); }}>
  <div class="cc-avatar">
    {#if type === 'channel' && (item as Channel).name}
      <span class="cc-initial">{(item as Channel).name.charAt(0).toUpperCase()}</span>
    {:else if type === 'community' && (item as Community).name}
      <span class="cc-initial">{(item as Community).name.charAt(0).toUpperCase()}</span>
    {:else}
      <img src={avatarUrl(item.id)} alt="" />
    {/if}
  </div>
  <div class="cc-info">
    <span class="cc-name">{item.name}</span>
    <span class="cc-desc">{item.description || 'Sin descripción'}</span>
    <span class="cc-meta">
      {#if type === 'channel'}
        {(item as Channel).subscribers || 0} suscriptores
      {:else}
        {(item as Community).members_count || 0} miembros
      {/if}
    </span>
  </div>
  <span class="cc-arrow">
    <Icon name="chevron-right" size={16} style="color: var(--text-3)" />
  </span>
</div>

<style>
  .channel-card {
    display: flex; align-items: center; gap: 12px;
    padding: 12px 16px; cursor: pointer;
    border-bottom: 1px solid var(--border-2);
    transition: background 0.15s;
  }
  .channel-card:hover { background: var(--bg-2); }
  .cc-avatar {
    width: 44px; height: 44px; border-radius: 10px;
    background: var(--bg-3); display: flex;
    align-items: center; justify-content: center;
    flex-shrink: 0; overflow: hidden;
  }
  .cc-avatar img { width: 100%; height: 100%; object-fit: cover; }
  .cc-initial { font-size: 18px; font-weight: 700; color: var(--accent); }
  .cc-info { flex: 1; min-width: 0; }
  .cc-name { display: block; font-size: 15px; font-weight: 600; color: var(--text); }
  .cc-desc { display: block; font-size: 11px; color: var(--text-3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .cc-meta { display: block; font-size: 10px; color: var(--text-3); margin-top: 2px; }
  .cc-arrow { flex-shrink: 0; display: flex; align-items: center; }
</style>
