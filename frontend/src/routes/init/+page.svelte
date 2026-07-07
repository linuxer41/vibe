<script lang="ts">
  import Icon from '$lib/icon/Icon.svelte';
  import { get } from 'svelte/store';
  import { createSocket } from '$lib/socket';
  import {
    socket, user, token, authStep, authError, phone, code,
    setupName, setupUser, setupBio, displayName, username, bio, theme
  } from '$lib/stores';
  import { avatarUrl, initSocket } from '$lib/helpers';
  import Page from '$lib/components/Page.svelte';
  import BottomSheet from '$lib/components/BottomSheet.svelte';
  import Modal from '$lib/components/Modal.svelte';
  import BackendSelector from '$lib/components/BackendSelector.svelte';
  import { countries, getDefaultCountry, type Country } from '$lib/countries';

  let sk: any = $state(null);
  let selectedCountry = $state(getDefaultCountry());
  let showCountrySheet = $state(false);
  let countrySearch = $state('');
  let setupAvatarPreview = $state<string | null>(null);
  let sendingCode = $state(false);
  let verifyingCode = $state(false);
  let savingSetup = $state(false);
  let showBackendSelector = $state(false);
  let backendLabel = $state(backendLabelFromStorage());

  function backendLabelFromStorage(): string {
    if (typeof localStorage === 'undefined') return 'Node.js';
    const label = localStorage.getItem('wa_backend_label');
    if (label) return label;
    const ls = localStorage.getItem('wa_backend');
    if (ls === 'node' || !ls) return 'Node.js';
    if (ls === 'rust') return 'Rust';
    return 'Custom';
  }

  function onBackendChanged() {
    backendLabel = backendLabelFromStorage();
  }

  function handleAvatarSelect(e: Event) {
    const input = e.target as HTMLInputElement;
    if (!input.files?.length) return;
    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = () => {
      setupAvatarPreview = reader.result as string;
    };
    reader.readAsDataURL(file);
    input.value = '';
  }

  let filteredCountries = $derived(
    countries.filter(c =>
      c.name.toLowerCase().includes(countrySearch.toLowerCase()) ||
      c.dial.includes(countrySearch) ||
      c.code.toLowerCase().includes(countrySearch.toLowerCase())
    )
  );

  const fullPhone = $derived(`${selectedCountry.dial}${$phone}`);

  function sendCode() {
    const ph = get(phone);
    if (ph.length < selectedCountry.length) { authError.set(`Teléfono inválido — debe tener ${selectedCountry.length} dígitos`); return; }
    if (sendingCode) return;
    authError.set('');
    sendingCode = true;
    const s = createSocket();
    s.connect();
    s.emit('send_code', { phone: fullPhone }, (res: any) => {
      sendingCode = false;
      if (res.ok) {
        authStep.set('verify');
        sk = s;
        socket.set(s);
        if (res.code) code.set(String(res.code));
        authError.set(`Código: ${res.code}`);
      } else {
        authError.set(res.error);
        s.disconnect();
      }
    });
  }

  function toggleTheme() {
    theme.update((t) => {
      const next = t === 'dark' ? 'light' : 'dark';
      localStorage.setItem('wa_theme', next);
      return next;
    });
  }

  function verifyCode() {
    const cd = get(code);
    const ph = get(phone);
    if (cd.length < 6) { authError.set('Código inválido'); return; }
    if (verifyingCode) return;
    authError.set('');
    verifyingCode = true;
    const s = sk || get(socket);
    s?.emit('verify_code', {
      phone: `${selectedCountry.dial}${ph}`, code: cd,
      username: `user_${ph.slice(-4)}`,
      displayName: `User ${ph.slice(-4)}`,
      countryCode: selectedCountry.dial
    }, (res: any) => {
      verifyingCode = false;
      if (res.ok) {
        token.set(res.token);
        user.set(res.user);
        setupName.set('');
        setupUser.set(res.user.username);
        setupBio.set(res.user.bio || '');
        setupAvatarPreview = null;
        displayName.set(res.user.display_name);
        username.set(res.user.username);
        bio.set(res.user.bio || '');
        localStorage.setItem('wa_token', res.token);
        if (s) { s.disconnect(); sk = null; }
        if (res.isNew) {
          authStep.set('setup');
        } else {
          enterMain();
        }
      } else {
        authError.set(res.error);
      }
    });
  }

  function enterMain() {
    const t = get(token);
    if (!t) return;
    const s = createSocket(t);
    s.connect();
    socket.set(s);
    initSocket(s);
    authStep.set('main');
  }

  function saveSetup() {
    const nm = get(setupName);
    const su = get(setupUser);
    const sb = get(setupBio);
    if (!nm.trim()) return;
    if (savingSetup) return;
    savingSetup = true;
    let s = get(socket);
    if (!s || !s.connected) { s = createSocket(get(token)); s.connect(); socket.set(s); }
    const usr = get(user);
    const fields: any = {};
    if (nm !== usr?.display_name || !usr?.display_name) fields.display_name = nm;
    if (su !== usr?.username) fields.username = su;
    if (sb !== (usr?.bio || '')) fields.bio = sb;
    if (setupAvatarPreview) fields.avatar = setupAvatarPreview;
    const done = () => { savingSetup = false; enterMain(); };
    if (Object.keys(fields).length > 0) {
      s.emit('update_profile', fields, () => {
        if (usr) { usr.display_name = nm; usr.username = su; usr.bio = sb; if (setupAvatarPreview) usr.avatar = setupAvatarPreview; user.set(usr); }
        done();
      });
    } else { done(); }
  }
