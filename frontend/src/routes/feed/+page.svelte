<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import Icon from '$lib/icon/Icon.svelte';
  import { avatarUrl, mediaUrl } from '$lib/helpers';
  import { user, socket, showToast } from '$lib/stores';
  import { typedSocket } from '$lib/socket-types';
  import type { User, Post, PostComment, StoryGroup, Live } from '$lib/types';

  let usr: User | null = $state(null);
  let sk: ReturnType<typeof typedSocket> | null = $state(null);
  user.subscribe((v) => usr = v);
  socket.subscribe((v) => sk = v);

  let posts: Post[] = $state([]);
  let activeLives: Live[] = $state([]);
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
  let mentionQuery = $state('');
  let mentionResults = $state<User[]>([]);
  let mentionActive = $state(false);
  let mentionIndex = $state(-1);

  let tab: 'for_you' | 'following' | 'mine' = $state('for_you');
  let seenIds = $state<Set<number>>(new Set());
  let cursor: string | null = $state(null);

  let storyGroups: StoryGroup[] = $state([]);
  let viewingStoryGroup: StoryGroup | null = $state(null);
  let viewingStoryIdx = $state(0);

  interface CommentNode { comment: PostComment; depth: number; parentName?: string }
  function buildTree(list: PostComment[]): CommentNode[] {
    const roots = list.filter(c => !c.parent_id);
    roots.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    const out: CommentNode[] = [];
    function walk(c: PostComment, depth: number, parentName?: string) {
      out.push({ comment: c, depth, parentName });
      const children = list.filter(x => x.parent_id === c.id);
      children.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      const nextDepth = depth < 3 ? depth + 1 : depth;
      for (const ch of children) walk(ch, nextDepth, c.display_name || c.username);
    }
    for (const r of roots) walk(r, 0);
    return out;
  }

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
    loadPosts();
    loadStories();
    loadActiveLives();
    sk?.on('new_post_comment', ({ postId, comment }: any) => {
      const list = comments[postId] || [];
      list.unshift(comment);
      comments[postId] = list;
    });
    sk?.on('post_liked', ({ postId, userId }: any) => {
      const p = posts.find((x) => x.id === postId);
      if (p && p.likes_count !== undefined) p.likes_count++;
    });
    sk?.on('new_post', (post: Post) => {
      if (tab === 'for_you') posts = [post, ...posts];
    });
    sk?.on('live_started', (live: Live) => {
      activeLives = [live, ...activeLives];
    });
    sk?.on('live_ended', ({ liveId }: any) => {
      activeLives = activeLives.filter(l => l.id !== liveId);
    });
    sk?.on('new_story', () => loadStories());
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

  async function loadPosts() {
    if (loading) return;
    loading = true;
    if (!sk) { setTimeout(() => { loading = false; loadPosts(); }, 1000); return; }
    if (tab === 'for_you') {
      sk.emit('get_recommended_posts', { limit: 5, seenIds: [...seenIds] }, (list: Post[]) => {
        if (list && list.length) {
          const newPosts = list.filter(p => !seenIds.has(p.id));
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
          });
        }
        loading = false;
      });
    } else {
      const filter = tab === 'mine' ? 'mine' : 'contacts';
      sk.emit('get_posts', { filter, cursor: cursor, limit: 10 }, (list: Post[]) => {
        if (list && list.length) {
          posts = [...posts, ...list];
          cursor = list[list.length - 1]?.created_at;
          if (list.length < 10) allDone = true;
        } else {
          allDone = true;
        }
        loading = false;
      });
    }
  }

  function switchTab(newTab: 'for_you' | 'following' | 'mine') {
    if (newTab === tab) return;
    tab = newTab;
    posts = [];
    seenIds = new Set();
    cursor = null;
    allDone = false;
    loadPosts();
  }

  function loadActiveLives() {
    sk?.emit('get_active_lives', (list: Live[]) => {
      activeLives = list;
    });
  }

  function loadStories() {
    sk?.emit('get_stories', (list: StoryGroup[]) => {
      storyGroups = list || [];
    });
  }

  function openStory(group: StoryGroup) {
    viewingStoryGroup = group;
    viewingStoryIdx = 0;
  }

  function closeStory() {
    viewingStoryGroup = null;
  }

  function nextStory() {
    if (!viewingStoryGroup) return;
    if (viewingStoryIdx < viewingStoryGroup.stories.length - 1) {
      viewingStoryIdx++;
    } else {
      closeStory();
    }
  }

  function prevStory() {
    if (!viewingStoryGroup) return;
    if (viewingStoryIdx > 0) viewingStoryIdx--;
  }

  function handleStoryKeydown(e: KeyboardEvent) {
    if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); nextStory(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); prevStory(); }
    else if (e.key === 'Escape') { closeStory(); }
  }

  function handleScroll() {
    if (!containerEl || allDone) return;
    const { scrollTop, scrollHeight, clientHeight } = containerEl;
    if (scrollHeight - scrollTop - clientHeight < 600) loadPosts();
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

  function postComment(postId: number, parentId?: number) {
    const txt = commentInput.trim();
    if (!txt || !sk) return;
    const payload: any = { postId, text: txt };
    if (parentId) payload.parentId = parentId;
    sk.emit('add_post_comment', payload, (res: any) => {
      if (res?.ok) {
        commentInput = '';
        replyTo = null;
        const list = comments[postId] || [];
        list.unshift(res.comment);
        comments[postId] = list;
        const p = posts.find((x) => x.id === postId);
        if (p && p.comments_count !== undefined) p.comments_count++;
      }
    });
  }

  function sharePost(post: Post) {
    sk?.emit('record_interaction', { postId: post.id, type: 'share' });
    import('$lib/platform').then(({ shareContent }) => {
      shareContent({ title: 'Vibe', text: post.text || '', url: window.location.origin + '/feed' });
    });
    showToast('Compartido');
  }

  function renderText(text: string): string {
    return text.replace(/@(\w+)/g, '<span class="mention">@$1</span>');
  }

  function onCommentInput(e: Event) {
    const el = e.target as HTMLInputElement;
    const val = el.value;
    commentInput = val;
    const atIdx = val.lastIndexOf('@');
    if (atIdx !== -1 && (atIdx === 0 || val[atIdx - 1] === ' ')) {
      const q = val.slice(atIdx + 1);
      if (q && !q.includes(' ')) {
        mentionQuery = q;
        sk?.emit('search_users', { query: q }, (res: User[]) => {
          mentionResults = res || [];
          mentionActive = (res || []).length > 0;
          mentionIndex = -1;
        });
        return;
      }
    }
    mentionActive = false;
    mentionResults = [];
  }

  function selectMention(user: User) {
    const atIdx = commentInput.lastIndexOf('@' + mentionQuery);
    if (atIdx !== -1) {
      const before = commentInput.slice(0, atIdx);
      const after = commentInput.slice(atIdx + mentionQuery.length + 1);
      commentInput = before + '@' + user.username + ' ' + after;
    }
    mentionActive = false;
    mentionResults = [];
    mentionQuery = '';
  }

  function onMentionKeydown(e: KeyboardEvent) {
    if (!mentionActive) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); mentionIndex = Math.min(mentionIndex + 1, mentionResults.length - 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); mentionIndex = Math.max(mentionIndex - 1, 0); }
    else if (e.key === 'Enter' && mentionIndex >= 0 && mentionResults[mentionIndex]) {
      e.preventDefault();
      selectMention(mentionResults[mentionIndex]);
    } else if (e.key === 'Escape') { mentionActive = false; mentionResults = []; }
  }

  function goToLivePage() {
    goto('/live', { noScroll: true });
  }

  let storyTimer: number | null = $state(null);
  $effect(() => {
    if (viewingStoryGroup) {
      const story = viewingStoryGroup.stories[viewingStoryIdx];
      if (story) {
        sk?.emit('view_story', { storyId: story.id });
        if (storyTimer) clearTimeout(storyTimer);
        storyTimer = window.setTimeout(() => {
          nextStory();
        }, 5000);
      }
    } else {
      if (storyTimer) clearTimeout(storyTimer);
    }
    return () => { if (storyTimer) clearTimeout(storyTimer); };
  });

  let hasMyStory = $derived(storyGroups.some(g => g.user.id === usr?.id));

  function getStoryAvatar(group: StoryGroup): string {
    return group.user.avatar || avatarUrl(group.user.id);
  }

  function getStoryName(group: StoryGroup): string {
    return group.user.display_name || group.user.username || '';
  }
