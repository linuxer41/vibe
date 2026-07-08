<script lang="ts">
  import { emit } from '$lib/socket';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { loadPosts, uploadViaSocket } from '$lib/helpers';
  import { user, showToast } from '$lib/stores';
  import type { User } from '$lib/types';
  import Icon from '$lib/icon/Icon.svelte';
  import MinimalLayout from '$lib/layouts/MinimalLayout.svelte';

  let usr: User | null = $state(null);
  user.subscribe((v) => usr = v);

  let caption = $state('');
  let publishing = $state(false);

  let imgDataUrl = $state('');
  let vidDataUrl = $state('');

  $effect(() => {
    const p = $page;
    if (p.url.searchParams.has('img')) {
      imgDataUrl = decodeURIComponent(p.url.searchParams.get('img') || '');
    }
    if (p.url.searchParams.has('vid')) {
      vidDataUrl = decodeURIComponent(p.url.searchParams.get('vid') || '');
    }
  });

  async function publish() {
    if (!caption.trim() && !imgDataUrl && !vidDataUrl) { showToast('Escribe algo o agrega un medio'); return; }
    publishing = true;
    showToast('Publicando...');
    try {
      let mediaUrl = '';
      let mediaType = 'text';
      if (imgDataUrl) {
        const raw = atob(imgDataUrl.split(',')[1] || '');
        const buf = new Uint8Array(raw.length);
        for (let i = 0; i < raw.length; i++) buf[i] = raw.charCodeAt(i);
        const r = await uploadViaSocket(null as any, { name: 'post.jpg', type: 'image/jpeg', data: buf.buffer }, () => {});
        if (r?.ok && r.url) { mediaUrl = r.url; mediaType = 'image'; }
        else { showToast('Error al subir imagen'); publishing = false; return; }
      } else if (vidDataUrl) {
        const resp = await fetch(vidDataUrl);
        const blob = await resp.blob();
        const r = await uploadViaSocket(null as any, { name: 'post.webm', type: 'video/webm', data: await blob.arrayBuffer() }, () => {});
        if (r?.ok && r.url) { mediaUrl = r.url; mediaType = 'video'; }
        else { showToast('Error al subir video'); publishing = false; return; }
      }
      const res = await emit('create_post', { text: caption, media: mediaUrl, mediaType });
      if (res?.ok) {
        caption = '';
        loadPosts();
        showToast(mediaType === 'video' ? 'Video publicado' : 'Post publicado');
        goto('/feed', { noScroll: true });
      } else {
        showToast('Error al publicar');
        publishing = false;
      }
    } catch { showToast('Error al publicar'); publishing = false; }
  }
</script>

<MinimalLayout>
<div class="post-create">
  <div class="create-header">
    <button class="back-btn" onclick={() => goto('/camera', { noScroll: true })}>
      <Icon name="chevron-left" size={24} />
    </button>
    <span class="create-title">Nuevo Post</span>
  </div>

  <div class="media-area">
    {#if imgDataUrl}
      <img src={imgDataUrl} alt="" class="media-preview" />
    {:else if vidDataUrl}
      <video src={vidDataUrl} autoplay muted loop playsinline class="media-preview"></video>
    {:else}
      <div class="media-placeholder">
        <button class="camera-goto-btn" onclick={() => goto('/camera', { noScroll: true })}>
          <Icon name="camera" size={56} strokeWidth={1.2} style="color: var(--text-3)" />
          <p>Abrir cámara</p>
        </button>
      </div>
    {/if}
  </div>

  <div class="text-area">
    <textarea bind:value={caption} placeholder="¿Qué estás pensando?" class="caption-input" maxlength="2000"></textarea>
  </div>

  <div class="bottom-bar">
    <div class="char-count">{caption.length}/2000</div>
    <button class="publish-btn" onclick={publish} disabled={!caption.trim() && !imgDataUrl && !vidDataUrl || publishing}>
      {publishing ? 'Publicando...' : 'Publicar'}
    </button>
  </div>
</div>
</MinimalLayout>

<style>
  .post-create {
    position: fixed; inset: 0; z-index: 200;
    background: var(--bg); display: flex; flex-direction: column;
  }
  .create-header {
    display: flex; align-items: center; gap: 12px; padding: 16px;
    background: var(--bg-2); border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }
  .back-btn {
    background: none; border: none; color: var(--text); cursor: pointer;
    padding: 4px; display: flex; border-radius: 50%;
  }
  .back-btn:hover { background: var(--bg-3); }
  .create-title { font-size: 17px; font-weight: 600; color: var(--text); }

  .media-area {
    flex: 1; display: flex; align-items: center; justify-content: center;
    background: #000; margin: 0; overflow: hidden; position: relative;
    min-height: 200px;
  }
  .media-preview {
    position: absolute; inset: 0; width: 100%; height: 100%;
    object-fit: contain;
  }
  .media-placeholder {
    display: flex; flex-direction: column; align-items: center;
  }
  .camera-goto-btn {
    background: none; border: none; cursor: pointer;
    display: flex; flex-direction: column; align-items: center; gap: 12px;
    padding: 24px; border-radius: 16px;
    transition: background 0.15s;
  }
  .camera-goto-btn:hover { background: rgba(255,255,255,0.05); }
  .camera-goto-btn p { color: var(--text-3); font-size: 14px; margin: 0; }

  .text-area {
    flex: 1; padding: 12px 16px;
    background: var(--bg);
  }
  .caption-input {
    width: 100%; height: 100%; min-height: 120px;
    background: none; border: none; outline: none;
    color: var(--text); font-size: 16px; line-height: 1.5;
    resize: none; font-family: inherit;
  }
  .caption-input::placeholder { color: var(--text-3); }

  .bottom-bar {
    display: flex; align-items: center; justify-content: space-between;
    padding: 12px 16px 32px; background: var(--bg-2);
    border-top: 1px solid var(--border); flex-shrink: 0;
  }
  .char-count { font-size: 12px; color: var(--text-3); }
  .publish-btn {
    padding: 12px 28px; background: var(--accent); color: #000;
    border: none; border-radius: 12px; font-size: 15px;
    font-weight: 700; cursor: pointer; font-family: inherit;
    transition: opacity 0.15s;
  }
  .publish-btn:disabled { opacity: 0.35; cursor: not-allowed; }
  .publish-btn:not(:disabled):active { transform: scale(0.97); }
</style>
