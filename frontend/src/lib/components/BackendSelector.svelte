<script lang="ts">
  let { onclose, onchange }: { onclose?: () => void; onchange?: () => void } = $props();

  const PRESETS = [
    { label: 'Node.js', url: 'http://localhost:3000' },
    { label: 'Rust', url: 'http://localhost:3001' },
  ];

  interface CustomServer {
    label: string;
    url: string;
  }

  function getCustomServers(): CustomServer[] {
    try {
      const data = localStorage.getItem('wa_backend_custom');
      return data ? JSON.parse(data) : [];
    } catch { return []; }
  }

  function saveCustomServers(list: CustomServer[]) {
    localStorage.setItem('wa_backend_custom', JSON.stringify(list));
  }

  function getActiveLabel(): string {
    const label = localStorage.getItem('wa_backend_label');
    if (label) return label;
    const ls = localStorage.getItem('wa_backend');
    if (ls === 'node' || !ls) return 'Node.js';
    if (ls === 'rust') return 'Rust';
    return 'Custom';
  }

  function getActiveUrl(): string {
    const ls = localStorage.getItem('wa_backend');
    if (ls === 'node') return 'http://localhost:3000';
    if (ls === 'rust') return 'http://localhost:3001';
    if (ls && ls.startsWith('http')) return ls;
    return 'http://localhost:3000';
  }

  let activeLabel = $state(getActiveLabel());
  let activeUrl = $state(getActiveUrl());
  let customServers = $state(getCustomServers());
  let newLabel = $state('');
  let newUrl = $state('');
  let editingIndex = $state(-1);
  let editLabel = $state('');
  let editUrl = $state('');
  let showInput = $state(false);

  function setActive(url: string, label: string) {
    localStorage.setItem('wa_backend', url);
    localStorage.setItem('wa_backend_label', label);
    activeUrl = url;
    activeLabel = label;
    onchange?.();
  }

  function selectPreset(url: string, label: string) {
    setActive(url, label);
  }

  function selectCustom(server: CustomServer) {
    setActive(server.url, server.label);
  }

  function addCustom() {
    const label = newLabel.trim() || newUrl.trim();
    let url = newUrl.trim();
    if (!url) return;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'http://' + url;
    }
    if (customServers.some(s => s.url === url)) return;
    const server: CustomServer = { label, url };
    customServers = [...customServers, server];
    saveCustomServers(customServers);
    setActive(url, label);
    newLabel = '';
    newUrl = '';
    showInput = false;
  }

  function removeCustom(server: CustomServer) {
    customServers = customServers.filter(s => s.url !== server.url);
    saveCustomServers(customServers);
    if (activeUrl === server.url) {
      setActive('http://localhost:3000', 'Node.js');
    }
  }

  function startEdit(index: number) {
    editingIndex = index;
    editLabel = customServers[index].label;
    editUrl = customServers[index].url;
  }

  function saveEdit(index: number) {
    const label = editLabel.trim() || editUrl.trim();
    let url = editUrl.trim();
    if (!url) return;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'http://' + url;
    }
    const list = [...customServers];
    const wasActive = activeUrl === list[index].url;
    list[index] = { label, url };
    customServers = list;
    saveCustomServers(list);
    if (wasActive) setActive(url, label);
    editingIndex = -1;
    editLabel = '';
    editUrl = '';
  }
</script>

<div class="bs-current">
  <span class="bs-current-label">Servidor activo</span>
  <span class="bs-current-url">{activeLabel}</span>
  <span class="bs-current-sub">{activeUrl}</span>
</div>

