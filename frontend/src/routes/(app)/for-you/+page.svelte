<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import { avatarUrl, mediaUrl } from '$lib/helpers';
  import { user, socket, showToast } from '$lib/stores';
  import { typedSocket } from '$lib/socket-types';
  import type { User, Post } from '$lib/types';

  let usr: User | null = $state(null);
  let sk: ReturnType<typeof typedSocket> | null = $state(null);
  user.subscribe((v) => usr = v);
  socket.subscribe((v) => sk = v);

  let posts: Post[] = $state([]);
  let currentIndex = $state(0);
  let loading = $state(false);
  let likedPosts = $state<Set<number>>(new Set());
  let visibleTimer: number | null = $state(null);
  let containerEl: HTMLDivElement | undefined = $state();
  let lastLikeTap = $state(0);

  onMount(() => {
    loadMore();
  });

  onDestroy(() => {
    if (visibleTimer) clearTimeout(visibleTimer);
  });

  $effect(() => {
    if (containerEl) {
      const obs = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            const idx = parseInt(entry.target.getAttribute('data-index') || '-1');
            if (entry.isIntersecting) {
              currentIndex = idx;
              onPostVisible(entry.target as HTMLElement, idx);
            }
          });
        },
        { root: containerEl, threshold: 0.6 }
      );
      containerEl.querySelectorAll('.fyp-card').forEach((el) => obs.observe(el));
      return () => obs.disconnect();
    }
  });

  function onPostVisible(el: HTMLElement, idx: number) {
    const post = posts[idx];
    if (!post) return;
    sk?.emit('record_interaction', { postId: post.id, type: 'view' });
    if (visibleTimer) clearTimeout(visibleTimer);
    visibleTimer = window.setTimeout(() => {
      sk?.emit('record_interaction', { postId: post.id, type: 'dwell', weight: 10 });
      visibleTimer = null;
    }, 3000);
    // Auto-play video
    const video = el.querySelector('video');
    if (video) {
      video.play().catch(() => {});
      el.querySelectorAll('video').forEach((v) => { if (v !== video) v.pause(); });
    }
  }

  async function loadMore() {
    if (loading) return;
    loading = true;
    sk?.emit('get_recommended_posts', { limit: 5, cursor: posts.length > 0 ? posts[posts.length - 1].created_at : null }, (list: Post[]) => {
      if (list.length) {
        posts = [...posts, ...list];
      } else if (posts.length === 0) {
        showToast('No hay contenido recomendado');
      }
      loading = false;
    });
  }

  function handleScroll() {
    if (!containerEl) return;
    const { scrollTop, scrollHeight, clientHeight } = containerEl;
    if (scrollHeight - scrollTop - clientHeight < 400) {
      loadMore();
    }
  }

  function toggleLike(post: Post) {
    const wasLiked = likedPosts.has(post.id);
    if (wasLiked) {
      likedPosts.delete(post.id);
      likedPosts = likedPosts;
      sk?.emit('unlike_post', { postId: post.id });
      if (post.likes_count > 0) post.likes_count--;
    } else {
      likedPosts.add(post.id);
      likedPosts = likedPosts;
      sk?.emit('like_post', { postId: post.id }, (res: any) => {
        if (res?.ok) post.likes_count++;
      });
      sk?.emit('record_interaction', { postId: post.id, type: 'like' });
    }
  }

  function handleDoubleTap(e: MouseEvent | TouchEvent, post: Post) {
    const now = Date.now();
    if (now - lastLikeTap < 400) {
      if (!likedPosts.has(post.id)) {
        likedPosts.add(post.id);
        likedPosts = likedPosts;
        sk?.emit('like_post', { postId: post.id }, (res: any) => {
          if (res?.ok) post.likes_count++;
        });
        sk?.emit('record_interaction', { postId: post.id, type: 'like' });
        // Show heart animation
        const heart = (e.currentTarget as HTMLElement).querySelector('.double-tap-heart');
        if (heart) {
          heart.classList.remove('heart-anim');
          void (heart as HTMLElement).offsetWidth;
          heart.classList.add('heart-anim');
        }
      }
    }
    lastLikeTap = now;
  }

  function goPost(post: Post) {
    sk?.emit('record_interaction', { postId: post.id, type: 'comment' });
    showToast('Comentarios pronto');
  }

  function sharePost(post: Post) {
    sk?.emit('record_interaction', { postId: post.id, type: 'share' });
    showToast('Compartido');
  }
