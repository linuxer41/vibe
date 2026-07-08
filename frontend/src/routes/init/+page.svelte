<script lang="ts">
  import { goto } from '$app/navigation';
  import Icon from '$lib/icon/Icon.svelte';
  import { get } from 'svelte/store';
  import { createSocket } from '$lib/socket';
  import {
    socket, user, token, authStep, authError,
    setupName, setupUser, setupBio, displayName, username, bio, theme
  } from '$lib/stores';
  import { initSocket, loadInitialData } from '$lib/helpers';
  import Page from '$lib/components/Page.svelte';
  import Modal from '$lib/components/Modal.svelte';
  import BackendSelector from '$lib/components/BackendSelector.svelte';
  import MinimalLayout from '$lib/layouts/MinimalLayout.svelte';
  import { getBackendConfig } from '$lib/backend-config';
  import { getDefaultCountry, type Country } from '$lib/countries';
  import PhoneLogin from './components/PhoneLogin.svelte';
  import ProfileSetup from './components/ProfileSetup.svelte';
  import CountryPicker from './components/CountryPicker.svelte';

  let selectedCountry = $state(getDefaultCountry());
  let showCountrySheet = $state(false);
  let showBackendSelector = $state(false);
  let backendLabel = $state(getBackendConfig().label || 'Node.js');

  function onBackendChanged() {
    backendLabel = getBackendConfig().label || 'Custom';
  }

  function onBackendChanged() {
    backendLabel = backendLabelFromStorage();
  }

  function toggleTheme() {
    theme.update((t) => {
      const next = t === 'dark' ? 'light' : 'dark';
      localStorage.setItem('wa_theme', next);
      return next;
    });
  }

  function handleVerified(res: any) {
    const s = get(socket);
    token.set(res.token);
    user.set(res.user);
    setupName.set('');
    setupUser.set(res.user.username);
    setupBio.set(res.user.bio || '');
    displayName.set(res.user.display_name);
    username.set(res.user.username);
    bio.set(res.user.bio || '');
    localStorage.setItem('wa_token', res.token);
    if (s) { s.disconnect(); }
    if (res.isNew) {
      authStep.set('setup');
    } else {
      enterMain();
    }
  }

  function enterMain() {
    const t = get(token);
    if (!t) return;
    const s = createSocket(t);
    s.connect();
    socket.set(s);
    initSocket(s);
    loadInitialData();
    authStep.set('main');
  }

  function handleProfileSaved() {
    enterMain();
  }
</script>

<MinimalLayout>
<Page>
  <div class="init-body">
    <div class="top-actions">
      <button class="top-btn backend-toggle" onclick={() => showBackendSelector = true} title="Servidor backend">
        <Icon name="settings" size={16} style="color: var(--text-2)" />
        <span class="backend-label">{backendLabel}</span>
      </button>
      <button class="top-btn theme-toggle" onclick={toggleTheme} title={$theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}>
        {#if $theme === 'dark'}
          <Icon name="sun" size={22} style="color: var(--text-2)" />
        {:else}
          <Icon name="moon" size={22} style="color: var(--text-2)" />
        {/if}
      </button>
    </div>
    <div class="init-brand">
      <div class="init-logo">
        <svg width="44" height="44" viewBox="0 0 32 32" fill="var(--accent)">
          <rect width="32" height="32" rx="8" />
          <text x="16" y="24" text-anchor="middle" font-family="system-ui,sans-serif" font-size="22" font-weight="800" fill="#000">V</text>
        </svg>
      </div>
      <h1 class="init-title">Vibe</h1>
      <p class="init-tagline">Chat. Watch. Live.</p>
    </div>

    {#if $authStep === 'phone' || $authStep === 'verify'}
      <PhoneLogin {selectedCountry} oncountryclick={() => showCountrySheet = true} onverified={handleVerified} />
    {:else if $authStep === 'setup'}
      <ProfileSetup onsaved={handleProfileSaved} />
    {/if}

    {#if $authError}
      <p class="init-error" class:info={$authError.startsWith('Código:')}>{$authError}</p>
    {/if}
  </div>

  <div class="init-footer">
    <p>Al continuar, aceptas nuestros <a href="/terms">Términos de servicio</a> y <a href="/privacy-policy">Política de privacidad</a>.</p>
    <button class="help-btn" onclick={() => goto('/help?from=init')}>
      <Icon name="info" size={16} />
      ¿Cómo funciona Vibe?
    </button>
  </div>
</Page>

<Modal show={showBackendSelector} onclose={() => showBackendSelector = false} title="Servidor backend">
  <BackendSelector onclose={() => showBackendSelector = false} onchange={onBackendChanged} />
</Modal>

<CountryPicker show={showCountrySheet} onclose={() => showCountrySheet = false} onselect={(c) => selectedCountry = c} />
</MinimalLayout>

<style>
  .init-body {
    flex: 1; display: flex; flex-direction: column; align-items: center;
    justify-content: center; padding: 40px 32px; position: relative;
  }
  .top-actions {
    position: absolute; top: 16px; right: 16px;
    display: flex; align-items: center; gap: 6px;
  }
  .top-btn {
    width: 40px; height: 40px; border-radius: 50%;
    background: none; border: none; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    transition: background 0.2s;
  }
  .top-btn:hover { background: var(--bg-3); }
  .backend-toggle { width: auto; border-radius: 20px; padding: 0 12px; gap: 4px; }
  .backend-label { font-size: 12px; font-weight: 600; color: var(--text-2); }
  .init-brand {
    text-align: center; margin-bottom: 48px;
  }
  .init-brand svg {
    margin-bottom: 16px;
  }
  .init-title {
    font-size: 28px; font-weight: 700; color: var(--text);
    letter-spacing: -0.3px;
  }
  .init-tagline {
    font-size: 13px; color: var(--text-3); margin-top: 2px;
    letter-spacing: 0.5px;
  }
  .init-logo { margin-bottom: 12px; }
  .init-error {
    font-size: 13px; color: var(--danger); text-align: center;
    min-height: 20px; margin-top: 16px;
  }
  .init-error.info { color: var(--accent); }
  .init-footer {
    padding: 20px 32px 32px; text-align: center;
    display: flex; flex-direction: column; align-items: center; gap: 16px;
  }
  .init-footer p {
    font-size: 12px; color: var(--text-3); line-height: 1.6; margin: 0;
  }
  .init-footer a {
    color: var(--accent); text-decoration: none; font-weight: 500;
  }
  .init-footer a:hover { text-decoration: underline; }
  .help-btn {
    display: inline-flex; align-items: center; gap: 6px;
    background: none; border: 1px solid var(--border);
    border-radius: 20px; color: var(--text-2); font-size: 13px;
    font-weight: 600; cursor: pointer; padding: 8px 16px;
    font-family: inherit; transition: background 0.2s, color 0.2s;
  }
  .help-btn:hover { background: var(--bg-3); color: var(--text); }
</style>
