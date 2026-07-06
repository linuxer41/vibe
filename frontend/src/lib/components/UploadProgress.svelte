<script lang="ts">
  let {
    progress = 0,
    status = 'idle',
    fileName = '',
    fileSize = 0,
  }: {
    progress?: number;
    status?: 'idle' | 'preparing' | 'uploading' | 'processing' | 'done' | 'error';
    fileName?: string;
    fileSize?: number;
  } = $props();

  const CHUNK_SIZE = 65536;
  let label = $derived.by(() => {
    switch (status) {
      case 'preparing': return 'Preparando...';
      case 'uploading': return 'Subiendo...';
      case 'processing': return 'Procesando...';
      case 'done': return 'Completado';
      case 'error': return 'Error';
      default: return '';
    }
  });
  let pct = $derived(status === 'uploading' ? Math.round(progress * 100) : status === 'done' ? 100 : status === 'error' ? 0 : null);
</script>

{#if status !== 'idle'}
  <div class="upload-progress">
    <div class="up-row">
      <span class="up-name">{fileName || 'Archivo'}</span>
      {#if fileSize}
        <span class="up-size">{(fileSize / 1024 / 1024).toFixed(1)} MB</span>
      {/if}
    </div>
    <div class="up-bar-track">
      <div class="up-bar-fill" style="width: {pct ?? 0}%" class:up-indeterminate={status === 'preparing' || status === 'processing'} class:up-done={status === 'done'} class:up-error={status === 'error'}></div>
    </div>
    <div class="up-label" class:up-label-error={status === 'error'}>{label}{#if pct !== null} {pct}%{/if}</div>
  </div>
{/if}

<style>
  .upload-progress {
    padding: 12px 16px;
    background: var(--bg-2, #1e1e1e);
    border-radius: 12px;
    margin: 8px 0;
  }
  .up-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }
  .up-name {
    font-size: 13px;
    color: var(--text, #e0e0e0);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 70%;
  }
  .up-size {
    font-size: 11px;
    color: var(--text-2, #888);
  }
  .up-bar-track {
    height: 6px;
    background: var(--bg-3, #333);
    border-radius: 3px;
    overflow: hidden;
  }
  .up-bar-fill {
    height: 100%;
    background: var(--accent, #0a84ff);
    border-radius: 3px;
    transition: width 0.3s ease;
  }
  .up-indeterminate {
    width: 30% !important;
    animation: up-shimmer 1.5s ease-in-out infinite;
  }
  .up-done {
    background: #30d158;
  }
  .up-error {
    background: #ff453a;
    width: 100% !important;
  }
  .up-label {
    font-size: 11px;
    color: var(--text-2, #888);
    margin-top: 4px;
    text-align: right;
  }
  .up-label-error {
    color: #ff453a;
  }
  @keyframes up-shimmer {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(400%); }
  }
</style>
