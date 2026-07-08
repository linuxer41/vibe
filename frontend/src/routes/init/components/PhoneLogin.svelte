<script lang="ts">
  import { get } from 'svelte/store';
  import { goto } from '$app/navigation';
  import Icon from '$lib/icon/Icon.svelte';
  import { sendCode as httpSendCode, verifyCode as httpVerifyCode } from '$lib/auth-http';
  import {
    authStep, authError, phone, code
  } from '$lib/stores';
  import type { Country } from '$lib/countries';

  let {
    selectedCountry,
    oncountryclick,
    onverified
  }: {
    selectedCountry: Country;
    oncountryclick: () => void;
    onverified: (res: any) => void;
  } = $props();

  let sendingCode = $state(false);
  let verifyingCode = $state(false);

  const fullPhone = $derived(`${selectedCountry.dial}${$phone}`);

  async function sendCode() {
    const ph = get(phone);
    if (ph.length < selectedCountry.length) { authError.set(`Teléfono inválido — debe tener ${selectedCountry.length} dígitos`); return; }
    if (sendingCode) return;
    authError.set('');
    sendingCode = true;
    try {
      const c = await httpSendCode(fullPhone);
      authStep.set('verify');
      if (c) code.set(String(c));
      authError.set(`Código: ${c}`);
    } catch (e: any) {
      authError.set(e.message || 'Error de conexión');
    } finally {
      sendingCode = false;
    }
  }

  async function verifyCode() {
    const cd = get(code);
    const ph = get(phone);
    if (cd.length < 6) { authError.set('Código inválido'); return; }
    if (verifyingCode) return;
    authError.set('');
    verifyingCode = true;
    try {
      const res = await httpVerifyCode(
        `${selectedCountry.dial}${ph}`, cd,
        `user_${ph.slice(-4)}`,
        `User ${ph.slice(-4)}`,
        selectedCountry.dial,
      );
      onverified(res);
    } catch (e: any) {
      authError.set(e.message || 'Error de conexión');
    } finally {
      verifyingCode = false;
    }
  }
</script>

{#if $authStep === 'phone'}
  <div class="init-form">
    <p class="init-subtitle">Ingresa tu número de teléfono</p>
    <div class="phone-input-wrap">
      <button class="country-selector" onclick={oncountryclick}>
        <span class="cs-flag">{selectedCountry.flag}</span>
        <span class="cs-code">+{selectedCountry.dial}</span>
        <Icon name="chevron-down" size={12} strokeWidth={2.5} style="color: var(--text-3)" />
      </button>
      <input type="tel" bind:value={$phone} placeholder={'•'.repeat(selectedCountry.length)} maxlength={selectedCountry.length} onkeydown={(e) => e.key === 'Enter' && sendCode()} />
    </div>
    <button class="init-btn" onclick={sendCode} disabled={sendingCode}>
      {#if sendingCode}
        <span class="init-spinner"></span>
      {:else}
        Continuar
      {/if}
    </button>
  </div>

{:else if $authStep === 'verify'}
  <div class="init-form">
    <p class="init-subtitle">Código enviado a <strong>+{selectedCountry.dial} {$phone}</strong></p>
    <div class="code-input-wrap">
      <input type="text" bind:value={$code} placeholder="Código de 6 dígitos" maxlength="6" class="code-input" onkeydown={(e) => e.key === 'Enter' && verifyCode()} />
    </div>
    <button class="init-btn" onclick={verifyCode} disabled={verifyingCode}>
      {#if verifyingCode}
        <span class="init-spinner"></span>
      {:else}
        Verificar
      {/if}
    </button>
    <button class="init-link" onclick={() => authStep.set('phone')}>Cambiar número</button>
  </div>
{/if}

<style>
  .init-form {
    width: 100%; max-width: 380px;
  }
  .init-subtitle {
    font-size: 15px; color: var(--text-2); margin-bottom: 28px;
    text-align: center; line-height: 1.5;
  }
  .init-subtitle strong {
    color: var(--text);
  }
  .phone-input-wrap {
    display: flex; align-items: center; gap: 0;
    border: 2px solid var(--border);
    border-radius: 12px; background: var(--bg-3);
    transition: border-color 0.2s; margin-bottom: 20px;
  }
  .phone-input-wrap:focus-within {
    border-color: var(--accent);
  }
  .country-selector {
    display: flex; align-items: center; gap: 6px;
    padding: 14px 10px 14px 14px; background: none;
    border: none; border-right: 1px solid var(--border);
    cursor: pointer; flex-shrink: 0; transition: background 0.15s;
  }
  .country-selector:hover { background: var(--bg); border-radius: 10px 0 0 10px; }
  .country-selector:active { background: var(--bg-2); }
  .cs-flag { font-size: 22px; line-height: 1; }
  .cs-code { font-size: 16px; font-weight: 600; color: var(--text); }
  .phone-input-wrap input {
    flex: 1; background: none; border: none; outline: none;
    padding: 14px 16px; font-size: 18px;
    color: var(--text); caret-color: var(--accent); min-width: 0;
  }
  .phone-input-wrap input::placeholder {
    color: var(--text-3);
  }
  .code-input-wrap {
    border: 2px solid var(--border);
    border-radius: 12px; background: var(--bg-3);
    transition: border-color 0.2s; margin-bottom: 20px;
  }
  .code-input-wrap:focus-within {
    border-color: var(--accent);
  }
  .code-input {
    width: 100%; background: none; border: none; outline: none;
    padding: 14px 16px; font-size: 22px; color: var(--text);
    text-align: center; letter-spacing: 10px; font-weight: 600;
    caret-color: var(--accent);
  }
  .code-input::placeholder {
    color: var(--text-3); letter-spacing: 2px; font-weight: 400;
  }
  .init-btn {
    width: 100%; display: flex; align-items: center; justify-content: center;
    gap: 8px; padding: 15px; background: var(--accent); color: #000;
    border: none; border-radius: 12px; font-size: 16px; font-weight: 700;
    cursor: pointer; transition: background 0.2s, transform 0.15s;
    min-height: 52px;
  }
  .init-btn:hover { background: var(--accent-hover); }
  .init-btn:active { transform: scale(0.98); }
  .init-btn:disabled { opacity: 0.6; cursor: default; }
  .init-btn:disabled:active { transform: none; }
  .init-spinner {
    width: 22px; height: 22px; border: 3px solid rgba(0,0,0,0.2);
    border-top-color: #000; border-radius: 50%;
    animation: init-spin 0.7s linear infinite;
  }
  @keyframes init-spin { to { transform: rotate(360deg); } }
  .init-link {
    width: 100%; background: none; border: none;
    color: var(--accent); font-size: 14px; font-weight: 600;
    cursor: pointer; padding: 14px; margin-top: 4px;
    transition: opacity 0.2s;
  }
  .init-link:hover { opacity: 0.8; }
</style>
