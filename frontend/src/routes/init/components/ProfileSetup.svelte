<script lang="ts">
  import { get } from 'svelte/store';
  import Icon from '$lib/icon/Icon.svelte';
  import { createSocket } from '$lib/socket';
  import {
    socket, user, token, authError, setupName, setupUser, setupBio
  } from '$lib/stores';
  import { avatarUrl } from '$lib/helpers';

  let {
    onsaved
  }: {
    onsaved: () => void;
  } = $props();

  let setupAvatarPreview = $state<string | null>(null);
  let savingSetup = $state(false);

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

  function saveSetup() {
    const nm = get(setupName);
    const su = get(setupUser);
    const sb = get(setupBio);
    if (!nm.trim()) return;
    if (savingSetup) return;
    savingSetup = true;
    authError.set('');
    let s = get(socket);
    if (!s || !s.connected) { s = createSocket(get(token)); s.connect(); socket.set(s); }
    const usr = get(user);
    const fields: any = {};
    if (nm !== usr?.display_name || !usr?.display_name) fields.display_name = nm;
    if (su !== usr?.username) fields.username = su;
    if (sb !== (usr?.bio || '')) fields.bio = sb;
    if (setupAvatarPreview) fields.avatar = setupAvatarPreview;
    const done = () => { savingSetup = false; onsaved(); };
    if (Object.keys(fields).length > 0) {
      s.emit('update_profile', fields, () => {
        if (usr) { usr.display_name = nm; usr.username = su; usr.bio = sb; if (setupAvatarPreview) usr.avatar = setupAvatarPreview; user.set(usr); }
        done();
      });
    } else { done(); }
  }
</script>

<div class="init-form">
  <p class="init-subtitle">Tu perfil</p>
  <div class="setup-avatar-wrap" onclick={() => document.getElementById('setup-avatar-input')?.click()}>
    {#if setupAvatarPreview}
      <img src={setupAvatarPreview} alt="" class="setup-avatar-img" />
    {:else}
      <img src={avatarUrl($user?.id || 0, $user?.avatar)} alt="" class="setup-avatar-img" onerror={(e) => { const t = e.target as HTMLImageElement; t.style.display = 'none'; (t.nextElementSibling as HTMLElement).style.display = 'flex'; }} />
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

<style>
  .init-form {
    width: 100%; max-width: 380px;
  }
  .init-subtitle {
    font-size: 15px; color: var(--text-2); margin-bottom: 28px;
    text-align: center; line-height: 1.5;
  }
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
  .setup-username-text {
    text-align: center; font-size: 14px; color: var(--text-3);
    margin: -18px 0 24px; font-weight: 500;
  }
  .file-input { display: none; }
  .init-input {
    width: 100%; padding: 14px 16px;
    border: 2px solid var(--border); border-radius: 12px;
    font-size: 16px; margin-bottom: 14px; outline: none;
    background: var(--bg-3); color: var(--text);
    transition: border-color 0.2s; text-align: center;
    font-family: inherit; resize: vertical;
  }
  .init-input:focus { border-color: var(--accent); }
  .init-input::placeholder { color: var(--text-3); }
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
</style>
