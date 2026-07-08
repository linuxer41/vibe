<script lang="ts">
  import { avatarUrl, formatDate } from '$lib/helpers';
  import Icon from '$lib/icon/Icon.svelte';
  import type { Channel, ChannelPost } from '$lib/types';

  let {
    channel,
    posts = [],
    oncreatepost = (_text: string) => {}
  }: {
    channel: Channel;
    posts?: ChannelPost[];
    oncreatepost?: (text: string) => void;
  } = $props();

  let newPostText = $state('');

  function createPost() {
    if (!newPostText) return;
    oncreatepost(newPostText);
    newPostText = '';
  }
</script>

<div class="ch-detail-header">
  <div class="ch-detail-info">
    <span class="ch-detail-desc">{channel.description || 'Sin descripción'}</span>
    <span class="ch-detail-meta">{channel.subscribers || 0} suscriptores</span>
  </div>
</div>

<div class="ch-posts">
  {#each posts as post (post.id)}
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
  {#if posts.length === 0}
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

<style>
  .ch-detail-header { padding: 16px; background: var(--bg-2); border-bottom: 1px solid var(--border); flex-shrink: 0; }
  .ch-detail-info { display: flex; flex-direction: column; gap: 4px; }
  .ch-detail-desc { font-size: 13px; color: var(--text-2); }
  .ch-detail-meta { font-size: 11px; color: var(--text-3); }

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

  .ch-post-input { display: flex; align-items: center; gap: 8px; padding: 10px 16px; background: var(--bg-2); border-top: 1px solid var(--border); flex-shrink: 0; }
  .ch-input { flex: 1; padding: 10px 14px; border: none; border-radius: 10px; font-size: 14px; outline: none; background: var(--bg-3); color: var(--text); }
  .ch-input::placeholder { color: var(--text-3); }
  .ch-send { width: 36px; height: 36px; border-radius: 50%; background: var(--accent); color: #000; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: opacity 0.15s; }
  .ch-send:disabled { opacity: 0.4; cursor: default; }

  .empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 64px 24px; gap: 12px; }
  .empty-state p { color: var(--text-3); font-size: 14px; }
</style>