</script>

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

    {#if $authStep === 'phone'}
      <div class="init-form">
        <p class="init-subtitle">Ingresa tu número de teléfono</p>
        <div class="phone-input-wrap">
          <button class="country-selector" onclick={() => showCountrySheet = true}>
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

    {:else if $authStep === 'setup'}
      <div class="init-form">
        <p class="init-subtitle">Tu perfil</p>
        <div class="setup-avatar-wrap" onclick={() => document.getElementById('setup-avatar-input')?.click()}>
          {#if setupAvatarPreview}
            <img src={setupAvatarPreview} alt="" class="setup-avatar-img" />
          {:else}
            <img src={avatarUrl($user?.id || 0)} alt="" class="setup-avatar-img" onerror={(e) => { const t = e.target as HTMLImageElement; t.style.display = 'none'; (t.nextElementSibling as HTMLElement).style.display = 'flex'; }} />
            <div class="setup-avatar-letter" style="display:none">{($setupName || 'U').charAt(0).toUpperCase()}</div>
          {/if}
          <div class="setup-camera-icon">
            <Icon name="camera" size={18} />
          </div>
        </div>
        <p class="setup-username-text">@{$setupUser}</p>
        <input type="file" id="setup-avatar-input" accept="image/*;capture=camera" class="file-input" onchange={handleAvatarSelect} />
        <input type="text" bind:value={$setupName} placeholder="Tu nombre" maxlength="30" class="init-input" />
        <textarea bind:value={$setupBio} placeholder="Mi bio (opcional)" rows={2} maxlength="100" class="init-input"></textarea>
        <button class="init-btn" onclick={saveSetup} disabled={savingSetup}>
          {#if savingSetup}
            <span class="init-spinner"></span>
          {:else}
            Finalizar
          {/if}
        </button>
      </div>
    {/if}

    {#if $authError}
      <p class="init-error" class:info={$authError.startsWith('Código:')}>{$authError}</p>
    {/if}
  </div>

  <div class="init-footer">
    <p>Al continuar, aceptas nuestros <a href="/terms">Términos de servicio</a> y <a href="/privacy-policy">Política de privacidad</a>.</p>
  </div>
</Page>

<Modal show={showBackendSelector} onclose={() => showBackendSelector = false} title="Servidor backend">
  <BackendSelector onclose={() => showBackendSelector = false} onchange={onBackendChanged} />
</Modal>

<BottomSheet show={showCountrySheet} onclose={() => { showCountrySheet = false; countrySearch = ''; }}>
  {#snippet header()}
    <div class="sheet-search">
      <Icon name="search" size={16} style="color: var(--text-3)" />
      <input type="text" bind:value={countrySearch} placeholder="Buscar país..." class="sheet-search-input" />
    </div>
  {/snippet}
  <div class="country-list">
    {#each filteredCountries as c (c.code)}
      <button class="country-item" onclick={() => { selectedCountry = c; showCountrySheet = false; countrySearch = ''; }}>
        <span class="ci-flag">{c.flag}</span>
        <span class="ci-name">{c.name}</span>
        <span class="ci-dial">+{c.dial}</span>
      </button>
    {/each}
  </div>
</BottomSheet>

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
    border: 2px solid rgba(255,255,255,0.08);
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
    border: 2px solid rgba(255,255,255,0.08);
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
  .init-input {
    width: 100%; padding: 14px 16px;
    border: 2px solid rgba(255,255,255,0.08); border-radius: 12px;
    font-size: 16px; margin-bottom: 14px; outline: none;
    background: var(--bg-3); color: var(--text);
    transition: border-color 0.2s; text-align: center;
    font-family: inherit; resize: vertical;
  }
  .init-input:focus { border-color: var(--accent); }
  .init-input::placeholder { color: var(--text-3); }
  .init-error {
    font-size: 13px; color: var(--danger); text-align: center;
    min-height: 20px; margin-top: 16px;
  }
  .init-error.info { color: var(--accent); }
  .init-footer {
    padding: 20px 32px 32px; text-align: center;
  }
  .init-footer p {
    font-size: 12px; color: var(--text-3); line-height: 1.6;
  }
  .init-footer a {
    color: var(--accent); text-decoration: none; font-weight: 500;
  }
  .init-footer a:hover { text-decoration: underline; }
  .setup-avatar-wrap {
    width: 96px; height: 96px; margin: 0 auto 28px;
    position: relative; cursor: pointer;
  }
  .setup-avatar-img, .setup-avatar-letter {
    width: 100%; height: 100%; border-radius: 50%; object-fit: cover;
    display: flex; align-items: center; justify-content: center;
    font-size: 36px; font-weight: 700; color: var(--text);
    box-shadow: 0 4px 16px var(--shadow);
  }
  .setup-camera-icon {
    position: absolute; bottom: 0; right: 0;
    width: 32px; height: 32px; border-radius: 50%;
    background: var(--accent); display: flex; align-items: center;
    justify-content: center; border: 3px solid var(--bg);
  }
  .sheet-search {
    display: flex; align-items: center; gap: 10px;
    padding: 12px 16px; border-bottom: 1px solid var(--border);
  }
  .sheet-search-input {
    flex: 1; background: none; border: none; outline: none;
    font-size: 15px; color: var(--text); font-family: inherit;
  }
  .sheet-search-input::placeholder { color: var(--text-3); }
  .country-list { flex: 1; overflow-y: auto; }
  .country-item {
    display: flex; align-items: center; gap: 12px;
    width: 100%; padding: 13px 16px; background: none;
    border: none; cursor: pointer; transition: background 0.15s;
    text-align: left;
  }
  .country-item:hover { background: var(--bg); }
  .country-item:active { background: var(--bg-2); }
  .ci-flag { font-size: 24px; line-height: 1; }
  .ci-name { flex: 1; font-size: 15px; color: var(--text); font-weight: 500; }
  .ci-dial { font-size: 14px; color: var(--text-3); }
  .file-input { display: none; }
  .setup-username-text {
    text-align: center; font-size: 14px; color: var(--text-3);
    margin: -18px 0 24px; font-weight: 500;
  }

</style>
