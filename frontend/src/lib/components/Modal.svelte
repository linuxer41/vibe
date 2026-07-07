<script lang="ts">
  import type { Snippet } from 'svelte';
  import Icon from '$lib/icon/Icon.svelte';

  interface Action {
    label: string;
    variant?: 'primary' | 'danger' | 'ghost';
    onClick: () => void;
    disabled?: boolean;
  }

  let {
    show,
    onclose,
    title,
    description,
    actions,
    size = 'md',
    children,
  }: {
    show: boolean;
    onclose: () => void;
    title?: string;
    description?: string;
    actions?: Action[];
    size?: 'sm' | 'md' | 'lg';
    children?: Snippet;
  } = $props();
</script>

{#if show}
  <div class="modal-overlay" onclick={(e) => { if ((e.target as HTMLElement).classList.contains('modal-overlay')) onclose(); }}>
    <div class="modal-content" class:modal-sm={size === 'sm'} class:modal-lg={size === 'lg'} onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <div>
          {#if title}
            <h3 class="modal-title">{title}</h3>
          {/if}
          {#if description}
            <p class="modal-desc">{description}</p>
          {/if}
        </div>
        <button class="modal-close" onclick={onclose}>
          <Icon name="x" size={20} />
        </button>
      </div>
      {#if children}
        <div class="modal-body">
          {@render children()}
        </div>
      {/if}
      {#if actions && actions.length > 0}
        <div class="modal-footer">
          {#each actions as action}
            <button
              class="modal-action"
              class:modal-action-primary={action.variant === 'primary'}
              class:modal-action-danger={action.variant === 'danger'}
              class:modal-action-ghost={action.variant === 'ghost' || !action.variant}
              onclick={action.onClick}
              disabled={action.disabled}
            >{action.label}</button>
          {/each}
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .modal-overlay {
    position: fixed; inset: 0; background: rgba(0,0,0,0.7);
    display: flex; align-items: center; justify-content: center;
    z-index: 200; animation: fadeIn 0.2s ease-out; padding: 24px;
  }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  .modal-content {
    background: var(--bg-2); border-radius: 16px;
    width: 100%; max-width: 400px; max-height: 80dvh;
    display: flex; flex-direction: column;
    box-shadow: 0 8px 40px var(--shadow);
    animation: scaleIn 0.2s ease-out;
  }
  .modal-sm { max-width: 320px; }
  .modal-lg { max-width: 520px; }
  @keyframes scaleIn { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
  .modal-header {
    display: flex; align-items: flex-start; justify-content: space-between;
    padding: 20px 20px 0; gap: 12px;
  }
  .modal-title {
    font-size: 17px; font-weight: 600; color: var(--text);
    margin-bottom: 4px;
  }
  .modal-desc {
    font-size: 13px; color: var(--text-2); line-height: 1.5;
  }
  .modal-close {
    background: var(--bg-3); border: none; color: var(--text-2);
    cursor: pointer; padding: 6px; border-radius: 50%; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    transition: background 0.2s;
  }
  .modal-close:hover { background: var(--border); }
  .modal-body {
    flex: 1; overflow-y: auto; padding: 16px 20px 20px;
  }
  .modal-footer {
    display: flex; gap: 8px; padding: 0 20px 20px;
    flex-wrap: wrap;
  }
  .modal-action {
    flex: 1; padding: 12px 16px; border-radius: 10px;
    font-size: 14px; font-weight: 600; border: none;
    cursor: pointer; transition: background 0.2s, transform 0.15s;
    text-align: center; min-width: 80px;
  }
  .modal-action:active { transform: scale(0.97); }
  .modal-action:disabled { opacity: 0.5; cursor: default; transform: none; }
  .modal-action-primary { background: var(--accent); color: #000; }
  .modal-action-primary:hover { background: var(--accent-hover); }
  .modal-action-danger { background: var(--danger); color: #fff; }
  .modal-action-danger:hover { background: #dc2626; }
  .modal-action-ghost { background: var(--bg-3); color: var(--text); }
  .modal-action-ghost:hover { background: var(--border); }
</style>
