<script lang="ts">
  import { goto } from '$app/navigation';
  import Page from '$lib/components/Page.svelte';
  import Header from '$lib/components/Header.svelte';
  import SettingSection from '$lib/components/SettingSection.svelte';
  import SettingRow from '$lib/components/SettingRow.svelte';
  import Toggle from '$lib/components/Toggle.svelte';
  import { passcodeSettings } from '$lib/stores';

  let ps = $state({ enabled: false, passcodeHash: '', timeout: 1 });
  passcodeSettings.subscribe((v) => ps = v);

  let step: 'disabled' | 'set' | 'confirm' | 'enabled' = $state('disabled');
  let pin1 = $state('');
  let pin2 = $state('');
  let error = $state('');
  let success = $state('');

  const timeoutOptions = [
    { value: 0, label: 'Inmediatamente' },
    { value: 1, label: '1 minuto' },
    { value: 5, label: '5 minutos' },
    { value: 15, label: '15 minutos' },
    { value: 60, label: '1 hora' },
  ];

  function hashPin(pin: string) {
    let h = 0;
    for (let i = 0; i < pin.length; i++) {
      h = ((h << 5) - h) + pin.charCodeAt(i);
      h |= 0;
    }
    return 'h' + Math.abs(h).toString(36);
  }

  function startSetup() {
    step = 'set';
    pin1 = '';
    pin2 = '';
    error = '';
  }

  function confirmPin() {
    if (pin1.length < 4) { error = 'Mínimo 4 dígitos'; return; }
    step = 'confirm';
    error = '';
  }

  function savePin() {
    if (pin1 !== pin2) { error = 'Los PIN no coinciden'; return; }
    const hash = hashPin(pin1);
    const settings = { enabled: true, passcodeHash: hash, timeout: ps.timeout };
    passcodeSettings.set(settings);
    localStorage.setItem('wa_passcode', JSON.stringify(settings));
    step = 'enabled';
    success = 'Bloqueo con PIN activado';
    pin1 = '';
    pin2 = '';
  }

  function disable() {
    localStorage.removeItem('wa_passcode');
    passcodeSettings.set({ enabled: false, passcodeHash: '', timeout: 1 });
    step = 'disabled';
    success = 'Bloqueo con PIN desactivado';
  }

  function updateTimeout(t: number) {
    const settings = { ...ps, timeout: t };
    passcodeSettings.set(settings);
    localStorage.setItem('wa_passcode', JSON.stringify(settings));
  }
</script>

