<script lang="ts">
  import { emit } from '$lib/socket';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { avatarUrl, loadTasks } from '$lib/helpers';
  import { user, socket, activeChat, tasks, showToast } from '$lib/stores';
  import type { User, GroupTask } from '$lib/types';
  import HeaderLayout from '$lib/layouts/HeaderLayout.svelte';
  import Icon from '$lib/icon/Icon.svelte';

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

  async function createTask() {
    const title = newTaskTitle.trim();
    if (!title) return;
    if (!ac) return showToast('Selecciona un chat primero');
    try {
      const res = await emit('create_task', { chatId: ac.id, title });
      if (res?.ok) {
        newTaskTitle = '';
        loadTasks();
        showToast('Tarea creada');
      }
    } catch {}
  }

  async function toggleTask(task: GroupTask) {
    try {
      const res = await emit('complete_task', { taskId: task.id });
      if (res?.ok) {
        loadTasks();
      }
    } catch {}
  }

  async function deleteTask(taskId: number) {
    try {
      const res = await emit('delete_task', { taskId });
      if (res?.ok) {
        loadTasks();
        showToast('Tarea eliminada');
      }
    } catch {}
  }

  function selectChat() {
    goto('/');
  }
</script>

<HeaderLayout title="Tareas" showBack onBack={() => goto('/profile')}>

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
          <Icon name="plus" size={20} strokeWidth={2.5} />
        </button>
      </div>

      <div class="task-list">
        {#each taskList as task (task.id)}
          <div class="task-item" class:completed={task.completed}>
            <button class="task-checkbox" onclick={() => toggleTask(task)}>
              {#if task.completed}
                <Icon name="check" size={22} strokeWidth={2.5} style="color: var(--accent)" />
              {:else}
                <Icon name="radio-off" size={22} strokeWidth={2} style="color: var(--text-3)" />
              {/if}
            </button>
            <span class="task-title">{task.title}</span>
            <div class="task-meta">
              {#if task.creator_name}
                <span class="task-creator">{task.creator_name}</span>
              {/if}
            </div>
            <button class="task-delete" onclick={() => deleteTask(task.id)}>
              <Icon name="trash" size={16} style="color: var(--danger)" />
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
</HeaderLayout>

<style>
  .tasks-page { flex: 1; overflow-y: auto; display: flex; flex-direction: column; padding: 12px; }
  .task-chat-info { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; }
  .task-chat-avatar { width: 36px; height: 36px; border-radius: 50%; object-fit: cover; }
  .task-chat-name { font-size: 15px; font-weight: 600; color: var(--text); }
  .task-input-row { display: flex; gap: 8px; margin-bottom: 16px; }
  .task-input { flex: 1; padding: 14px 16px; border: 2px solid var(--border); border-radius: 12px; font-size: 15px; outline: none; background: var(--bg-3); color: var(--text); box-sizing: border-box; transition: border-color 0.2s; }
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
