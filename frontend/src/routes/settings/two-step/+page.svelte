<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import Page from '$lib/components/Page.svelte';
  import Header from '$lib/components/Header.svelte';
  import SettingSection from '$lib/components/SettingSection.svelte';
  import SettingRow from '$lib/components/SettingRow.svelte';
  import { socket, twoStepStatus } from '$lib/stores';

  let sk: any = $state(null);
  let ts = $state({ enabled: 0, hint: '' });

  socket.subscribe((v) => sk = v);
  twoStepStatus.subscribe((v) => ts = v);

  let password = $state('');
  let confirmPassword = $state('');
  let hint = $state('');
  let error = $state('');
  let success = $state('');

  onMount(() => {
    sk?.emit('get_two_step_status', (res: any) => twoStepStatus.set(res));
  });

  function enable() {
    if (password.length < 4) { error = 'Mínimo 4 caracteres'; return; }
    if (password !== confirmPassword) { error = 'Las contraseñas no coinciden'; return; }
    error = '';
    sk?.emit('set_two_step', { password, hint }, (res: any) => {
      if (res.ok) {
        twoStepStatus.set({ enabled: 1, hint });
        success = 'Verificación en dos pasos activada';
        password = ''; confirmPassword = '';
      } else {
        error = res.error;
      }
    });
  }

  function disable() {
    sk?.emit('disable_two_step', { password }, (res: any) => {
      if (res.ok) {
        twoStepStatus.set({ enabled: 0, hint: '' });
        password = '';
        success = 'Verificación en dos pasos desactivada';
      } else {
        error = res.error;
      }
    });
  }
</script>

<Page>
  <Header title="Verificación en dos pasos" onback={() => goto('/settings/security')} />
  <div class="content">
    {#if ts.enabled}
      <div class="status-badge active">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M20 6L9 17l-5-5"/></svg>
        Activada
      </div>
    {:else}
      <div class="status-badge">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
        Desactivada
      </div>
    {/if}

    <SettingSection label="Configuración">
      {#if !ts.enabled}
        <div class="form-group">
          <label for="new-pw">Nueva contraseña</label>
          <input id="new-pw" type="password" bind:value={password} placeholder="Mínimo 4 caracteres" />
        </div>
        <div class="form-group">
          <label for="confirm-pw">Confirmar contraseña</label>
          <input id="confirm-pw" type="password" bind:value={confirmPassword} placeholder="Repite la contraseña" />
        </div>
        <div class="form-group">
          <label for="hint">Pista (opcional)</label>
          <input id="hint" type="text" bind:value={hint} placeholder="Ej: mi fecha favorita" />
        </div>
        <button class="action-btn" onclick={enable}>Activar</button>
      {:else}
        <div class="form-group">
          <label for="current-hint">Pista actual</label>
          <input id="current-hint" type="text" value={ts.hint || '(sin pista)'} disabled />
        </div>
        <div class="form-group">
          <label for="disable-pw">Contraseña actual para desactivar</label>
          <input id="disable-pw" type="password" bind:value={password} placeholder="Ingresa tu contraseña" />
        </div>
        <button class="action-btn danger" onclick={disable}>Desactivar</button>
      {/if}
    </SettingSection>

    <div class="info-text">
      Si activas la verificación en dos pasos, se te pedirá una contraseña adicional cada vez que inicies sesión en un dispositivo nuevo.
    </div>

    {#if error}
      <p class="msg error">{error}</p>
    {/if}
    {#if success}
      <p class="msg success">{success}</p>
    {/if}
  </div>
</Page>

<style>
  .content { flex: 1; overflow-y: auto; padding: 0 0 16px; }
  .status-badge {
    display: flex; align-items: center; gap: 8px; justify-content: center;
    padding: 16px; font-size: 16px; font-weight: 600; color: var(--text-2);
    background: var(--bg-2); margin-top: 12px;
  }
  .status-badge.active { color: var(--accent); }
  .form-group { padding: 14px 16px; border-bottom: 1px solid var(--border-2); }
  .form-group label { display: block; font-size: 12px; color: var(--text-2); margin-bottom: 6px; }
  .form-group input {
    width: 100%; padding: 12px 14px; border: none; border-radius: 10px;
    font-size: 15px; outline: none; background: var(--bg-3); color: var(--text);
    transition: background 0.2s;
  }
  .form-group input:focus { background: #333; }
  .form-group input:disabled { opacity: 0.5; }
  .action-btn {
    width: calc(100% - 32px); margin: 16px; padding: 13px;
    background: var(--accent); color: #000; font-weight: 700;
    border: none; border-radius: 12px; font-size: 15px; cursor: pointer;
  }
  .action-btn:hover { background: var(--accent-hover); }
  .action-btn.danger { background: var(--danger); color: #fff; }
  .action-btn.danger:hover { background: #dc2626; }
  .info-text { padding: 16px; font-size: 12px; color: var(--text-3); line-height: 1.5; }
  .msg { text-align: center; font-size: 13px; padding: 8px 16px; }
  .msg.error { color: var(--danger); }
  .msg.success { color: var(--accent); }
</style>