<div class="bs-section">
  <span class="bs-section-title">Predefinidos</span>
  <div class="bs-presets">
    {#each PRESETS as preset}
      <button
        class="bs-preset-btn"
        class:active={activeUrl === preset.url}
        onclick={() => selectPreset(preset.url, preset.label)}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/><path d="M6 6h.01M6 18h.01"/></svg>
        <span>{preset.label}</span>
        <span class="bs-url-hint">{preset.url}</span>
      </button>
    {/each}
  </div>
</div>

<div class="bs-section">
  <div class="bs-section-row">
    <span class="bs-section-title">Servidores personalizados</span>
    <button class="bs-add-btn" onclick={() => showInput = !showInput}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      {showInput ? 'Cancelar' : 'Añadir'}
    </button>
  </div>

  {#if showInput}
    <div class="bs-add-form">
      <input type="text" bind:value={newLabel} placeholder="Nombre (ej: Mi Servidor)" class="bs-input" />
      <div class="bs-add-row">
        <input type="text" bind:value={newUrl} placeholder="http://192.168.1.100:3000" class="bs-input" onkeydown={(e) => e.key === 'Enter' && addCustom()} />
        <button class="bs-confirm-btn" onclick={addCustom} disabled={!newUrl.trim()}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
        </button>
      </div>
    </div>
  {/if}

  {#if customServers.length > 0}
    <div class="bs-custom-list">
      {#each customServers as server, i}
        <div class="bs-custom-item" class:active={activeUrl === server.url}>
          {#if editingIndex === i}
            <div class="bs-edit-form">
              <input type="text" bind:value={editLabel} placeholder="Nombre" class="bs-input bs-edit-input" />
              <div class="bs-edit-row">
                <input type="text" bind:value={editUrl} placeholder="URL" class="bs-input bs-edit-input" onkeydown={(e) => { if (e.key === 'Enter') saveEdit(i); if (e.key === 'Escape') editingIndex = -1; }} />
                <button class="bs-icon-btn bs-confirm-btn" onclick={() => saveEdit(i)}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                </button>
              </div>
            </div>
          {:else}
            <button class="bs-custom-info" onclick={() => selectCustom(server)}>
              <span class="bs-custom-label">{server.label}</span>
              <span class="bs-custom-url">{server.url}</span>
            </button>
            <button class="bs-icon-btn" onclick={() => startEdit(i)} title="Editar">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="bs-icon-btn bs-delete-btn" onclick={() => removeCustom(server)} title="Eliminar">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          {/if}
        </div>
      {/each}
    </div>
  {:else}
    <p class="bs-empty">Aún no hay servidores personalizados</p>
  {/if}
</div>

<style>
  .bs-current {
    display: flex; flex-direction: column; align-items: center;
    gap: 2px; padding-bottom: 16px; margin-bottom: 16px;
    border-bottom: 1px solid var(--border);
  }
  .bs-current-label {
    font-size: 12px; color: var(--text-3); text-transform: uppercase;
    letter-spacing: 0.5px; font-weight: 600;
  }
  .bs-current-url {
    font-size: 16px; color: var(--accent); font-weight: 700;
    text-align: center;
  }
  .bs-current-sub {
    font-size: 12px; color: var(--text-3); font-family: monospace;
  }
  .bs-section { margin-bottom: 20px; }
  .bs-section-title { font-size: 13px; color: var(--text-3); font-weight: 600; text-transform: uppercase; letter-spacing: 0.4px; }
  .bs-section-row {
    display: flex; align-items: center; justify-content: space-between;
    margin-bottom: 10px;
  }
  .bs-presets { display: flex; flex-direction: column; gap: 8px; margin-top: 10px; }
  .bs-preset-btn {
    display: flex; align-items: center; gap: 10px;
    padding: 12px 14px; border-radius: 12px;
    background: var(--bg-3); border: 2px solid transparent;
    cursor: pointer; transition: all 0.2s; text-align: left;
    color: var(--text);
  }
  .bs-preset-btn:hover { background: var(--bg); border-color: var(--border); }
  .bs-preset-btn.active { border-color: var(--accent); background: rgba(255,213,0,0.08); }
  .bs-url-hint { font-size: 12px; color: var(--text-3); margin-left: auto; }
  .bs-add-btn {
    display: flex; align-items: center; gap: 4px;
    background: none; border: none; color: var(--accent);
    font-size: 13px; font-weight: 600; cursor: pointer;
    padding: 4px 8px; border-radius: 8px; transition: background 0.2s;
  }
  .bs-add-btn:hover { background: var(--bg-3); }
  .bs-add-form { display: flex; flex-direction: column; gap: 8px; margin-top: 8px; }
  .bs-add-row { display: flex; gap: 8px; }
  .bs-input {
    flex: 1; padding: 10px 12px; border: 2px solid var(--border);
    border-radius: 10px; font-size: 14px; outline: none;
    background: var(--bg-3); color: var(--text); font-family: inherit;
  }
  .bs-input:focus { border-color: var(--accent); }
  .bs-confirm-btn {
    padding: 8px 12px; background: var(--accent); color: #000;
    border: none; border-radius: 10px; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    font-weight: 700; transition: opacity 0.2s;
  }
  .bs-confirm-btn:disabled { opacity: 0.5; cursor: default; }
  .bs-custom-list { display: flex; flex-direction: column; gap: 6px; margin-top: 10px; }
  .bs-custom-item {
    display: flex; align-items: center; gap: 6px;
    padding: 8px 10px; border-radius: 10px;
    background: var(--bg-3); border: 2px solid transparent;
    transition: border-color 0.2s;
  }
  .bs-custom-item.active { border-color: var(--accent); }
  .bs-custom-info {
    flex: 1; background: none; border: none; cursor: pointer;
    text-align: left; min-width: 0; padding: 2px 0;
    display: flex; flex-direction: column; gap: 1px;
  }
  .bs-custom-label {
    font-size: 14px; font-weight: 600; color: var(--text);
  }
  .bs-custom-url {
    font-size: 11px; color: var(--text-3); font-family: monospace;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .bs-icon-btn {
    background: none; border: none; color: var(--text-3);
    cursor: pointer; padding: 4px; border-radius: 6px;
    display: flex; align-items: center; justify-content: center;
    transition: all 0.2s; flex-shrink: 0;
  }
  .bs-icon-btn:hover { background: var(--bg); color: var(--text-2); }
  .bs-delete-btn:hover { color: var(--danger); background: rgba(255,59,48,0.1); }
  .bs-edit-form { display: flex; flex-direction: column; gap: 6px; width: 100%; }
  .bs-edit-row { display: flex; gap: 6px; }
  .bs-edit-input { font-size: 13px; }
  .bs-empty { font-size: 13px; color: var(--text-3); text-align: center; padding: 12px 0; }
</style>