<Page>
  <Header title="Bloqueo con PIN" onback={() => goto('/settings/security')} />
  <div class="content">
    {#if ps.enabled || step === 'enabled'}
      <div class="status-badge active">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M20 6L9 17l-5-5"/></svg>
        Activado
      </div>
    {:else if step === 'disabled'}
      <div class="status-badge">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
        Desactivado
      </div>
    {/if}

    {#if step === 'disabled' || step === 'enabled'}
      <SettingSection>
        <SettingRow label="Bloqueo con PIN" desc={ps.enabled ? 'Usar PIN para desbloquear la app' : 'Protege la app con un PIN'}>
          {#snippet icon()}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
          {/snippet}
          {#if !ps.enabled}
            <Toggle checked={false} onchange={startSetup} />
          {:else}
            <Toggle checked={true} onchange={disable} />
          {/if}
        </SettingRow>
      </SettingSection>

      {#if ps.enabled}
        <SettingSection label="Requerir PIN después de">
          {#each timeoutOptions as opt}
            <div class="option" class:selected={ps.timeout === opt.value} onclick={() => updateTimeout(opt.value)}>
              <span>{opt.label}</span>
              {#if ps.timeout === opt.value}
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="3" stroke-linecap="round"><path d="M20 6L9 17l-5-5"/></svg>
              {/if}
            </div>
          {/each}
        </SettingSection>
        <button class="danger-btn" onclick={disable}>Desactivar PIN</button>
      {/if}

      {#if !ps.enabled}
        <button class="action-btn" onclick={startSetup}>Configurar PIN</button>
      {/if}

    {:else if step === 'set'}
      <SettingSection label="Establece un PIN">
        <div class="pin-input-wrap">
          {#each [0, 1, 2, 3, 4, 5] as i}
            <div class="pin-dot" class:filled={pin1.length > i}>{pin1[i] || ''}</div>
          {/each}
        </div>
        <div class="numpad">
          {#each [1, 2, 3, 4, 5, 6, 7, 8, 9] as n}
            <button class="numpad-key" onclick={() => { if (pin1.length < 6) pin1 += n; }}>{n}</button>
          {/each}
          <button class="numpad-key" onclick={() => { if (pin1.length > 0) pin1 = pin1.slice(0, -1); }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 18l6-6-6-6"/></svg>
          </button>
          <button class="numpad-key" onclick={() => { if (pin1.length < 6) pin1 += '0'; }}>0</button>
          <button class="numpad-key" onclick={confirmPin}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="3" stroke-linecap="round"><path d="M20 6L9 17l-5-5"/></svg>
          </button>
        </div>
      </SettingSection>

    {:else if step === 'confirm'}
      <SettingSection label="Confirma el PIN">
        <div class="pin-input-wrap">
          {#each [0, 1, 2, 3, 4, 5] as i}
            <div class="pin-dot" class:filled={pin2.length > i}>{pin2[i] || ''}</div>
          {/each}
        </div>
        <div class="numpad">
          {#each [1, 2, 3, 4, 5, 6, 7, 8, 9] as n}
            <button class="numpad-key" onclick={() => { if (pin2.length < 6) pin2 += n; }}>{n}</button>
          {/each}
          <button class="numpad-key" onclick={() => { if (pin2.length > 0) pin2 = pin2.slice(0, -1); }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 18l6-6-6-6"/></svg>
          </button>
          <button class="numpad-key" onclick={() => { if (pin2.length < 6) pin2 += '0'; }}>0</button>
          <button class="numpad-key" onclick={savePin}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="3" stroke-linecap="round"><path d="M20 6L9 17l-5-5"/></svg>
          </button>
        </div>
      </SettingSection>
    {/if}

    {#if error}
      <p class="msg error">{error}</p>
    {/if}
    {#if success}
      <p class="msg success">{success}</p>
    {/if}
  </div>
</Page>

<style>
  .content { flex: 1; overflow-y: auto; padding-bottom: 16px; }
  .status-badge {
    display: flex; align-items: center; gap: 8px; justify-content: center;
    padding: 16px; font-size: 16px; font-weight: 600; color: var(--text-2);
    background: var(--bg-2); margin-top: 12px;
  }
  .status-badge.active { color: var(--accent); }
  .option {
    display: flex; align-items: center; justify-content: space-between;
    padding: 14px 16px; cursor: pointer; border-bottom: 1px solid var(--border-2);
    transition: background 0.15s; font-size: 15px; color: var(--text);
  }
  .option:hover { background: rgba(255,255,255,0.03); }
  .option.selected { color: var(--accent); font-weight: 500; }
  .action-btn {
    width: calc(100% - 32px); margin: 16px; padding: 13px;
    background: var(--accent); color: #000; font-weight: 700;
    border: none; border-radius: 12px; font-size: 15px; cursor: pointer;
  }
  .action-btn:hover { background: var(--accent-hover); }
  .danger-btn {
    width: calc(100% - 32px); margin: 16px; padding: 13px;
    background: none; border: 1.5px solid var(--danger); border-radius: 12px;
    color: var(--danger); font-size: 15px; font-weight: 600; cursor: pointer;
  }
  .danger-btn:hover { background: rgba(239,68,68,0.06); }
  .pin-input-wrap {
    display: flex; justify-content: center; gap: 12px;
    padding: 24px 16px;
  }
  .pin-dot {
    width: 16px; height: 16px; border-radius: 50%;
    border: 2px solid var(--text-3); transition: all 0.2s;
  }
  .pin-dot.filled {
    background: var(--accent); border-color: var(--accent);
  }
  .numpad {
    display: grid; grid-template-columns: repeat(3, 1fr);
    gap: 8px; padding: 16px; max-width: 280px; margin: 0 auto;
  }
  .numpad-key {
    aspect-ratio: 1; border-radius: 50%; border: none;
    background: var(--bg-3); color: var(--text); font-size: 24px;
    font-weight: 500; cursor: pointer; display: flex;
    align-items: center; justify-content: center;
    transition: background 0.15s;
  }
  .numpad-key:hover { background: #333; }
  .numpad-key:active { background: #444; }
  .msg { text-align: center; font-size: 13px; padding: 8px 16px; }
  .msg.error { color: var(--danger); }
  .msg.success { color: var(--accent); }
</style>
