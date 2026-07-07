<script lang="ts">
  import Icon from '$lib/icon/Icon.svelte';
  let { onclose, onchange }: { onclose?: () => void; onchange?: () => void } = $props();

  const PRESETS = [
    { label: 'Local', url: 'http://localhost:3002' },
  ];

  interface CustomServer {
    label: string;
    url: string;
  }

  function getCustomServers(): CustomServer[] {
    try {
      const data = localStorage.getItem('wa_storage_custom');
      return data ? JSON.parse(data) : [];
    } catch { return []; }
  }

  function saveCustomServers(list: CustomServer[]) {
    localStorage.setItem('wa_storage_custom', JSON.stringify(list));
  }

  function getActiveLabel(): string {
    const label = localStorage.getItem('wa_storage_label');
    if (label) return label;
    return 'Local';
  }

  function getActiveUrl(): string {
    const ls = localStorage.getItem('wa_storage_url');
    return ls && ls.startsWith('http') ? ls : 'http://localhost:3002';
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
    if (url === 'http://localhost:3002') {
      localStorage.removeItem('wa_storage_url');
      localStorage.removeItem('wa_storage_label');
    } else {
      localStorage.setItem('wa_storage_url', url);
      localStorage.setItem('wa_storage_label', label);
    }
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
      setActive('http://localhost:3002', 'Local');
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
        <Icon name="database" size={16} style="color: var(--accent)" />
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
      <Icon name="plus" size={16} />
      {showInput ? 'Cancelar' : 'Añadir'}
    </button>
  </div>

  {#if showInput}
    <div class="bs-add-form">
      <input type="text" bind:value={newLabel} placeholder="Nombre (ej: Mi Storage)" class="bs-input" />
      <div class="bs-add-row">
        <input type="text" bind:value={newUrl} placeholder="http://192.168.1.100:3002" class="bs-input" onkeydown={(e) => e.key === 'Enter' && addCustom()} />
        <button class="bs-confirm-btn" onclick={addCustom} disabled={!newUrl.trim()}>
          <Icon name="check" size={16} strokeWidth={2.5} />
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
                  <Icon name="check" size={15} strokeWidth={2.5} />
                </button>
              </div>
            </div>
          {:else}
            <button class="bs-custom-info" onclick={() => selectCustom(server)}>
              <span class="bs-custom-label">{server.label}</span>
              <span class="bs-custom-url">{server.url}</span>
            </button>
            <button class="bs-icon-btn" onclick={() => startEdit(i)} title="Editar">
              <Icon name="edit" size={15} />
            </button>
            <button class="bs-icon-btn bs-delete-btn" onclick={() => removeCustom(server)} title="Eliminar">
              <Icon name="trash" size={15} />
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
