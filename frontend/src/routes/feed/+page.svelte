<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import { avatarUrl } from '$lib/helpers';
  import { user, socket, showToast } from '$lib/stores';
  import { typedSocket } from '$lib/socket-types';
  import type { User, Post, PostComment } from '$lib/types';

  let usr: User | null = $state(null);
  let sk: ReturnType<typeof typedSocket> | null = $state(null);
  user.subscribe((v) => usr = v);
  socket.subscribe((v) => sk = v);

  let posts: Post[] = $state([]);
  let currentIndex = $state(0);
  let loading = $state(false);
  let allDone = $state(false);
  let likedPosts = $state<Set<number>>(new Set());
  let visibleTimer: number | null = $state(null);
  let containerEl: HTMLDivElement | undefined = $state();
  let lastLikeTap = $state(0);
  let comments = $state<Record<number, PostComment[]>>({});
  let commentInput = $state('');
  let replyTo = $state<{ postId: number; commentId: number; username: string } | null>(null);
  let activeCommentPost = $state<number | null>(null);

  function observeCards(node: HTMLElement) {
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
      { root: node, threshold: 0.6 }
    );
    for (const el of node.querySelectorAll('.fyp-card')) obs.observe(el);
    const mo = new MutationObserver(() => {
      for (const el of node.querySelectorAll('.fyp-card')) obs.observe(el);
    });
    mo.observe(node, { childList: true, subtree: true });
    return () => { obs.disconnect(); mo.disconnect(); };
  }

  onMount(() => {
    loadMore();
    sk?.on('new_post_comment', ({ postId, comment }: any) => {
      const list = comments[postId] || [];
      list.unshift(comment);
      comments[postId] = list;
    });
    sk?.on('post_liked', ({ postId, userId }: any) => {
      const p = posts.find((x) => x.id === postId);
      if (p && p.likes_count !== undefined) p.likes_count++;
    });
  });

  onDestroy(() => {
    if (visibleTimer) clearTimeout(visibleTimer);
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
    const video = el.querySelector('video');
    if (video) {
      video.play().catch(() => {});
      el.querySelectorAll('video').forEach((v) => { if (v !== video) v.pause(); });
    }
  }

  let seenIds = $state<Set<number>>(new Set());

  async function loadMore() {
    if (loading || allDone) return;
    loading = true;
    if (!sk) {
      setTimeout(() => { loading = false; loadMore(); }, 1000);
      return;
    }
    sk.emit('get_recommended_posts', { limit: 5, seenIds: [...seenIds] }, (list: Post[]) => {
      if (list && list.length) {
        const newPosts = list.filter(p => !seenIds.has(p.id));
        if (newPosts.length === 0) { allDone = true; loading = false; return; }
        for (const p of newPosts) seenIds.add(p.id);
        posts = [...posts, ...newPosts];
        if (list.length < 5) allDone = true;
      } else if (posts.length === 0) {
        sk?.emit('get_posts', { filter: 'all', cursor: null, limit: 10 }, (fallback: Post[]) => {
          if (fallback && fallback.length) {
            const newPosts = fallback.filter(p => !seenIds.has(p.id));
            for (const p of newPosts) seenIds.add(p.id);
            posts = [...posts, ...newPosts];
          } else {
            showToast('No hay contenido disponible');
          }
          loading = false;
        });
        return;
      }
      loading = false;
    });
  }

  function handleScroll() {
    if (!containerEl || allDone) return;
    const { scrollTop, scrollHeight, clientHeight } = containerEl;
    if (scrollHeight - scrollTop - clientHeight < 600) {
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

  function toggleComments(postId: number) {
    if (activeCommentPost === postId) { activeCommentPost = null; return; }
    activeCommentPost = postId;
    if (!comments[postId]) {
      sk?.emit('get_post_comments', { postId }, (list: PostComment[]) => {
        comments[postId] = list || [];
      });
    }
  }

  function startReply(postId: number, commentId: number, displayName: string) {
    replyTo = { postId, commentId, username: displayName };
    activeCommentPost = postId;
    commentInput = '';
  }

  function cancelReply() {
    replyTo = null;
    commentInput = '';
  }

  function postComment(postId: number) {
    const txt = commentInput.trim();
    if (!txt || !sk) return;
    const payload: any = { postId, text: txt };
    if (replyTo && replyTo.postId === postId) payload.parentId = replyTo.commentId;
    sk.emit('add_post_comment', payload, (res: any) => {
      if (res?.ok) {
        commentInput = '';
        replyTo = null;
        const list = comments[postId] || [];
        list.unshift(res.comment);
        comments[postId] = list;
        const p = posts.find((x) => x.id === postId);
        if (p && p.comments_count !== undefined) p.comments_count++;
        showToast('Comentario añadido');
      }
    });
  }

  function sharePost(post: Post) {
    sk?.emit('record_interaction', { postId: post.id, type: 'share' });
    showToast('Compartido');
  }
</script>

<div class="fyp-container" bind:this={containerEl} onscroll={handleScroll} use:observeCards>
  {#each posts as post, i (post.id)}
    <div class="fyp-card" data-index={i} onclick={(e) => handleDoubleTap(e, post)}>
      {#if post.media_type === 'image' && post.media}
        <img src={post.media} alt="" class="fyp-media" />
      {:else if post.media_type === 'video' && post.media}
        <video src={post.media} muted loop playsinline class="fyp-media" preload="metadata"></video>
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
        <button class="fyp-action-btn" onclick={(e) => { e.stopPropagation(); toggleComments(post.id); }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          <span class="fyp-action-label">{post.comments_count || ''}</span>
        </button>
        <button class="fyp-action-btn" onclick={(e) => { e.stopPropagation(); sharePost(post); }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
        </button>
      </div>

      {#if activeCommentPost === post.id}
        <div class="comment-sheet" onclick={(e) => e.stopPropagation()}>
          <div class="comment-header-bar">
            <span class="comment-sheet-title">Comentarios</span>
            <button class="comment-close-btn" onclick={() => { activeCommentPost = null; }}>✕</button>
          </div>
          <div class="comment-list-scroll">
            {#each (comments[post.id] || []).filter(c => !c.parent_id) as parent}
              <div class="comment-item">
                <img src={avatarUrl(parent.user_id)} alt="" class="comment-avatar" />
                <div class="comment-body">
                  <div class="comment-header">
                    <span class="comment-author">{parent.display_name || parent.username || 'Anónimo'}</span>
                    {#if parent.user_id === post.user_id}
                      <span class="author-badge">Autor</span>
                    {/if}
                  </div>
                  <span class="comment-text">{parent.text}</span>
                  <button class="reply-btn" onclick={() => startReply(post.id, parent.id, parent.display_name || parent.username)}>Responder</button>
                </div>
              </div>
              {#each (comments[post.id] || []).filter(c => c.parent_id === parent.id) as reply}
                <div class="comment-item is-reply">
                  <img src={avatarUrl(reply.user_id)} alt="" class="comment-avatar" />
                  <div class="comment-body">
                    <div class="comment-header">
                      <span class="comment-author">{reply.display_name || reply.username || 'Anónimo'}</span>
                      {#if reply.user_id === post.user_id}
                        <span class="author-badge">Autor</span>
                      {/if}
                      <span class="reply-indicator">↪ <strong>{parent.display_name || parent.username}</strong></span>
                    </div>
                    <span class="comment-text">{reply.text}</span>
                    <button class="reply-btn" onclick={() => startReply(post.id, reply.id, reply.display_name || reply.username)}>Responder</button>
                  </div>
                </div>
              {/each}
            {/each}
            {#if !(comments[post.id] || []).length}
              <p class="no-comments">Sin comentarios</p>
            {/if}
          </div>
          <div class="comment-input-area">
            {#if replyTo && replyTo.postId === post.id}
              <div class="reply-badge">
                <span>Respondiendo a <strong>{replyTo.username}</strong></span>
                <button class="cancel-reply-btn" onclick={cancelReply}>✕</button>
              </div>
            {/if}
            <div class="input-row">
              <input type="text" bind:value={commentInput} placeholder={replyTo && replyTo.postId === post.id ? 'Escribe tu respuesta...' : 'Comentar...'} class="comment-input" onkeydown={(e) => e.key === 'Enter' && postComment(post.id)} />
              <button class="small-btn" onclick={() => postComment(post.id)}>Enviar</button>
            </div>
          </div>
        </div>
      {/if}
    </div>
  {/each}

  {#if loading}
    <div class="fyp-loading">
      <div class="spinner"></div>
    </div>
  {/if}
  <div class="fyp-footer"></div>
</div>

<button class="create-fab" onclick={() => goto('/post/new', { noScroll: true })}>
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
</button>

<style>
  .fyp-container {
    position: fixed; inset: 0; top: 0;
    overflow-y: auto;
    background: #000;
    -webkit-overflow-scrolling: touch;
    overscroll-behavior: none;
  }
  .fyp-card {
    width: 100%; min-height: 80dvh;
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
  .comment-sheet {
    position: absolute; bottom: 0; left: 0; right: 0; z-index: 10;
    background: rgba(20,20,20,0.96); backdrop-filter: blur(12px);
    border-radius: 16px 16px 0 0;
    max-height: 50vh; display: flex; flex-direction: column;
    animation: slideUp 0.25s ease-out;
  }
  @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
  .comment-header-bar {
    display: flex; align-items: center; justify-content: space-between;
    padding: 12px 16px; border-bottom: 1px solid rgba(255,255,255,0.1);
  }
  .comment-sheet-title { font-size: 15px; font-weight: 700; color: #fff; }
  .comment-close-btn { background: none; border: none; color: #fff; font-size: 18px; cursor: pointer; padding: 4px; }
  .comment-list-scroll { flex: 1; overflow-y: auto; padding: 8px 16px; }
  .comment-item { display: flex; gap: 8px; align-items: flex-start; margin-bottom: 10px; }
  .comment-item.is-reply { margin-left: 24px; padding-left: 8px; border-left: 2px solid rgba(255,255,255,0.15); }
  .comment-avatar { width: 24px; height: 24px; border-radius: 50%; object-fit: cover; flex-shrink: 0; }
  .comment-body { display: flex; flex-direction: column; gap: 1px; }
  .comment-header { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
  .comment-author { font-size: 12px; font-weight: 600; color: var(--accent); }
  .author-badge { font-size: 9px; font-weight: 700; color: #000; background: var(--accent); padding: 1px 6px; border-radius: 4px; }
  .reply-indicator { font-size: 10px; color: rgba(255,255,255,0.4); }
  .comment-text { font-size: 13px; color: rgba(255,255,255,0.9); }
  .reply-btn { background: none; border: none; color: rgba(255,255,255,0.4); font-size: 11px; cursor: pointer; padding: 0; width: fit-content; font-family: inherit; }
  .reply-btn:hover { color: var(--accent); }
  .no-comments { font-size: 12px; color: rgba(255,255,255,0.4); text-align: center; padding: 20px 0; }
  .comment-input-area { padding: 8px 16px; border-top: 1px solid rgba(255,255,255,0.1); }
  .comment-input-area .input-row { display: flex; gap: 8px; }
  .reply-badge { display: flex; align-items: center; justify-content: space-between; padding: 4px 8px; background: rgba(255,255,255,0.08); border-radius: 6px; font-size: 12px; color: rgba(255,255,255,0.6); margin-bottom: 6px; }
  .reply-badge strong { color: var(--accent); }
  .cancel-reply-btn { background: none; border: none; color: rgba(255,255,255,0.4); cursor: pointer; font-size: 14px; padding: 0 2px; }
  .cancel-reply-btn:hover { color: #fff; }
  .comment-input { flex: 1; padding: 8px 12px; border-radius: 8px; border: none; background: rgba(255,255,255,0.1); color: #fff; font-size: 13px; outline: none; }
  .comment-input::placeholder { color: rgba(255,255,255,0.3); }
  .small-btn { padding: 8px 16px; background: var(--accent); color: #000; font-weight: 600; border: none; border-radius: 8px; font-size: 13px; cursor: pointer; white-space: nowrap; }
  .fyp-footer { height: 80px; }
  .create-fab {
    position: fixed; bottom: 80px; right: calc(50% - 215px + 16px);
    width: 56px; height: 56px; border-radius: 50%; background: var(--accent);
    border: none; cursor: pointer; display: flex; align-items: center; justify-content: center;
    box-shadow: 0 4px 16px rgba(0,0,0,0.3); z-index: 10; color: #000;
  }
  @media (max-width: 430px) { .create-fab { right: 16px; } }
</style>
