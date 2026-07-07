<script lang="ts">
  import { goto } from '$app/navigation';
  import Icon from '$lib/icon/Icon.svelte';
  import { avatarUrl } from '$lib/helpers';
  import { socket, contacts, searchQuery, searchResults, showNewChat } from '$lib/stores';
  import type { User } from '$lib/types';

  let sk: any = $state(null);
  socket.subscribe((v) => sk = v);

  function search() {
    const q = $state.snapshot(searchQuery) as string;
    if (q.length < 2) { searchResults.set([]); return; }
    sk?.emit('search_users', { query: q }, (res: User[]) => searchResults.set(res));
  }

  function addContact(contactId: number) {
    sk?.emit('add_contact', { contactId }, () => {});
  }
</script>

<div class="contacts-view">
  <div class="search-bar">
    <Icon name="search" size={16} />
    <input type="text" bind:value={$searchQuery} placeholder="Buscar" oninput={(e) => { searchQuery.set((e.target as HTMLInputElement).value); search(); }} />
  </div>
  {#if $searchQuery.length >= 2 && $searchResults.length > 0}
    <div class="alpha-header">Resultados</div>
    {#each $searchResults as r}
      <div class="chat-item">
        <img src={avatarUrl(r.id)} alt="" class="contact-avatar" />
        <div class="chat-info">
          <span class="chat-name">{r.display_name}</span>
          <span class="chat-preview">@{r.username}</span>
        </div>
        <button class="small-btn" onclick={() => addContact(r.id)}>Agregar</button>
      </div>
    {/each}
  {:else}
    {#each $contacts as c}
      <div class="chat-item" onclick={() => goto(`/contact?id=${c.id}`, { noScroll: true })}>
        <div class="chat-avatar-wrap">
          <img src={avatarUrl(c.id)} alt="" class="contact-avatar" />
          <div class="status-indicator" class:online={c.online}></div>
        </div>
        <div class="chat-info">
          <span class="chat-name">{c.display_name}</span>
          <span class="chat-preview">{c.online ? 'En línea' : 'Desconectado'}</span>
        </div>
      </div>
    {/each}
    {#if $contacts.length === 0}
      <div class="empty-state">
        <Icon name="user" size={48} />
        <p>No hay contactos</p>
      </div>
    {/if}
  {/if}
</div>

<style>
  .contacts-view { flex: 1; overflow-y: auto; }
  .search-bar {
    display: flex; align-items: center; gap: 8px;
    padding: 10px 16px; margin: 8px 12px;
    background: var(--bg-3); border-radius: 10px; color: var(--text-3);
  }
  .search-bar input { flex: 1; background: none; border: none; outline: none; color: var(--text); font-size: 15px; }
  .search-bar input::placeholder { color: var(--text-3); }
  .alpha-header { padding: 8px 16px; font-size: 12px; color: var(--accent); font-weight: 600; background: var(--bg); border-bottom: 1px solid var(--border-2); }
  .chat-item {
    display: flex; align-items: center; gap: 12px;
    padding: 12px 16px; cursor: pointer;
    transition: background 0.15s; border-bottom: 1px solid var(--border-2);
  }
  .chat-item:hover { background: var(--bg-2); }
  .chat-avatar-wrap { position: relative; flex-shrink: 0; }
  .contact-avatar { width: 48px; height: 48px; border-radius: 50%; object-fit: cover; }
  .status-indicator {
    position: absolute; bottom: 1px; right: 1px;
    width: 12px; height: 12px; border-radius: 50%;
    background: var(--text-3); border: 2px solid var(--bg);
  }
  .status-indicator.online { background: var(--accent); }
  .chat-info { flex: 1; min-width: 0; }
  .chat-name { font-size: 15px; font-weight: 600; color: var(--text); }
  .chat-preview { font-size: 13px; color: var(--text-2); }
  .small-btn {
    padding: 6px 14px; background: var(--accent); color: #000; font-weight: 600;
    border: none; border-radius: 8px; font-size: 12px; cursor: pointer;
    white-space: nowrap; flex-shrink: 0;
  }
  .small-btn:hover { background: var(--accent-hover); }
  .empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 64px 24px; gap: 12px; color: var(--text-3); }
  .empty-state p { color: var(--text-3); font-size: 14px; }
</style>
