<script lang="ts">
  import Icon from '$lib/icon/Icon.svelte';
  import { avatarUrl, mediaUrl } from '$lib/helpers';
  import type { Post } from '$lib/types';
  import CommentSheet from './CommentSheet.svelte';

  let {
    post,
    liked = false,
    showComments = false,
    dataIndex = -1,
    sk,
    onlike,
    oncomment,
    onshare,
    onclosecomments,
    oncommentadded,
  }: {
    post: Post;
    liked?: boolean;
    showComments?: boolean;
    dataIndex?: number;
    sk: any;
    onlike?: () => void;
    oncomment?: () => void;
    onshare?: () => void;
    onclosecomments?: () => void;
    oncommentadded?: () => void;
  } = $props();

  let lastLikeTap = $state(0);

  function handleDoubleTap(e: MouseEvent | TouchEvent) {
    const now = Date.now();
    if (now - lastLikeTap < 400) {
      if (!liked) onlike?.();
      const heart = (e.currentTarget as HTMLElement).querySelector('.double-tap-heart');
      if (heart) {
        heart.classList.remove('heart-anim');
        void (heart as HTMLElement).offsetWidth;
        heart.classList.add('heart-anim');
      }
    }
    lastLikeTap = now;
  }
</script>

<div class="fyp-card" data-index={dataIndex} onclick={handleDoubleTap}>
  {#if post.media_type === 'image' && post.media}
    <img src={mediaUrl(post.media, { w: 400, h: 600, fit: 'cover' })} alt="" class="fyp-media" />
  {:else if post.media_type === 'video' && post.media}
    <video src={mediaUrl(post.media)} muted loop playsinline class="fyp-media" preload="metadata"></video>
  {:else}
    <div class="fyp-text-bg">
      <p class="fyp-text-only">{post.text}</p>
    </div>
  {/if}

  <div class="double-tap-heart">
    <Icon name="heart" size={80} variant="filled" />
  </div>

  <div class="fyp-overlay">
    <div class="fyp-user-row">
      <img src={avatarUrl(post.user_id, post.avatar)} alt="" class="fyp-avatar" />
      <span class="fyp-name">{post.display_name || post.username}</span>
    </div>
    {#if post.text}
      <p class="fyp-caption">{post.text}</p>
    {/if}
  </div>

  <div class="fyp-actions">
    <button class="fyp-action-btn" onclick={(e) => { e.stopPropagation(); onlike?.(); }}>
      <Icon name="heart" size={28} variant={liked ? 'filled' : 'outline'} style="color: {liked ? '#ff3040' : '#fff'}" />
      <span class="fyp-action-label">{post.likes_count || ''}</span>
    </button>
    <button class="fyp-action-btn" onclick={(e) => { e.stopPropagation(); oncomment?.(); }}>
      <Icon name="message" size={28} />
      <span class="fyp-action-label">{post.comments_count || ''}</span>
    </button>
    <button class="fyp-action-btn" onclick={(e) => { e.stopPropagation(); onshare?.(); }}>
      <Icon name="share" size={28} />
    </button>
  </div>

  {#if showComments}
    <CommentSheet {post} {sk} onclose={onclosecomments} oncommentadded={oncommentadded} />
  {/if}
</div>

<style>
  .fyp-card {
    width: 100%; min-height: 80%;
    position: relative; overflow: hidden;
    background: var(--bg-2); display: flex; align-items: center; justify-content: center;
    cursor: pointer;
  }
  .fyp-media {
    position: absolute; inset: 0;
    width: 100%; height: 100%;
    object-fit: cover;
  }
  .fyp-text-bg {
    padding: 40px 24px; text-align: center;
  }
  .fyp-text-only {
    color: var(--text); font-size: 20px; line-height: 1.6;
    margin: 0; text-shadow: 0 2px 8px rgba(0,0,0,0.5);
  }
  .double-tap-heart {
    position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
    opacity: 0; pointer-events: none; z-index: 5;
  }
  .heart-anim {
    animation: heartPop 0.6s ease-out forwards;
  }
  @keyframes heartPop {
    0% { opacity: 0; transform: translate(-50%, -50%) scale(0); }
    20% { opacity: 1; transform: translate(-50%, -50%) scale(1.2); }
    40% { transform: translate(-50%, -50%) scale(1); }
    80% { opacity: 1; }
    100% { opacity: 0; transform: translate(-50%, -50%) scale(1.5); }
  }
  .fyp-overlay {
    position: absolute; bottom: 0; left: 0; right: 0;
    padding: 60px 16px 120px;
    background: linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 100%);
    z-index: 2;
  }
  .fyp-user-row {
    display: flex; align-items: center; gap: 10px; margin-bottom: 6px;
  }
  .fyp-avatar {
    width: 36px; height: 36px; border-radius: 50%; object-fit: cover;
    border: 2px solid var(--border);
  }
  .fyp-name {
    color: var(--text); font-size: 15px; font-weight: 600;
  }
  .fyp-caption {
    color: var(--text-2); font-size: 14px; line-height: 1.4;
    margin: 0;
  }
  .fyp-actions {
    position: absolute; bottom: 120px; right: 12px; z-index: 3;
    display: flex; flex-direction: column; gap: 20px; align-items: center;
  }
  .fyp-action-btn {
    background: none; border: none; cursor: pointer;
    display: flex; flex-direction: column; align-items: center; gap: 2px;
    padding: 0; color: var(--text); font-family: inherit;
  }
  .fyp-action-btn:active { transform: scale(0.9); }
  .fyp-action-label {
    font-size: 11px; font-weight: 600;
  }
</style>