</script>

<div class="fyp-container" bind:this={containerEl} onscroll={handleScroll}>
  {#each posts as post, i (post.id)}
    <div class="fyp-card" data-index={i} onclick={(e) => handleDoubleTap(e, post)}>
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
        <svg width="80" height="80" viewBox="0 0 24 24" fill="white" stroke="white" stroke-width="1"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
      </div>

      <div class="fyp-overlay">
        <div class="fyp-user-row">
          <img src={avatarUrl(post.user_id)} alt="" class="fyp-avatar" />
          <span class="fyp-name">{post.display_name || post.username}</span>
        </div>
        {#if post.text}
          <p class="fyp-caption">{post.text}</p>
        {/if}
      </div>

      <div class="fyp-actions">
        <button class="fyp-action-btn" onclick={(e) => { e.stopPropagation(); toggleLike(post); }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill={likedPosts.has(post.id) ? '#ff3040' : 'none'} stroke={likedPosts.has(post.id) ? '#ff3040' : 'white'} stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
          <span class="fyp-action-label">{post.likes_count || ''}</span>
        </button>
        <button class="fyp-action-btn" onclick={(e) => { e.stopPropagation(); goPost(post); }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          <span class="fyp-action-label">{post.comments_count || ''}</span>
        </button>
        <button class="fyp-action-btn" onclick={(e) => { e.stopPropagation(); sharePost(post); }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
        </button>
      </div>
    </div>
  {/each}

  {#if loading}
    <div class="fyp-loading">
      <div class="spinner"></div>
    </div>
  {/if}
</div>

<style>
  .fyp-container {
    position: fixed; inset: 0; top: 0;
    overflow-y: scroll; scroll-snap-type: y mandatory;
    background: #000;
    -webkit-overflow-scrolling: touch;
  }
  .fyp-card {
    height: 100dvh; width: 100%;
    scroll-snap-align: start;
    position: relative; overflow: hidden;
    background: #111; display: flex; align-items: center; justify-content: center;
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
    color: #fff; font-size: 20px; line-height: 1.6;
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
    border: 2px solid rgba(255,255,255,0.3);
  }
  .fyp-name {
    color: #fff; font-size: 15px; font-weight: 600;
    text-shadow: 0 1px 4px rgba(0,0,0,0.5);
  }
  .fyp-caption {
    color: rgba(255,255,255,0.9); font-size: 14px; line-height: 1.4;
    margin: 0; text-shadow: 0 1px 4px rgba(0,0,0,0.5);
  }
  .fyp-actions {
    position: absolute; bottom: 120px; right: 12px; z-index: 3;
    display: flex; flex-direction: column; gap: 20px; align-items: center;
  }
  .fyp-action-btn {
    background: none; border: none; cursor: pointer;
    display: flex; flex-direction: column; align-items: center; gap: 2px;
    padding: 0; color: #fff; font-family: inherit;
  }
  .fyp-action-btn:active { transform: scale(0.9); }
  .fyp-action-label {
    font-size: 11px; font-weight: 600;
    text-shadow: 0 1px 4px rgba(0,0,0,0.5);
  }
  .fyp-loading {
    height: 80px; display: flex; align-items: center; justify-content: center;
  }
  .spinner {
    width: 24px; height: 24px; border: 3px solid rgba(255,255,255,0.15);
    border-top-color: #fff; border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
</style>