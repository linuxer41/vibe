<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { avatarUrl, loadTasks } from '$lib/helpers';
  import { user, socket, activeChat, tasks, showToast } from '$lib/stores';
  import type { User, GroupTask } from '$lib/types';
  import Page from '$lib/components/Page.svelte';
  import Header from '$lib/components/Header.svelte';

  let usr: User | null = $state(null);
  let sk: any = $state(null);
  let ac: any = $state(null);
  let taskList: GroupTask[] = $state([]);
  let newTaskTitle = $state('');

  user.subscribe((v) => usr = v);
  socket.subscribe((v) => sk = v);
  activeChat.subscribe((v) => ac = v);
  tasks.subscribe((v) => taskList = v);

  onMount(() => {
    loadTasks();
    sk?.on('new_task', () => loadTasks());
  });

  function createTask() {
    const title = newTaskTitle.trim();
    if (!title) return;
    if (!ac) return showToast('Selecciona un chat primero');
    sk?.emit('create_task', { chatId: ac.id, title }, (res: any) => {
      if (res?.ok) {
        newTaskTitle = '';
        loadTasks();
        showToast('Tarea creada');
      }
    });
  }

  function toggleTask(task: GroupTask) {
    sk?.emit('complete_task', { taskId: task.id }, (res: any) => {
      if (res?.ok) {
        loadTasks();
      }
    });
  }

  function deleteTask(taskId: number) {
    sk?.emit('delete_task', { taskId }, (res: any) => {
      if (res?.ok) {
        loadTasks();
        showToast('Tarea eliminada');
      }
    });
  }

  function selectChat() {
    goto('/');
  }
</script>

<Page>
  <Header title="Tareas" onback={() => goto('/profile')} />

  <div class="tasks-page">
    {#if !ac}
      <div class="empty-state">
        <p>Selecciona un chat para ver sus tareas</p>
        <button class="btn-primary" onclick={selectChat}>Ir a chats</button>
      </div>
    {:else}
      <div class="task-chat-info">
        <img src={avatarUrl(ac.id)} alt="" class="task-chat-avatar" />
        <span class="task-chat-name">{ac.name}</span>
      </div>

      <div class="task-input-row">
        <input
          type="text"
          class="task-input"
          placeholder="Nueva tarea..."
          bind:value={newTaskTitle}
          onkeydown={(e) => { if (e.key === 'Enter') createTask(); }}
        />
        <button class="btn-add" onclick={createTask} disabled={!newTaskTitle.trim()}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
        </button>
      </div>

      <div class="task-list">
        {#each taskList as task (task.id)}
          <div class="task-item" class:completed={task.completed}>
            <button class="task-checkbox" onclick={() => toggleTask(task)}>
              {#if task.completed}
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/></svg>
              {:else}
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/></svg>
              {/if}
            </button>
            <span class="task-title">{task.title}</span>
            <div class="task-meta">
              {#if task.creator_name}
                <span class="task-creator">{task.creator_name}</span>
              {/if}
            </div>
            <button class="task-delete" onclick={() => deleteTask(task.id)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" stroke-width="2" stroke-linecap="round"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        {/each}
        {#if taskList.length === 0}
          <div class="empty-state">
            <p>No hay tareas en este chat</p>
          </div>
        {/if}
      </div>
    {/if}
  </div>
</Page>

<style>
  .tasks-page { flex: 1; overflow-y: auto; display: flex; flex-direction: column; padding: 12px; }
  .task-chat-info { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; }
  .task-chat-avatar { width: 36px; height: 36px; border-radius: 50%; object-fit: cover; }
  .task-chat-name { font-size: 15px; font-weight: 600; color: var(--text); }
  .task-input-row { display: flex; gap: 8px; margin-bottom: 16px; }
  .task-input { flex: 1; padding: 14px 16px; border: 2px solid rgba(255,255,255,0.08); border-radius: 12px; font-size: 15px; outline: none; background: var(--bg-3); color: var(--text); box-sizing: border-box; transition: border-color 0.2s; }
  .task-input:focus { border-color: var(--accent); }
  .task-input::placeholder { color: var(--text-3); }
  .btn-add { width: 48px; height: 48px; border-radius: 12px; background: var(--accent); color: #000; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: opacity 0.2s; }
  .btn-add:disabled { opacity: 0.4; cursor: default; }
  .task-list { display: flex; flex-direction: column; gap: 4px; }
  .task-item { display: flex; align-items: center; gap: 10px; padding: 12px 14px; background: var(--bg-2); border-radius: 12px; transition: background 0.15s; }
  .task-item.completed { opacity: 0.6; }
  .task-checkbox { background: none; border: none; cursor: pointer; padding: 2px; display: flex; flex-shrink: 0; }
  .task-title { flex: 1; font-size: 14px; color: var(--text); font-weight: 500; }
  .task-item.completed .task-title { text-decoration: line-through; color: var(--text-3); }
  .task-meta { display: flex; flex-direction: column; gap: 2px; flex-shrink: 0; }
  .task-creator { font-size: 10px; color: var(--text-3); white-space: nowrap; }
  .task-delete { background: none; border: none; cursor: pointer; padding: 6px; display: flex; flex-shrink: 0; border-radius: 8px; transition: background 0.15s; }
  .task-delete:hover { background: rgba(239,68,68,0.1); }
  .empty-state { display: flex; flex-direction: column; align-items: center; padding: 48px 24px; gap: 16px; }
  .empty-state p { color: var(--text-3); font-size: 14px; }
  .btn-primary { padding: 12px 24px; background: var(--accent); color: #000; border: none; border-radius: 12px; font-size: 14px; font-weight: 600; cursor: pointer; }
</style>