</script>

<div class="feed-page">
  <!-- Top Bar -->
  <div class="feed-top">
    <div class="top-left">
      <button class="live-btn" onclick={goToLivePage}>
        <span class="live-dot"></span>
        LIVE
      </button>
    </div>
    <div class="top-tabs">
      <button class="tab-btn {tab === 'for_you' ? 'active' : ''}" onclick={() => switchTab('for_you')}>Para ti</button>
      <button class="tab-btn {tab === 'following' ? 'active' : ''}" onclick={() => switchTab('following')}>Siguiendo</button>
      <button class="tab-btn {tab === 'mine' ? 'active' : ''}" onclick={() => switchTab('mine')}>Míos</button>
    </div>
    <div class="top-right">
      <button class="search-btn" onclick={() => goto('/contact', { noScroll: true })}>
        <Icon name="search" size={22} />
      </button>
    </div>
  </div>

  <!-- Stories Bar -->
  {#if storyGroups.length > 0}
    <div class="stories-bar">
      <div class="stories-scroll">
        {#each storyGroups as group, i}
          <button class="story-item" onclick={() => openStory(group)}>
            <div class="story-ring {group.user.id === usr?.id ? 'my-story' : ''}">
              <img src={getStoryAvatar(group)} alt="" class="story-avatar" />
              {#if group.user.id === usr?.id}
                <div class="story-plus">+</div>
              {/if}
            </div>
            <span class="story-label">{getStoryName(group).slice(0, 10)}</span>
          </button>
        {/each}
      </div>
    </div>
  {/if}

  <!-- Live Bar (active lives) -->
  {#if activeLives.length > 0 && tab === 'for_you'}
    <div class="live-bar">
      <span class="live-bar-label">En vivo ahora</span>
      <div class="live-bar-scroll">
        {#each activeLives as live}
          <button class="live-chip" onclick={() => goto('/live', { noScroll: true })}>
            <span class="live-dot-small"></span>
            {live.display_name || live.username}
          </button>
        {/each}
      </div>
    </div>
  {/if}

  <!-- Posts Feed -->
  <div class="fyp-container" bind:this={containerEl} onscroll={handleScroll} use:observeCards>
    {#if posts.length === 0 && !loading}
      <div class="feed-empty">
        <Icon name="{tab === 'mine' ? 'user' : tab === 'following' ? 'users' : 'globe'}" size={48} strokeWidth={1.5} style="color: var(--text-3)" />
        <p class="feed-empty-text">
          {tab === 'mine' ? 'No hay posts propios' : tab === 'following' ? 'No hay posts de contactos' : 'No hay contenido disponible'}
        </p>
        <p class="feed-empty-hint">
          {tab === 'mine' ? 'Crea tu primer post' : tab === 'following' ? 'Sigue a más personas para ver su contenido' : 'Vuelve más tarde para ver nuevas publicaciones'}
        </p>
      </div>
    {/if}
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
          <Icon name="heart" size={80} variant="filled" />
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
            <Icon name="heart" size={28} variant={likedPosts.has(post.id) ? 'filled' : 'outline'} style="color: {likedPosts.has(post.id) ? '#ff3040' : '#fff'}" />
            <span class="fyp-action-label">{post.likes_count || ''}</span>
          </button>
          <button class="fyp-action-btn" onclick={(e) => { e.stopPropagation(); toggleComments(post.id); }}>
            <Icon name="message" size={28} />
            <span class="fyp-action-label">{post.comments_count || ''}</span>
          </button>
          <button class="fyp-action-btn" onclick={(e) => { e.stopPropagation(); sharePost(post); }}>
            <Icon name="share" size={28} />
          </button>
        </div>

        {#if activeCommentPost === post.id}
          <div class="comment-sheet" onclick={(e) => e.stopPropagation()}>
            <div class="comment-header-bar">
              <span class="comment-sheet-title">Comentarios</span>
              <button class="comment-close-btn" onclick={() => { activeCommentPost = null; }}>✕</button>
            </div>
            <div class="comment-list-scroll">
              {#each buildTree(comments[post.id] || []) as node}
                <div class="comment-item" style="margin-left: {node.depth * 18}px; border-left: {node.depth > 0 && node.depth <= 3 ? '2px solid rgba(255,255,255,0.1)' : 'none'}; padding-left: {node.depth > 0 && node.depth <= 3 ? '8px' : '0'};">
                  <img src={avatarUrl(node.comment.user_id)} alt="" class="comment-avatar" />
                  <div class="comment-body">
                    <div class="comment-header">
                      <span class="comment-author">{node.comment.display_name || node.comment.username || 'Anónimo'}</span>
                      {#if node.comment.user_id === post.user_id}
                        <span class="author-badge">Autor</span>
                      {/if}
                      {#if node.parentName}
                        <span class="reply-indicator">↪ <strong>{node.parentName}</strong></span>
                      {/if}
                    </div>
                    <span class="comment-text">{@html renderText(node.comment.text)}</span>
                    <button class="reply-btn" onclick={() => startReply(post.id, node.comment.id, node.comment.display_name || node.comment.username)}>{node.depth < 3 ? 'Responder' : 'Comentar'}</button>
                    {#if replyTo && replyTo.postId === post.id && replyTo.commentId === node.comment.id}
                      <div class="inline-reply">
                        <input type="text" bind:value={commentInput} placeholder="Escribe tu respuesta..." class="comment-input" oninput={onCommentInput} onkeydown={(e) => { onMentionKeydown(e); if (e.key === 'Enter' && !mentionActive) postComment(post.id, node.comment.id); }} />
                        <button class="small-btn" onclick={() => postComment(post.id, node.comment.id)}>Enviar</button>
                        <button class="cancel-reply-btn" onclick={cancelReply}>✕</button>
                        {#if mentionActive}
                          <div class="mention-dropdown">
                            {#each mentionResults as u, idx}
                              <button class="mention-item {idx === mentionIndex ? 'active' : ''}" type="button" onmousedown={() => selectMention(u)}>{u.display_name || u.username} <span class="mention-username">@{u.username}</span></button>
                            {/each}
                          </div>
                        {/if}
                      </div>
                    {/if}
                  </div>
                </div>
              {/each}
              {#if !(comments[post.id] || []).length}
                <p class="no-comments">Sin comentarios</p>
              {/if}
            </div>
            <div class="comment-input-area">
              <div class="input-row">
                <input type="text" bind:value={commentInput} placeholder="Comentar..." class="comment-input" oninput={onCommentInput} onkeydown={(e) => { onMentionKeydown(e); if (e.key === 'Enter' && !mentionActive) postComment(post.id); }} />
                <button class="small-btn" onclick={() => postComment(post.id)}>Enviar</button>
                {#if mentionActive}
                  <div class="mention-dropdown">
                    {#each mentionResults as u, idx}
                      <button class="mention-item {idx === mentionIndex ? 'active' : ''}" type="button" onmousedown={() => selectMention(u)}>{u.display_name || u.username} <span class="mention-username">@{u.username}</span></button>
                    {/each}
                  </div>
                {/if}
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
</div>

<!-- Story Viewer -->
{#if viewingStoryGroup}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="story-viewer" tabindex="0" onkeydown={handleStoryKeydown} role="dialog">
    <div class="story-progress">
      {#each viewingStoryGroup.stories as _, si}
        <div class="progress-segment">
          <div class="progress-bar {si === viewingStoryIdx ? 'active' : si < viewingStoryIdx ? 'seen' : ''}"></div>
        </div>
      {/each}
    </div>
    <div class="story-header">
      <img src={getStoryAvatar(viewingStoryGroup)} alt="" class="story-viewer-avatar" />
      <span class="story-viewer-name">{getStoryName(viewingStoryGroup)}</span>
      <button class="story-close-btn" onclick={closeStory}>
        <Icon name="x" size={24} />
      </button>
    </div>
    <div class="story-content" onclick={nextStory}>
      <img src={mediaUrl(viewingStoryGroup.stories[viewingStoryIdx]?.media_url || '', { w: 400, h: 700 })} alt="" class="story-media" />
    </div>
    <div class="story-tap-left" onclick={(e) => { e.stopPropagation(); prevStory(); }}></div>
  </div>
{/if}

<style>
  .feed-page {
    position: relative; min-height: 100dvh; background: #000;
    padding-top: 0;
  }
  .feed-top {
    position: sticky; top: 0; z-index: 20;
    display: flex; align-items: center; justify-content: space-between;
    padding: 8px 12px; padding-top: env(safe-area-inset-top, 8px);
    background: rgba(0,0,0,0.95); backdrop-filter: blur(12px);
  }
  .top-left { display: flex; align-items: center; }
  .live-btn {
    display: flex; align-items: center; gap: 4px;
    background: none; border: none; color: #fff;
    font-size: 13px; font-weight: 800; cursor: pointer;
    padding: 4px 10px; border-radius: 6px;
    letter-spacing: 0.5px;
  }
  .live-dot {
    width: 8px; height: 8px; border-radius: 50%;
    background: #ff3040;
    animation: pulse 1.5s infinite;
  }
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }
  .top-tabs { display: flex; gap: 0; position: absolute; left: 50%; transform: translateX(-50%); }
  .tab-btn {
    background: none; border: none; color: rgba(255,255,255,0.5);
    font-size: 14px; font-weight: 600; cursor: pointer;
    padding: 6px 14px; font-family: inherit;
    position: relative; transition: color 0.2s;
    white-space: nowrap;
  }
  .tab-btn.active { color: #fff; }
  .tab-btn.active::after {
    content: ''; position: absolute; bottom: -2px; left: 50%;
    transform: translateX(-50%); width: 20px; height: 3px;
    background: var(--accent); border-radius: 2px;
  }
  .top-right { display: flex; align-items: center; }
  .search-btn {
    background: none; border: none; color: #fff; cursor: pointer; padding: 6px;
  }
  .stories-bar {
    padding: 8px 0 4px; overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
  }
  .stories-bar::-webkit-scrollbar { display: none; }
  .stories-scroll { display: flex; gap: 12px; padding: 0 12px; }
  .story-item {
    display: flex; flex-direction: column; align-items: center; gap: 4px;
    background: none; border: none; cursor: pointer; padding: 0;
    min-width: 68px; flex-shrink: 0;
  }
  .story-ring {
    width: 60px; height: 60px; border-radius: 50%;
    padding: 2px; background: linear-gradient(45deg, var(--accent), #ff3040, #ff6b6b);
    display: flex; align-items: center; justify-content: center;
    position: relative;
  }
  .story-ring.my-story { background: linear-gradient(45deg, #555, #777); }
  .story-avatar { width: 100%; height: 100%; border-radius: 50%; object-fit: cover; border: 2px solid #000; }
  .story-plus {
    position: absolute; bottom: -2px; right: -2px;
    width: 20px; height: 20px; border-radius: 50%;
    background: var(--accent); color: #000;
    font-size: 14px; font-weight: 700;
    display: flex; align-items: center; justify-content: center;
    border: 2px solid #000;
  }
  .story-label { font-size: 10px; color: rgba(255,255,255,0.6); max-width: 64px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .live-bar {
    display: flex; align-items: center; gap: 8px;
    padding: 6px 12px; overflow-x: auto;
    scrollbar-width: none;
  }
  .live-bar::-webkit-scrollbar { display: none; }
  .live-bar-label { font-size: 11px; color: rgba(255,255,255,0.4); white-space: nowrap; }
  .live-bar-scroll { display: flex; gap: 6px; }
  .live-chip {
    display: flex; align-items: center; gap: 4px;
    background: rgba(255,48,64,0.15); border: 1px solid rgba(255,48,64,0.3);
    border-radius: 12px; padding: 4px 10px; color: #ff3040;
    font-size: 11px; font-weight: 600; cursor: pointer;
    font-family: inherit; white-space: nowrap;
  }
  .live-dot-small { width: 6px; height: 6px; border-radius: 50%; background: #ff3040; }
  .feed-empty {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    padding: 80px 32px; gap: 12px; min-height: 60dvh;
  }
  .feed-empty-text { color: var(--text-3); font-size: 15px; font-weight: 500; margin: 0; }
  .feed-empty-hint { color: rgba(255,255,255,0.3); font-size: 13px; margin: 0; text-align: center; max-width: 260px; line-height: 1.5; }
  .fyp-container {
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
  .comment-avatar { width: 24px; height: 24px; border-radius: 50%; object-fit: cover; flex-shrink: 0; }
  .comment-body { display: flex; flex-direction: column; gap: 1px; }
  .comment-header { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
  .comment-author { font-size: 12px; font-weight: 600; color: var(--accent); }
  .author-badge { font-size: 9px; font-weight: 700; color: #000; background: var(--accent); padding: 1px 6px; border-radius: 4px; }
  .reply-indicator { font-size: 10px; color: rgba(255,255,255,0.4); }
  .inline-reply { display: flex; gap: 6px; margin-top: 6px; }
  .comment-text { font-size: 13px; color: rgba(255,255,255,0.9); }
  .reply-btn { background: none; border: none; color: rgba(255,255,255,0.4); font-size: 11px; cursor: pointer; padding: 0; width: fit-content; font-family: inherit; }
  .reply-btn:hover { color: var(--accent); }
  .no-comments { font-size: 12px; color: rgba(255,255,255,0.4); text-align: center; padding: 20px 0; }
  .comment-input-area { padding: 8px 16px; border-top: 1px solid rgba(255,255,255,0.1); }
  .comment-input-area .input-row { display: flex; gap: 8px; }
  .comment-input { flex: 1; padding: 8px 12px; border-radius: 8px; border: none; background: rgba(255,255,255,0.1); color: #fff; font-size: 13px; outline: none; }
  .comment-input::placeholder { color: rgba(255,255,255,0.3); }
  .mention { color: var(--accent); font-weight: 600; }
  .mention-dropdown { position: absolute; bottom: 100%; left: 0; right: 0; background: #1a1a2e; border: 1px solid rgba(255,255,255,0.15); border-radius: 8px; max-height: 160px; overflow-y: auto; z-index: 10; }
  .mention-item { display: flex; align-items: center; gap: 6px; width: 100%; padding: 8px 12px; background: none; border: none; color: #fff; font-size: 13px; cursor: pointer; text-align: left; font-family: inherit; }
  .mention-item.active { background: rgba(255,255,255,0.1); }
  .mention-username { color: var(--accent); font-size: 11px; }
  .small-btn { padding: 8px 16px; background: var(--accent); color: #000; font-weight: 600; border: none; border-radius: 8px; font-size: 13px; cursor: pointer; white-space: nowrap; }
  .fyp-footer { height: 80px; }
  .create-fab {
    position: fixed; bottom: 80px; right: 16px;
    width: 56px; height: 56px; border-radius: 50%; background: var(--accent);
    border: none; cursor: pointer; display: flex; align-items: center; justify-content: center;
    box-shadow: 0 4px 16px rgba(0,0,0,0.3); z-index: 10; color: #000;
  }

  /* Create Overlay */
  .create-overlay {
    position: fixed; inset: 0; z-index: 50;
    background: #000; display: flex; flex-direction: column;
    animation: fadeIn 0.2s ease-out;
  }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  .create-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 8px 12px; padding-top: env(safe-area-inset-top, 8px);
    z-index: 2;
  }
  .create-close { background: none; border: none; color: #fff; cursor: pointer; padding: 8px; }
  .create-tabs { display: flex; gap: 0; position: absolute; left: 50%; transform: translateX(-50%); }
  .create-tab {
    background: none; border: none; color: rgba(255,255,255,0.4);
    font-size: 15px; font-weight: 600; cursor: pointer;
    padding: 8px 16px; font-family: inherit;
    transition: color 0.2s;
  }
  .create-tab.active { color: #fff; }
  .create-swipe {
    display: flex; width: 300%; flex: 1;
    transition: transform 0.3s ease-out;
  }
  .create-panel {
    width: 100vw; flex-shrink: 0;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
  }
  .live-preview-placeholder {
    display: flex; flex-direction: column; align-items: center; gap: 16px;
  }
  .live-placeholder-text { color: rgba(255,255,255,0.5); font-size: 16px; }
  .go-live-btn {
    display: flex; align-items: center; gap: 8px;
    background: #ff3040; color: #fff; border: none;
    padding: 12px 28px; border-radius: 24px;
    font-size: 16px; font-weight: 700; cursor: pointer;
    font-family: inherit;
  }
  .text-panel { padding: 40px 20px; align-items: stretch; }
  .text-create-area {
    display: flex; flex-direction: column; gap: 16px; flex: 1;
    padding-top: 40px;
  }
  .text-input {
    flex: 1; background: rgba(255,255,255,0.05); border: none;
    border-radius: 12px; padding: 16px; color: #fff;
    font-size: 16px; resize: none; outline: none;
    font-family: inherit; min-height: 200px;
  }
  .text-input::placeholder { color: rgba(255,255,255,0.3); }
  .publish-text-btn {
    padding: 14px; background: var(--accent); color: #000;
    font-weight: 700; border: none; border-radius: 12px;
    font-size: 16px; cursor: pointer; font-family: inherit;
  }
  .publish-text-btn:disabled { opacity: 0.4; cursor: default; }

  /* Story Viewer */
  .story-viewer {
    position: fixed; inset: 0; z-index: 60;
    background: #000; display: flex; flex-direction: column;
    outline: none;
  }
  .story-progress {
    display: flex; gap: 3px; padding: 8px 8px 4px;
    padding-top: env(safe-area-inset-top, 8px);
    z-index: 2;
  }
  .progress-segment { flex: 1; height: 2px; background: rgba(255,255,255,0.3); border-radius: 2px; overflow: hidden; }
  .progress-bar { height: 100%; background: #fff; border-radius: 2px; width: 0; transition: none; }
  .progress-bar.active { animation: progressAnim 5s linear forwards; }
  .progress-bar.seen { width: 100%; }
  @keyframes progressAnim { from { width: 0; } to { width: 100%; } }
  .story-header {
    display: flex; align-items: center; gap: 10px;
    padding: 8px 12px; z-index: 2;
  }
  .story-viewer-avatar { width: 32px; height: 32px; border-radius: 50%; object-fit: cover; }
  .story-viewer-name { color: #fff; font-size: 14px; font-weight: 600; flex: 1; }
  .story-close-btn { background: none; border: none; color: #fff; cursor: pointer; padding: 4px; }
  .story-content {
    flex: 1; display: flex; align-items: center; justify-content: center;
    position: relative; cursor: pointer;
  }
  .story-media {
    width: 100%; height: 100%; object-fit: contain;
  }
  .story-tap-left {
    position: absolute; top: 0; bottom: 0; left: 0; width: 35%;
    z-index: 3; cursor: pointer;
  }
  .filter-btn {
    position: absolute; top: 16px; left: 16px; z-index: 3;
    display: flex; flex-direction: column; align-items: center; gap: 2px;
    background: rgba(0,0,0,0.4); border: none; color: #fff;
    padding: 8px; border-radius: 8px; cursor: pointer;
  }
  .filter-label { font-size: 9px; font-weight: 600; }
  .cam-bottom {
    position: absolute; bottom: 0; left: 0; right: 0;
    display: flex; flex-direction: column; align-items: center;
    padding: 20px 20px calc(40px + env(safe-area-inset-bottom, 0px));
    background: linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 100%);
    z-index: 2;
  }
  .mode-toggle {
    display: flex; gap: 0; margin-bottom: 16px;
    background: rgba(255,255,255,0.15); border-radius: 20px; padding: 3px;
  }
  .mode-btn {
    background: none; border: none; color: rgba(255,255,255,0.6);
    padding: 6px 20px; border-radius: 18px; font-size: 13px;
    font-weight: 600; cursor: pointer; font-family: inherit;
    transition: all 0.2s;
  }
  .mode-btn.active { background: #fff; color: #000; }
  .duration-selector {
    display: flex; gap: 4px; margin-bottom: 16px;
  }
  .duration-btn {
    background: rgba(255,255,255,0.1); border: none; color: rgba(255,255,255,0.5);
    padding: 4px 14px; border-radius: 12px; font-size: 12px;
    font-weight: 500; cursor: pointer; font-family: inherit;
    transition: all 0.2s;
  }
  .duration-btn.active { background: var(--accent); color: #000; font-weight: 700; }
  .capture-btn {
    width: 72px; height: 72px; border-radius: 50%;
    background: none; border: 4px solid rgba(255,255,255,0.8);
    cursor: pointer; display: flex; align-items: center; justify-content: center;
  }
  .capture-ring { width: 58px; height: 58px; border-radius: 50%; background: rgba(255,255,255,0.9); }
  .record-btn {
    width: 72px; height: 72px; border-radius: 50%;
    background: none; border: 4px solid rgba(255,255,255,0.8);
    cursor: pointer; display: flex; align-items: center; justify-content: center;
    transition: all 0.2s;
  }
  .record-btn.recording-active { border-color: #ff3040; }
  .record-ring { width: 58px; height: 58px; border-radius: 50%; background: #ff3040; }
  .record-btn.recording-active .record-ring { width: 28px; height: 28px; border-radius: 6px; background: #ff3040; }
  .recording-indicator {
    position: absolute; top: 60px; left: 50%; transform: translateX(-50%);
    z-index: 3; display: flex; align-items: center; gap: 8px;
    background: rgba(0,0,0,0.5); padding: 6px 16px; border-radius: 20px;
  }
  .recording-progress-ring {
    width: 40px; height: 4px; background: rgba(255,255,255,0.3); border-radius: 2px; overflow: hidden;
    position: relative;
  }
  .recording-progress-ring::after {
    content: ''; position: absolute; left: 0; top: 0; height: 100%;
    width: var(--progress); background: #ff3040; border-radius: 2px;
    transition: width 0.3s;
  }
  .recording-time { color: #fff; font-size: 13px; font-weight: 600; font-variant-numeric: tabular-nums; }
  .flip-btn {
    position: absolute; top: 50%; right: 20px; transform: translateY(-50%);
    background: rgba(0,0,0,0.4); border: none; color: #fff;
    width: 44px; height: 44px; border-radius: 50%;
    cursor: pointer; display: flex; align-items: center; justify-content: center;
    z-index: 2;
  }
  .camera-panel { position: relative; overflow: hidden; }
  .create-video { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
  .camera-loading { color: rgba(255,255,255,0.5); font-size: 14px; }
  .captured-preview { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
  .post-options {
    position: absolute; bottom: 40px; left: 50%; transform: translateX(-50%);
    display: flex; gap: 24px; align-items: center; z-index: 2;
  }
  .retake-btn {
    width: 44px; height: 44px; border-radius: 50%;
    background: rgba(255,255,255,0.2); border: none; color: #fff;
    cursor: pointer; display: flex; align-items: center; justify-content: center;
  }
  .option-btn {
    display: flex; flex-direction: column; align-items: center; gap: 4px;
    background: none; border: none; color: #fff; cursor: pointer;
    font-size: 12px; font-family: inherit;
  }
  .option-btn svg { filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5)); }
  .story-option svg { stroke: var(--accent); }
</style>
