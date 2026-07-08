<script lang="ts">
  import FeedLayout from '$lib/layouts/FeedLayout.svelte';
  import { onMount, onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import Icon from '$lib/icon/Icon.svelte';
  import type { IconName } from '$lib/icon/icons';
  import { avatarUrl } from '$lib/helpers';
  import { user, socket, showToast } from '$lib/stores';
  import { typedSocket } from '$lib/socket-types';
  import { emit } from '$lib/socket';
  import type { User, Post, PostComment, StoryGroup, Live } from '$lib/types';
  import FeedCard from './components/FeedCard.svelte';
  import StoryViewer from './components/StoryViewer.svelte';
  import FeedCamera from './components/FeedCamera.svelte';

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
  let activeCommentPost = $state<number | null>(null);

  let tab: 'for_you' | 'following' | 'mine' = $state('for_you');
  let seenIds = $state<Set<number>>(new Set());
  let cursor: string | null = $state(null);

  let storyGroups: StoryGroup[] = $state([]);
  let viewingStoryGroup: StoryGroup | null = $state(null);

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
    emit('record_interaction', { postId: post.id, type: 'view' });
    if (visibleTimer) clearTimeout(visibleTimer);
    visibleTimer = window.setTimeout(() => {
      emit('record_interaction', { postId: post.id, type: 'dwell', weight: 10 });
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
    if (tab === 'for_you') {
      const list = await emit<Post[]>('get_recommended_posts', { limit: 5, seenIds: [...seenIds] });
      if (list && list.length) {
        const newPosts = list.filter(p => !seenIds.has(p.id));
        for (const p of newPosts) seenIds.add(p.id);
        posts = [...posts, ...newPosts];
        if (list.length < 5) allDone = true;
      } else if (posts.length === 0) {
        const fallback = await emit<Post[]>('get_posts', { filter: 'all', cursor: null, limit: 10 });
        if (fallback && fallback.length) {
          const newPosts = fallback.filter(p => !seenIds.has(p.id));
          for (const p of newPosts) seenIds.add(p.id);
          posts = [...posts, ...newPosts];
        } else {
          showToast('No hay contenido disponible');
        }
      }
      loading = false;
    } else {
      const filter = tab === 'mine' ? 'mine' : 'contacts';
      const list = await emit<Post[]>('get_posts', { filter, cursor: cursor, limit: 10 });
      if (list && list.length) {
        posts = [...posts, ...list];
        cursor = list[list.length - 1]?.created_at;
        if (list.length < 10) allDone = true;
      } else {
        allDone = true;
      }
      loading = false;
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

  async function loadActiveLives() {
    const list = await emit<Live[]>('get_active_lives');
    activeLives = list || [];
  }

  async function loadStories() {
    const list = await emit<StoryGroup[]>('get_stories');
    storyGroups = list || [];
  }

  function openStory(group: StoryGroup) {
    viewingStoryGroup = group;
  }

  function handleScroll() {
    if (!containerEl || allDone) return;
    const { scrollTop, scrollHeight, clientHeight } = containerEl;
    if (scrollHeight - scrollTop - clientHeight < 600) loadPosts();
  }

  async function toggleLike(post: Post) {
    const wasLiked = likedPosts.has(post.id);
    if (wasLiked) {
      likedPosts.delete(post.id);
      likedPosts = likedPosts;
      emit('unlike_post', { postId: post.id });
      if (post.likes_count > 0) post.likes_count--;
    } else {
      likedPosts.add(post.id);
      likedPosts = likedPosts;
      const res = await emit('like_post', { postId: post.id });
      if (res?.ok) post.likes_count++;
      emit('record_interaction', { postId: post.id, type: 'like' });
    }
  }

  function sharePost(post: Post) {
    emit('record_interaction', { postId: post.id, type: 'share' });
    import('$lib/platform').then(({ shareContent }) => {
      shareContent({ title: 'Vibe', text: post.text || '', url: window.location.origin + '/feed' });
    });
    showToast('Compartido');
  }

  function goToLivePage() {
    goto('/live', { noScroll: true });
  }

  function toggleComments(postId: number) {
    activeCommentPost = activeCommentPost === postId ? null : postId;
  }

  function handleCommentAdded(post: Post) {
    if (post.comments_count !== undefined) post.comments_count++;
  }

  let hasMyStory = $derived(storyGroups.some(g => g.user.id === usr?.id));
</script>

<FeedLayout>
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
      <button class="search-btn" onclick={() => goto('/search', { noScroll: true })}>
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
              <img src={avatarUrl(group.user.id, group.user.avatar)} alt="" class="story-avatar" />
              {#if group.user.id === usr?.id}
                <div class="story-plus">+</div>
              {/if}
            </div>
            <span class="story-label">{(group.user.display_name || group.user.username || '').slice(0, 10)}</span>
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
      <FeedCard
        {post}
        dataIndex={i}
        liked={likedPosts.has(post.id)}
        showComments={activeCommentPost === post.id}
        {sk}
        onlike={() => toggleLike(post)}
        oncomment={() => toggleComments(post.id)}
        onshare={() => sharePost(post)}
        onclosecomments={() => { activeCommentPost = null; }}
        oncommentadded={() => handleCommentAdded(post)}
      />
    {/each}

    {#if loading}
      <div class="fyp-loading">
        <div class="spinner"></div>
      </div>
    {/if}
    <div class="fyp-footer"></div>
  </div>
</div>
</FeedLayout>

{#if viewingStoryGroup}
  <StoryViewer group={viewingStoryGroup} onclose={() => { viewingStoryGroup = null; }} />
{/if}

<FeedCamera {sk} {usr} />

<style>
  .feed-page {
    position: relative; min-height: 100%; background: var(--bg);
    padding-top: 0;
  }
  .feed-top {
    position: sticky; top: 0; z-index: 20;
    display: flex; align-items: center; justify-content: space-between;
    padding: 8px 12px; padding-top: env(safe-area-inset-top, 8px);
    background: var(--bg-2); backdrop-filter: blur(12px);
  }
  .top-left { display: flex; align-items: center; }
  .live-btn {
    display: flex; align-items: center; gap: 4px;
    background: none; border: none; color: var(--text);
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
    background: none; border: none; color: var(--text-2);
    font-size: 16px; font-weight: 700; cursor: pointer;
    padding: 10px 20px; font-family: inherit;
    position: relative; transition: color 0.2s;
    white-space: nowrap;
  }
  .tab-btn.active { color: var(--text); }
  .tab-btn.active::after {
    content: ''; position: absolute; bottom: -2px; left: 50%;
    transform: translateX(-50%); width: 28px; height: 4px;
    background: var(--accent); border-radius: 2px;
  }
  .top-right { display: flex; align-items: center; }
  .search-btn {
    background: none; border: none; color: var(--text); cursor: pointer; padding: 6px;
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
  .story-ring.my-story { background: linear-gradient(45deg, var(--bg-3), var(--text-3)); }
  .story-avatar { width: 100%; height: 100%; border-radius: 50%; object-fit: cover; border: 2px solid var(--bg); }
  .story-plus {
    position: absolute; bottom: -2px; right: -2px;
    width: 20px; height: 20px; border-radius: 50%;
    background: var(--accent); color: var(--bg);
    font-size: 14px; font-weight: 700;
    display: flex; align-items: center; justify-content: center;
    border: 2px solid var(--bg);
  }
  .story-label { font-size: 10px; color: var(--text-2); max-width: 64px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .live-bar {
    display: flex; align-items: center; gap: 8px;
    padding: 6px 12px; overflow-x: auto;
    scrollbar-width: none;
  }
  .live-bar::-webkit-scrollbar { display: none; }
  .live-bar-label { font-size: 11px; color: var(--text-3); white-space: nowrap; }
  .live-bar-scroll { display: flex; gap: 6px; }
  .live-chip {
    display: flex; align-items: center; gap: 6px;
    background: rgba(255,48,64,0.15); border: 1px solid rgba(255,48,64,0.3);
    border-radius: 14px; padding: 8px 14px; color: #ff3040;
    font-size: 13px; font-weight: 700; cursor: pointer;
    font-family: inherit; white-space: nowrap;
  }
  .live-dot-small { width: 6px; height: 6px; border-radius: 50%; background: #ff3040; }
  .feed-empty {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    padding: 80px 32px; gap: 12px; min-height: 60%;
  }
  .feed-empty-text { color: var(--text-3); font-size: 15px; font-weight: 500; margin: 0; }
  .feed-empty-hint { color: var(--text-3); font-size: 13px; margin: 0; text-align: center; max-width: 260px; line-height: 1.5; }
  .fyp-container {
    overflow-y: auto;
    background: var(--bg);
    -webkit-overflow-scrolling: touch;
    overscroll-behavior: none;
  }
  .fyp-loading {
    height: 80px; display: flex; align-items: center; justify-content: center;
  }
  .spinner {
    width: 24px; height: 24px; border: 3px solid var(--border);
    border-top-color: var(--text); border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  .fyp-footer { height: 80px; }
</style>
