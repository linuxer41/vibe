<script lang="ts">
  import Icon from '$lib/icon/Icon.svelte';
  import { formatDate } from '$lib/helpers';
  import type { FocusSession } from '$lib/types';

  let {
    focus,
    focusMode,
    onfocusmodechange,
    onstartfocus,
    onendfocus
  }: {
    focus: FocusSession | null;
    focusMode: string;
    onfocusmodechange: (mode: 'focus' | 'work' | 'sleep') => void;
    onstartfocus: () => void;
    onendfocus: () => void;
  } = $props();
</script>

<div class="section-title">Enfoque</div>
<div class="focus-card">
  {#if focus?.active}
    <div class="focus-active">
      <div class="focus-icon">
        <Icon name="clock" size={32} style="color: var(--accent)" />
      </div>
      <p class="focus-mode-text">Modo {focus.mode} activo</p>
      <p class="focus-since">Desde {formatDate(focus.started_at)}</p>
      <button class="modal-btn danger" onclick={onendfocus}>Finalizar sesión</button>
    </div>
  {:else}
    <div class="focus-select">
      <h3>Modo de enfoque</h3>
      <div class="focus-options">
        <button class="focus-opt" class:active={focusMode === 'focus'} onclick={() => onfocusmodechange('focus')}>
          <Icon name="sun" size={20} />
          <span>Focus</span>
          <small>Solo mensajes urgentes</small>
        </button>
        <button class="focus-opt" class:active={focusMode === 'work'} onclick={() => onfocusmodechange('work')}>
          <Icon name="users" size={20} />
          <span>Trabajo</span>
          <small>Oculta feed/live</small>
        </button>
        <button class="focus-opt" class:active={focusMode === 'sleep'} onclick={() => onfocusmodechange('sleep')}>
          <Icon name="moon" size={20} />
          <span>Dormir</span>
          <small>Silencio total</small>
        </button>
      </div>
      <button class="modal-btn" onclick={onstartfocus}>Activar modo {focusMode}</button>
    </div>
  {/if}
</div>

<style>
  .section-title {
    font-size: 13px; font-weight: 600; color: var(--text-3);
    text-transform: uppercase; letter-spacing: 0.8px;
    padding: 24px 20px 8px;
  }
  .focus-card { margin: 0 12px 4px; padding: 16px; background: var(--bg-2); border-radius: 16px; }
  .focus-active { text-align: center; }
  .focus-icon { margin-bottom: 8px; }
  .focus-mode-text { font-size: 18px; font-weight: 700; color: var(--text); text-transform: capitalize; }
  .focus-since { font-size: 12px; color: var(--text-3); margin-bottom: 16px; }
  .modal-btn { width: 100%; padding: 13px; background: var(--accent); color: #000; font-weight: 700; border: none; border-radius: 12px; font-size: 15px; cursor: pointer; }
  .modal-btn.danger { background: var(--danger); color: #fff; }
  .focus-select h3 { font-size: 16px; font-weight: 600; color: var(--text); margin: 0 0 12px; }
  .focus-options { display: flex; gap: 8px; margin-bottom: 16px; }
  .focus-opt { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 12px 8px; background: var(--bg-3); border: 2px solid transparent; border-radius: 12px; cursor: pointer; transition: all 0.2s; text-align: center; }
  .focus-opt.active { border-color: var(--accent); background: rgba(var(--accent-rgb),0.1); }
  .focus-opt span { font-size: 12px; font-weight: 600; color: var(--text); }
  .focus-opt small { font-size: 9px; color: var(--text-3); }
</style>
