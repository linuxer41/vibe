<script lang="ts">
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { createSocket } from '$lib/socket';
  import {
    socket, user, token, authStep, authError, phone, code,
    chats, contacts, calls, messages, activeChat,
    typingText, setupName, setupUser, setupBio, displayName, username, bio,
    passcodeSettings, appLocked, theme
  } from '$lib/stores';
  import { initSocket } from '$lib/helpers';
  import { requestPushSubscription } from '$lib/push';
  import '../app.css';
  import Toast from '$lib/components/Toast.svelte';

  let { children } = $props();
  let pinInput = $state('');
  let lockError = $state('');

  onMount(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/service-worker.js').catch(() => {});
    }
    const saved = localStorage.getItem('wa_token');
    const savedTheme = localStorage.getItem('wa_theme') as 'dark' | 'light' | null;
    if (savedTheme) theme.set(savedTheme);
    if (saved) { tryRestore(saved); } else { authStep.set('phone'); }

    const savedPasscode = localStorage.getItem('wa_passcode');
    if (savedPasscode) {
      try {
        const ps = JSON.parse(savedPasscode);
        passcodeSettings.set(ps);
        if (ps.enabled) appLocked.set(true);
      } catch {}
    }

    document.addEventListener('visibilitychange', handleVisibility);
    document.addEventListener('click', updateActivity);
  });

  function handleVisibility() {
    if (document.visibilityState === 'hidden') {
      localStorage.setItem('wa_last_activity', Date.now().toString());
    } else if (document.visibilityState === 'visible') {
      const ps = get(passcodeSettings);
      if (!ps.enabled) return;
      const last = parseInt(localStorage.getItem('wa_last_activity') || '0');
      const elapsed = (Date.now() - last) / 60000;
      if (elapsed >= ps.timeout) {
        appLocked.set(true);
        pinInput = '';
        lockError = '';
      }
    }
  }

  function updateActivity() {
    if (get(passcodeSettings).enabled) {
      localStorage.setItem('wa_last_activity', Date.now().toString());
    }
  }

  function unlock() {
    const ps = get(passcodeSettings);
    if (hashPin(pinInput) === ps.passcodeHash) {
      appLocked.set(false);
      pinInput = '';
      lockError = '';
    } else {
      lockError = 'PIN incorrecto';
    }
  }

  function hashPin(pin: string) {
    let h = 0;
    for (let i = 0; i < pin.length; i++) {
      h = ((h << 5) - h) + pin.charCodeAt(i);
      h |= 0;
    }
    return 'h' + Math.abs(h).toString(36);
  }

  $effect(() => {
    document.documentElement.setAttribute('data-theme', $theme);
  });

  $effect(() => {
    const p = $page.url.pathname;
    if ($authStep === 'main' && p === '/init') {
      goto('/', { replaceState: true });
    } else if ($authStep !== 'main' && $authStep !== 'loading' && p !== '/init' && p !== '/terms' && p !== '/privacy-policy') {
      goto('/init', { replaceState: true });
    }
  });

  function tryRestore(t: string) {
    const sk = createSocket(t);
    sk.connect();
    sk.emit('restore_session', { token: t }, (res: any) => {
      if (res.ok) {
        token.set(t);
        user.set(res.user);
        socket.set(sk);
        setupName.set(res.user.display_name);
        setupUser.set(res.user.username);
        setupBio.set(res.user.bio || '');
        displayName.set(res.user.display_name);
        username.set(res.user.username);
        bio.set(res.user.bio || '');
        initSocket(sk);
        authStep.set('main');
        requestPushSubscription();
      } else {
        sk.disconnect();
        localStorage.removeItem('wa_token');
        authStep.set('phone');
      }
    });
  }
</script>

{#if $appLocked && $authStep === 'main'}
  <div class="lock-screen">
    <div class="lock-content">
      <div class="lock-icon">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
      </div>
      <h2 class="lock-title">Vibe</h2>
      <p class="lock-subtitle">Ingresa tu PIN para desbloquear</p>
      <div class="lock-dots">
        {#each [0, 1, 2, 3, 4, 5] as i}
          <div class="dot" class:filled={pinInput.length > i}></div>
        {/each}
      </div>
      <div class="lock-numpad">
        {#each [1, 2, 3, 4, 5, 6, 7, 8, 9] as n}
          <button class="key" onclick={() => { if (pinInput.length < 6) { pinInput += n; lockError = ''; } }}>{n}</button>
        {/each}
        <button class="key" onclick={() => pinInput = pinInput.slice(0, -1)}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 18l6-6-6-6"/></svg>
        </button>
        <button class="key" onclick={() => { if (pinInput.length < 6) { pinInput += '0'; lockError = ''; } }}>0</button>
        <button class="key" onclick={unlock}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="3" stroke-linecap="round"><path d="M20 6L9 17l-5-5"/></svg>
        </button>
      </div>
      {#if lockError}
        <p class="lock-error">{lockError}</p>
      {/if}
    </div>
  </div>
{:else}
  {@render children()}
{/if}

<Toast />

<style>
  .lock-screen {
    position: fixed; inset: 0; background: var(--bg);
    display: flex; align-items: center; justify-content: center;
    z-index: 9999; animation: fadeIn 0.3s ease-out;
  }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  .lock-content { text-align: center; width: 100%; max-width: 320px; padding: 40px 24px; }
  .lock-icon { margin-bottom: 16px; }
  .lock-title { font-size: 24px; font-weight: 700; color: var(--text); margin-bottom: 4px; }
  .lock-subtitle { font-size: 14px; color: var(--text-2); margin-bottom: 28px; }
  .lock-dots { display: flex; justify-content: center; gap: 14px; margin-bottom: 32px; }
  .dot { width: 14px; height: 14px; border-radius: 50%; border: 2px solid var(--text-3); transition: all 0.2s; }
  .dot.filled { background: var(--accent); border-color: var(--accent); }
  .lock-numpad { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; max-width: 260px; margin: 0 auto; }
  .key { aspect-ratio: 1; border-radius: 50%; border: none; background: var(--bg-3); color: var(--text); font-size: 24px; font-weight: 500; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: background 0.15s; }
  .key:hover { background: #333; }
  .key:active { background: #444; }
  .lock-error { color: var(--danger); font-size: 13px; margin-top: 16px; }
</style>
