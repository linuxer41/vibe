<script lang="ts">
  import { emit } from '$lib/socket';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { uploadViaSocket } from '$lib/helpers';
  import { user, showToast } from '$lib/stores';
  import type { User } from '$lib/types';
  import Icon from '$lib/icon/Icon.svelte';
  import MinimalLayout from '$lib/layouts/MinimalLayout.svelte';

  let usr: User | null = $state(null);
  user.subscribe((v) => usr = v);

  let publishing = $state(false);
  let mediaDataUrl = $state('');

  $effect(() => {
    const p = $page;
    if (p.url.searchParams.has('img')) {
      mediaDataUrl = decodeURIComponent(p.url.searchParams.get('img') || '');
    }
    if (p.url.searchParams.has('vid')) {
      mediaDataUrl = decodeURIComponent(p.url.searchParams.get('vid') || '');
    }
  });

  async function publish() {
    if (!mediaDataUrl) { showToast('No hay medio'); return; }
    publishing = true;
    showToast('Subiendo story...');
    try {
      let mediaUrl: string | null = null;
      const isVideo = !!$page.url.searchParams.has('vid');
      if (isVideo) {
        const resp = await fetch(mediaDataUrl);
        const blob = await resp.blob();
        const r = await uploadViaSocket(null as any, { name: 'story.webm', type: 'video/webm', data: await blob.arrayBuffer() }, () => {});
        if (r?.ok && r.url) mediaUrl = r.url;
      } else {
        const raw = atob(mediaDataUrl.split(',')[1] || '');
        const buf = new Uint8Array(raw.length);
        for (let i = 0; i < raw.length; i++) buf[i] = raw.charCodeAt(i);
        const r = await uploadViaSocket(null as any, { name: 'story.jpg', type: 'image/jpeg', data: buf.buffer }, () => {});
        if (r?.ok && r.url) mediaUrl = r.url;
      }
      if (mediaUrl) {
        const res = await emit('create_story', { media: mediaUrl });
        if (res?.ok) {
          showToast('Story publicada');
          goto('/feed', { noScroll: true });
        } else { showToast('Error al crear story'); }
        publishing = false;
      } else { showToast('Error al subir'); publishing = false; }
    } catch { showToast('Error al crear story'); publishing = false; }
  }
</script>

<MinimalLayout>
<div class="story-create">
  <div class="create-header">
    <button class="back-btn" onclick={() => goto('/camera', { noScroll: true })}>
      <Icon name="chevron-left" size={24} />
    </button>
    <span class="create-title">Nueva Historia</span>
  </div>

  <div class="media-area">
    {#if mediaDataUrl}
      {#if $page.url.searchParams.has('vid')}
        <video src={mediaDataUrl} autoplay muted loop playsinline class="media-preview"></video>
      {:else}
        <img src={mediaDataUrl} alt="" class="media-preview" />
      {/if}
    {:else}
      <div class="media-placeholder">
        <p class="no-media">No hay imagen capturada</p>
        <button class="camera-goto-btn" onclick={() => goto('/camera', { noScroll: true })}>
          <Icon name="camera" size={56} strokeWidth={1.2} style="color: var(--text-3)" />
          <p>Abrir cámara</p>
        </button>
      </div>
    {/if}
  </div>

  <div class="bottom-bar">
    <button class="publish-btn" onclick={publish} disabled={!mediaDataUrl || publishing}>
      {publishing ? 'Publicando...' : 'Publicar Historia'}
    </button>
  </div>
</div>
</MinimalLayout>

<style>
  .story-create {
    position: fixed; inset: 0; z-index: 200;
    background: #000; display: flex; flex-direction: column; color: #fff;
  }
  .create-header {
    position: absolute; top: 0; left: 0; right: 0; z-index: 10;
    display: flex; align-items: center; gap: 12px; padding: 16px;
    padding-top: env(safe-area-inset-top, 16px);
    background: linear-gradient(to bottom, rgba(0,0,0,0.8), transparent);
  }
  .back-btn {
    background: none; border: none; color: #fff; cursor: pointer;
    padding: 4px; display: flex; border-radius: 50%;
  }
  .create-title { font-size: 17px; font-weight: 600; }

  .media-area {
    flex: 1; display: flex; align-items: center; justify-content: center;
    overflow: hidden; position: relative;
  }
  .media-preview {
    position: absolute; inset: 0; width: 100%; height: 100%;
    object-fit: contain;
  }
  .media-placeholder {
    display: flex; flex-direction: column; align-items: center; gap: 16px;
  }
  .no-media { color: rgba(255,255,255,0.5); font-size: 14px; }
  .camera-goto-btn {
    background: none; border: none; cursor: pointer;
    display: flex; flex-direction: column; align-items: center; gap: 12px;
    padding: 24px; border-radius: 16px;
    transition: background 0.15s; color: #fff;
  }
  .camera-goto-btn:hover { background: rgba(255,255,255,0.1); }
  .camera-goto-btn p { font-size: 14px; margin: 0; }

  .bottom-bar {
    padding: 12px 16px calc(32px + env(safe-area-inset-bottom, 0px));
    display: flex; justify-content: center;
  }
  .publish-btn {
    width: 100%; max-width: 300px; padding: 14px;
    background: var(--accent); color: #000; border: none;
    border-radius: 12px; font-size: 16px; font-weight: 700;
    cursor: pointer; font-family: inherit;
    transition: opacity 0.15s;
  }
  .publish-btn:disabled { opacity: 0.4; cursor: default; }
  .publish-btn:not(:disabled):active { transform: scale(0.97); }
</style>
