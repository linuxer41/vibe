<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import Icon from '$lib/icon/Icon.svelte';
  import { avatarUrl } from '$lib/helpers';
  import { user, socket, contacts, showToast } from '$lib/stores';
  import type { User, SharedNote } from '$lib/types';
  import Page from '$lib/components/Page.svelte';
  import Header from '$lib/components/Header.svelte';

  let usr: User | null = $state(null);
  let sk: any = $state(null);
  let searchQuery = $state('');
  let searchResults: User[] = $state([]);
  let targetUser: User | null = $state(null);
  let noteContent = $state('');
  let note: SharedNote | null = $state(null);
  let loading = $state(false);

  user.subscribe((v) => usr = v);
  socket.subscribe((v) => sk = v);

  onMount(() => {
    loadContacts();
    sk?.on('note_updated', (data: any) => {
      if (data?.targetUserId === usr?.id && targetUser) {
        noteContent = data.content || '';
      }
    });
  });

  function loadContacts() {
    sk?.emit('get_contacts', (list: User[]) => searchResults = list || []);
  }

  function searchUsers() {
    if (searchQuery.length < 2) {
      loadContacts();
      return;
    }
    sk?.emit('search_users', { query: searchQuery }, (res: User[]) => searchResults = res || []);
  }

  function selectUser(u: User) {
    targetUser = u;
    searchQuery = '';
    loadNote(u.id);
  }

  function loadNote(targetUserId: number) {
    loading = true;
    sk?.emit('get_note', { targetUserId }, (res: any) => {
      if (res?.note) {
        note = res.note;
        noteContent = res.note.content || '';
      } else {
        note = null;
        noteContent = '';
      }
      loading = false;
    });
  }

  function saveNote() {
    if (!targetUser) return;
    sk?.emit('save_note', { targetUserId: targetUser.id, content: noteContent }, (res: any) => {
      if (res?.ok) {
        note = { ...(note || { id: 0, chat_id: 0, title: '', content: noteContent, updated_by: usr?.id || 0, updated_at: new Date().toISOString() }), content: noteContent };
      }
    });
  }

  function clearSelection() {
    targetUser = null;
    note = null;
    noteContent = '';
  }
</script>

<Page>
  <Header title="Notas Compartidas" onback={() => goto('/profile')} />

  <div class="notes-page">
    {#if !targetUser}
      <div class="search-section">
        <div class="search-bar">
          <Icon name="search" size={16} />
          <input type="text" placeholder="Buscar usuario..." bind:value={searchQuery} oninput={searchUsers} />
        </div>
        <div class="user-list">
          {#each searchResults as c (c.id)}
            <button class="user-item" onclick={() => selectUser(c)}>
              <img src={avatarUrl(c.id)} alt="" class="user-avatar" />
              <div class="user-info">
                <span class="user-name">{c.display_name}</span>
                <span class="user-phone">{c.phone}</span>
              </div>
            </button>
          {/each}
          {#if searchResults.length === 0}
            <div class="empty-state">
              <p>No se encontraron usuarios</p>
            </div>
          {/if}
        </div>
      </div>
    {:else}
      <div class="note-editor">
        <div class="note-header">
          <button class="back-link" onclick={clearSelection} style="color: var(--accent)">
            <Icon name="chevron-left" size={20} />
          </button>
          <div class="note-partner">
            <img src={avatarUrl(targetUser.id)} alt="" class="note-avatar" />
            <span class="note-partner-name">{targetUser.display_name}</span>
          </div>
          {#if note?.updated_at}
            <span class="note-time">Actualizado {new Date(note.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          {/if}
        </div>
        {#if loading}
          <div class="loading-state"><p>Cargando nota...</p></div>
        {:else}
          <textarea
            class="note-textarea"
            placeholder="Escribe aquí la nota compartida..."
            bind:value={noteContent}
            oninput={saveNote}
          ></textarea>
          <p class="note-hint">Los cambios se guardan automáticamente</p>
        {/if}
      </div>
    {/if}
  </div>
</Page>

<style>
  .notes-page { flex: 1; overflow-y: auto; display: flex; flex-direction: column; }
  .search-section { padding: 12px; }
  .search-bar { display: flex; align-items: center; gap: 8px; padding: 10px 14px; background: var(--bg-3); border-radius: 12px; margin-bottom: 16px; color: var(--text-3); }
  .search-bar input { flex: 1; background: none; border: none; outline: none; color: var(--text); font-size: 14px; }
  .search-bar input::placeholder { color: var(--text-3); }
  .user-list { display: flex; flex-direction: column; gap: 4px; }
  .user-item { display: flex; align-items: center; gap: 12px; padding: 12px; background: var(--bg-2); border: none; border-radius: 12px; cursor: pointer; width: 100%; text-align: left; transition: background 0.15s; }
  .user-item:hover { background: var(--border); }
  .user-avatar { width: 44px; height: 44px; border-radius: 50%; object-fit: cover; }
  .user-info { flex: 1; }
  .user-name { display: block; font-size: 14px; font-weight: 600; color: var(--text); }
  .user-phone { display: block; font-size: 12px; color: var(--text-3); margin-top: 1px; }
  .empty-state { display: flex; flex-direction: column; align-items: center; padding: 48px 24px; }
  .empty-state p { color: var(--text-3); font-size: 14px; }
  .note-editor { flex: 1; display: flex; flex-direction: column; padding: 12px; }
  .note-header { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
  .back-link { background: none; border: none; cursor: pointer; padding: 4px; display: flex; }
  .note-partner { display: flex; align-items: center; gap: 10px; flex: 1; }
  .note-avatar { width: 36px; height: 36px; border-radius: 50%; object-fit: cover; }
  .note-partner-name { font-size: 16px; font-weight: 600; color: var(--text); }
  .note-time { font-size: 11px; color: var(--text-3); white-space: nowrap; }
  .note-textarea { flex: 1; min-height: 200px; padding: 16px; background: var(--bg-2); border: 2px solid rgba(255,255,255,0.08); border-radius: 16px; font-size: 15px; color: var(--text); outline: none; resize: none; font-family: inherit; line-height: 1.6; transition: border-color 0.2s; }
  .note-textarea:focus { border-color: var(--accent); }
  .note-textarea::placeholder { color: var(--text-3); }
  .note-hint { text-align: center; font-size: 11px; color: var(--text-3); margin-top: 12px; }
  .loading-state { flex: 1; display: flex; align-items: center; justify-content: center; }
  .loading-state p { color: var(--text-3); font-size: 14px; }
</style>
