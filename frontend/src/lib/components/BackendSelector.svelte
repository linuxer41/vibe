<script lang="ts">
  import Icon from '$lib/icon/Icon.svelte';
  import { getBackendConfig, setBackendConfig, type BackendConfig } from '$lib/backend-config';
  let { onclose, onchange }: { onclose?: () => void; onchange?: () => void } = $props();

  const PRESETS: Array<{ label: string; cfg: BackendConfig }> = [
    { label: 'Node.js', cfg: { wsUrl: 'ws://localhost:3000', tcpUrl: '127.0.0.1:4000', httpUrl: 'http://localhost:2000', label: 'Node.js' } },
    { label: 'Rust', cfg: { wsUrl: 'ws://localhost:3001', tcpUrl: '127.0.0.1:5000', httpUrl: 'http://localhost:2001', label: 'Rust' } },
  ];

  interface CustomServer extends BackendConfig {
    label: string;
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

  let activeCfg = $state(getBackendConfig());
  let customServers = $state(getCustomServers());
  let showInput = $state(false);
  let newLabel = $state('');
  let newWsUrl = $state('');
  let newTcpUrl = $state('');
  let newHttpUrl = $state('');
  let editingIndex = $state(-1);
  let editLabel = $state('');
  let editWsUrl = $state('');
  let editTcpUrl = $state('');
  let editHttpUrl = $state('');

  function setActive(cfg: BackendConfig) {
    setBackendConfig(cfg);
    activeCfg = cfg;
    onchange?.();
  }

  function selectPreset(cfg: BackendConfig) {
    setActive(cfg);
  }

  function selectCustom(server: CustomServer) {
    setActive(server);
  }

  function addCustom() {
    const label = newLabel.trim() || newWsUrl.trim();
    if (!newWsUrl.trim() && !newHttpUrl.trim()) return;
    const server: CustomServer = {
      label,
      wsUrl: newWsUrl.trim() || 'ws://localhost:3000',
      tcpUrl: newTcpUrl.trim() || '127.0.0.1:4000',
      httpUrl: newHttpUrl.trim() || 'http://localhost:2000',
    };
    if (customServers.some(s => s.wsUrl === server.wsUrl && s.httpUrl === server.httpUrl)) return;
    customServers = [...customServers, server];
    saveCustomServers(customServers);
    setActive(server);
    newLabel = ''; newWsUrl = ''; newTcpUrl = ''; newHttpUrl = '';
    showInput = false;
  }

  function removeCustom(server: CustomServer) {
    customServers = customServers.filter(s => s.wsUrl !== server.wsUrl || s.httpUrl !== server.httpUrl);
    saveCustomServers(customServers);
    if (activeCfg.wsUrl === server.wsUrl && activeCfg.httpUrl === server.httpUrl) {
      setActive(PRESETS[0].cfg);
    }
  }

  function startEdit(index: number) {
    editingIndex = index;
    editLabel = customServers[index].label;
    editWsUrl = customServers[index].wsUrl;
    editTcpUrl = customServers[index].tcpUrl;
    editHttpUrl = customServers[index].httpUrl;
  }

  function saveEdit(index: number) {
    const label = editLabel.trim() || editWsUrl.trim();
    if (!editWsUrl.trim() && !editHttpUrl.trim()) return;
    const list = [...customServers];
    const wasActive = activeCfg.wsUrl === list[index].wsUrl && activeCfg.httpUrl === list[index].httpUrl;
    list[index] = {
      label,
      wsUrl: editWsUrl.trim() || list[index].wsUrl,
      tcpUrl: editTcpUrl.trim() || list[index].tcpUrl,
      httpUrl: editHttpUrl.trim() || list[index].httpUrl,
    };
    customServers = list;
    saveCustomServers(list);
    if (wasActive) setActive(list[index]);
    editingIndex = -1;
    editLabel = ''; editWsUrl = ''; editTcpUrl = ''; editHttpUrl = '';
  }
</script>

<div class="bs-current">
  <span class="bs-current-label">Servidor activo</span>
  <span class="bs-current-url">{activeCfg.label || 'Custom'}</span>
  <span class="bs-current-sub">WS: {activeCfg.wsUrl}</span>
  <span class="bs-current-sub">TCP: {activeCfg.tcpUrl}</span>
  <span class="bs-current-sub">HTTP: {activeCfg.httpUrl}</span>
</div>

<div class="bs-section">
  <span class="bs-section-title">Predefinidos</span>
  <div class="bs-presets">
    {#each PRESETS as preset}
      <button
        class="bs-preset-btn"
        class:active={activeCfg.wsUrl === preset.cfg.wsUrl && activeCfg.httpUrl === preset.cfg.httpUrl}
        onclick={() => selectPreset(preset.cfg)}
      >
        <Icon name="settings" size={16} style="color: var(--accent)" />
        <span>{preset.label}</span>
        <span class="bs-url-hint">WS: {preset.cfg.wsUrl}</span>
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
      <input type="text" bind:value={newLabel} placeholder="Nombre (ej: Mi Servidor)" class="bs-input" />
      <div class="bs-url-field">
        <span class="bs-url-prefix">WS</span>
        <input type="text" bind:value={newWsUrl} placeholder="ws://localhost:3000" class="bs-input" />
      </div>
      <div class="bs-url-field">
        <span class="bs-url-prefix">TCP</span>
        <input type="text" bind:value={newTcpUrl} placeholder="127.0.0.1:4000" class="bs-input" />
      </div>
      <div class="bs-url-field">
        <span class="bs-url-prefix">HTTP</span>
        <input type="text" bind:value={newHttpUrl} placeholder="http://localhost:2000" class="bs-input" onkeydown={(e) => e.key === 'Enter' && addCustom()} />
      </div>
      <button class="bs-confirm-btn bs-add-confirm" onclick={addCustom} disabled={!newWsUrl.trim() && !newHttpUrl.trim()}>
        <Icon name="check" size={16} strokeWidth={2.5} />
        Añadir servidor
      </button>
    </div>
  {/if}

  {#if customServers.length > 0}
    <div class="bs-custom-list">
      {#each customServers as server, i}
        <div class="bs-custom-item" class:active={activeCfg.wsUrl === server.wsUrl && activeCfg.httpUrl === server.httpUrl}>
          {#if editingIndex === i}
            <div class="bs-edit-form">
              <input type="text" bind:value={editLabel} placeholder="Nombre" class="bs-input bs-edit-input" />
              <div class="bs-url-field">
                <span class="bs-url-prefix">WS</span>
                <input type="text" bind:value={editWsUrl} placeholder="ws://..." class="bs-input bs-edit-input" />
              </div>
              <div class="bs-url-field">
                <span class="bs-url-prefix">TCP</span>
                <input type="text" bind:value={editTcpUrl} placeholder="ip:port" class="bs-input bs-edit-input" />
              </div>
              <div class="bs-url-field">
                <span class="bs-url-prefix">HTTP</span>
                <input type="text" bind:value={editHttpUrl} placeholder="http://..." class="bs-input bs-edit-input" onkeydown={(e) => { if (e.key === 'Enter') saveEdit(i); if (e.key === 'Escape') editingIndex = -1; }} />
              </div>
              <button class="bs-confirm-btn" onclick={() => saveEdit(i)}>
                <Icon name="check" size={15} strokeWidth={2.5} />
                Guardar
              </button>
            </div>
          {:else}
            <button class="bs-custom-info" onclick={() => selectCustom(server)}>
              <span class="bs-custom-label">{server.label}</span>
              <span class="bs-custom-url">WS: {server.wsUrl}</span>
              <span class="bs-custom-url">TCP: {server.tcpUrl}</span>
              <span class="bs-custom-url">HTTP: {server.httpUrl}</span>
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
  .bs-add-confirm {
    width: 100%; padding: 10px; margin-top: 4px; gap: 6px;
  }
  .bs-url-field {
    display: flex; align-items: center; gap: 8px;
  }
  .bs-url-prefix {
    font-size: 12px; font-weight: 700; color: var(--text-3);
    width: 36px; text-align: right; flex-shrink: 0;
    font-family: monospace;
  }
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
  .bs-edit-input { font-size: 13px; }
  .bs-empty { font-size: 13px; color: var(--text-3); text-align: center; padding: 12px 0; }
</style>
