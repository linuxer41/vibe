<script lang="ts">
  import { get } from 'svelte/store';
  import { createSocket } from '$lib/socket';
  import {
    socket, user, token, authStep, authError, phone, code,
    setupName, setupUser, setupBio, displayName, username, bio, theme
  } from '$lib/stores';
  import { avatarUrl, initSocket } from '$lib/helpers';
  import Page from '$lib/components/Page.svelte';
  import BottomSheet from '$lib/components/BottomSheet.svelte';
  import { countries, getDefaultCountry, type Country } from '$lib/countries';

  let sk: any = $state(null);
  let selectedCountry = $state(getDefaultCountry());
  let showCountrySheet = $state(false);
  let countrySearch = $state('');
  let setupAvatarPreview = $state<string | null>(null);

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

  function sendCode() {
    const ph = get(phone);
    if (ph.length < 10) { authError.set('Teléfono inválido'); return; }
    authError.set('');
    const s = createSocket();
    s.connect();
    s.emit('send_code', { phone: `${selectedCountry.dial}${ph}` }, (res: any) => {
      if (res.ok) {
        authStep.set('verify');
        sk = s;
        socket.set(s);
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
    authError.set('');
    const s = sk || get(socket);
    s?.emit('verify_code', {
      phone: `${selectedCountry.dial}${ph}`, code: cd,
      username: `user_${ph.slice(-4)}`,
      displayName: `User ${ph.slice(-4)}`,
      countryCode: selectedCountry.dial
    }, (res: any) => {
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
    let s = get(socket);
    if (!s || !s.connected) { s = createSocket(get(token)); s.connect(); socket.set(s); }
    const usr = get(user);
    const fields: any = {};
    if (nm !== usr?.display_name || !usr?.display_name) fields.display_name = nm;
    if (su !== usr?.username) fields.username = su;
    if (sb !== (usr?.bio || '')) fields.bio = sb;
    if (setupAvatarPreview) fields.avatar = setupAvatarPreview;
    if (Object.keys(fields).length > 0) {
      s.emit('update_profile', fields, () => {
        if (usr) { usr.display_name = nm; usr.username = su; usr.bio = sb; if (setupAvatarPreview) usr.avatar = setupAvatarPreview; user.set(usr); }
        enterMain();
      });
    } else { enterMain(); }
  }
</script>

<Page>
  <div class="init-body">
    <button class="theme-toggle" onclick={toggleTheme} title={$theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}>
      {#if $theme === 'dark'}
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--text-2)" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
      {:else}
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--text-2)" stroke-width="2" stroke-linecap="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
      {/if}
    </button>
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
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" stroke-width="2.5" stroke-linecap="round"><path d="M6 9l6 6 6-6"/></svg>
          </button>
          <input type="tel" bind:value={$phone} placeholder="54 11 1234 5678" onkeydown={(e) => e.key === 'Enter' && sendCode()} />
        </div>
        <button class="init-btn" onclick={sendCode}>
          Continuar
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
        </button>
      </div>

    {:else if $authStep === 'verify'}
      <div class="init-form">
        <p class="init-subtitle">Código enviado a <strong>{$phone}</strong></p>
        <div class="code-input-wrap">
          <input type="text" bind:value={$code} placeholder="Código de 6 dígitos" maxlength="6" class="code-input" onkeydown={(e) => e.key === 'Enter' && verifyCode()} />
        </div>
        <button class="init-btn" onclick={verifyCode}>
          Verificar
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
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
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
          </div>
        </div>
        <input type="file" id="setup-avatar-input" accept="image/*;capture=camera" class="file-input" onchange={handleAvatarSelect} />
        <input type="text" bind:value={$setupName} placeholder="Tu nombre" maxlength="30" class="init-input" />
        <div class="setup-username-readonly">
          <span class="su-label">@</span>
          <span class="su-value">{$setupUser}</span>
        </div>
        <textarea bind:value={$setupBio} placeholder="Opcional" rows={2} maxlength="100" class="init-input"></textarea>
        <button class="init-btn" onclick={saveSetup}>
          Finalizar
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
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

<BottomSheet show={showCountrySheet} onclose={() => { showCountrySheet = false; countrySearch = ''; }}>
  {#snippet header()}
    <div class="sheet-search">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
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
  .theme-toggle {
    position: absolute; top: 16px; right: 16px;
    width: 40px; height: 40px; border-radius: 50%;
    background: none; border: none; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    transition: background 0.2s;
  }
  .theme-toggle:hover { background: var(--bg-3); }
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
  }
  .init-btn:hover { background: var(--accent-hover); }
  .init-btn:active { transform: scale(0.98); }
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
  .setup-username-readonly {
    display: flex; align-items: center; gap: 4px;
    width: 100%; padding: 14px 16px; margin-bottom: 14px;
    border: 2px solid rgba(255,255,255,0.08); border-radius: 12px;
    background: var(--bg-3); text-align: center; justify-content: center;
  }
  .su-label { font-size: 16px; color: var(--text-3); font-weight: 500; }
  .su-value { font-size: 16px; color: var(--text-2); font-weight: 500; }
</style>
