<script lang="ts">
  let {
    show = false,
    onclose = () => {},
    oncreate = (_name: string, _desc: string) => {}
  }: {
    show?: boolean;
    onclose?: () => void;
    oncreate?: (name: string, description: string) => void;
  } = $props();

  let name = $state('');
  let description = $state('');

  function handleCreate() {
    if (!name) return;
    oncreate(name, description);
    name = '';
    description = '';
  }

  function handleClose() {
    name = '';
    description = '';
    onclose();
  }
</script>

{#if show}
  <div class="modal-overlay" onclick={handleClose} role="presentation">
    <div class="modal-content" onclick={(e) => e.stopPropagation()} role="dialog">
      <h3 class="modal-title">Crear comunidad</h3>
      <input type="text" bind:value={name} placeholder="Nombre de la comunidad" class="modal-input" />
      <input type="text" bind:value={description} placeholder="Descripción" class="modal-input" />
      <div class="modal-actions">
        <button class="modal-btn cancel" onclick={handleClose}>Cancelar</button>
        <button class="modal-btn primary" onclick={handleCreate} disabled={!name}>Crear</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 100; padding: 24px; }
  .modal-content { width: 100%; max-width: 360px; background: var(--bg-2); border-radius: 16px; padding: 24px; }
  .modal-title { font-size: 18px; font-weight: 700; color: var(--text); margin: 0 0 16px; }
  .modal-input { width: 100%; padding: 14px 16px; border: 2px solid var(--border); border-radius: 12px; font-size: 15px; outline: none; background: var(--bg-3); color: var(--text); margin-bottom: 12px; box-sizing: border-box; transition: border-color 0.2s; }
  .modal-input:focus { border-color: var(--accent); }
  .modal-input::placeholder { color: var(--text-3); }
  .modal-actions { display: flex; gap: 8px; margin-top: 4px; }
  .modal-btn { flex: 1; padding: 12px; border: none; border-radius: 12px; font-size: 15px; font-weight: 700; cursor: pointer; transition: opacity 0.15s; }
  .modal-btn:disabled { opacity: 0.4; cursor: default; }
  .modal-btn.primary { background: var(--accent); color: #000; }
  .modal-btn.cancel { background: var(--bg-3); color: var(--text-2); }
</style>
