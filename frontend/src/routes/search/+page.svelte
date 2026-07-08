<script lang="ts">
  import { emit } from '$lib/socket';
  import { goto } from '$app/navigation';
  import { avatarUrl, mediaUrl } from '$lib/helpers';
  import type { User, Post } from '$lib/types';
  import HeaderLayout from '$lib/layouts/HeaderLayout.svelte';
  import Icon from '$lib/icon/Icon.svelte';
  import type { IconName } from '$lib/icon/icons';

  let query = $state('');
  let users: User[] = $state([]);
  let posts: Post[] = $state([]);
  let loading = $state(false);

  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  function onInput(e: Event) {
    const val = (e.target as HTMLInputElement).value;
    query = val;
    clearTimeout(debounceTimer);
    if (val.length < 2) { users = []; posts = []; return; }
    debounceTimer = setTimeout(() => doSearch(val), 300);
  }

  async function doSearch(q: string) {
    loading = true;
    try {
      users = await emit<User[]>('search_users', { query: q }) || [];
      posts = await emit<Post[]>('search_posts', { query: q }) || [];
    } catch { users = []; posts = []; }
    loading = false;
  }
</script>

<HeaderLayout title="Buscar" showBack onBack={() => history.back()}>
  <div class="content">
    <div class="search-bar">
      <Icon name="search" size={18} style="color: var(--text-3); flex-shrink: 0" />
      <input type="text" placeholder="Buscar usuarios, posts..." value={query} oninput={onInput} autofocus />
      {#if query}
        <button class="clear-btn" onclick={() => { query = ''; users = []; posts = []; }}>
          <Icon name="x" size={16} />
        </button>
      {/if}
    </div>

    {#if loading}
      <div class="loading"><div class="spinner" /></div>
    {:else if query.length >= 2}
      {#if users.length > 0}
        <div class="section">
          <h3 class="section-title">Usuarios</h3>
          {#each users as u}
            <div class="user-row" onclick={() => goto('/contact?id=' + u.id)}>
              <img src={avatarUrl(u.id)} alt="" class="user-avatar" />
              <div class="user-info">
                <span class="user-name">{u.display_name || u.username}</span>
                <span class="user-handle">@{u.username}</span>
              </div>
              <Icon name="chevron-right" size={16} style="color: var(--text-3)" />
            </div>
          {/each}
        </div>
      {/if}

      {#if posts.length > 0}
        <div class="section">
          <h3 class="section-title">Posts</h3>
          {#each posts as p}
            <div class="post-row" onclick={() => goto('/feed')}>
              <img src={avatarUrl(p.user_id)} alt="" class="post-avatar" />
              <div class="post-info">
                <div class="post-top">
                  <span class="post-name">{p.display_name || 'Usuario'}</span>
                  <span class="post-time">{new Date(p.created_at).toLocaleDateString()}</span>
                </div>
                <p class="post-text">{p.text}</p>
              </div>
            </div>
          {/each}
        </div>
      {/if}

      {#if users.length === 0 && posts.length === 0 && !loading}
        <div class="empty">
          <Icon name="search" size={40} strokeWidth={1.5} style="color: var(--text-3)" />
          <p>Sin resultados para "{query}"</p>
        </div>
      {/if}
    {:else if query.length > 0 && query.length < 2}
      <div class="empty">
        <p>Escribe al menos 2 caracteres</p>
      </div>
    {:else}
      <div class="empty">
        <Icon name="search" size={48} strokeWidth={1.5} style="color: var(--text-3)" />
        <p>Busca usuarios y contenido</p>
      </div>
    {/if}
  </div>
</HeaderLayout>

<style>
  .content { flex: 1; overflow-y: auto; padding: 12px 16px; }
  .search-bar {
    display: flex; align-items: center; gap: 10px;
    padding: 12px 14px; background: var(--bg-3); border-radius: 12px;
    margin-bottom: 16px;
  }
  .search-bar input {
    flex: 1; background: none; border: none; outline: none;
    color: var(--text); font-size: 15px;
  }
  .search-bar input::placeholder { color: var(--text-3); }
  .clear-btn {
    background: none; border: none; color: var(--text-3);
    cursor: pointer; padding: 4px; display: flex;
  }
  .section { margin-bottom: 20px; }
  .section-title {
    font-size: 14px; font-weight: 700; color: var(--text-2);
    text-transform: uppercase; letter-spacing: 0.5px;
    margin-bottom: 8px; padding: 0 4px;
  }
  .user-row {
    display: flex; align-items: center; gap: 12px;
    padding: 10px 8px; cursor: pointer; border-radius: 10px;
    transition: background 0.15s;
  }
  .user-row:hover { background: var(--bg-2); }
  .user-avatar { width: 44px; height: 44px; border-radius: 50%; object-fit: cover; }
  .user-info { flex: 1; min-width: 0; }
  .user-name { display: block; font-size: 15px; font-weight: 600; color: var(--text); }
  .user-handle { display: block; font-size: 13px; color: var(--text-3); }
  .post-row {
    display: flex; gap: 10px; padding: 10px 8px;
    cursor: pointer; border-radius: 10px;
    transition: background 0.15s; border-bottom: 1px solid var(--border-2);
  }
  .post-row:hover { background: var(--bg-2); }
  .post-avatar { width: 36px; height: 36px; border-radius: 50%; object-fit: cover; margin-top: 2px; }
  .post-info { flex: 1; min-width: 0; }
  .post-top { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
  .post-name { font-size: 13px; font-weight: 600; color: var(--text); }
  .post-time { font-size: 11px; color: var(--text-3); }
  .post-text {
    font-size: 14px; color: var(--text-2); line-height: 1.4;
    overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
  }
  .empty {
    display: flex; flex-direction: column; align-items: center;
    gap: 12px; padding: 64px 24px; color: var(--text-3);
  }
  .empty p { font-size: 14px; text-align: center; }
  .loading { display: flex; justify-content: center; padding: 40px; }
  .spinner {
    width: 24px; height: 24px; border: 3px solid var(--border);
    border-top-color: var(--accent); border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
</style>
