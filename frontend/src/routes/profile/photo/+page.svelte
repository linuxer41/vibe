<script lang="ts">
  import { goto } from '$app/navigation';
  import { user, showToast } from '$lib/stores';
  import type { User } from '$lib/types';
  import { uploadViaSocket } from '$lib/helpers';
  import { emit } from '$lib/socket';
  import Icon from '$lib/icon/Icon.svelte';
  import CameraViewfinder from './components/CameraViewfinder.svelte';
  import ImageCropper from './components/ImageCropper.svelte';

  let usr: User | null = $state(null);
  let step: 'camera' | 'crop' = $state('camera');
  let imageDataUrl = $state('');
  let saving = $state(false);

  user.subscribe((v) => usr = v);

  let fileInput: HTMLInputElement | undefined = $state();

  function handleCapture(dataUrl: string) {
    imageDataUrl = dataUrl;
    step = 'crop';
  }

  function handleGallerySelected(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    input.value = '';
    const reader = new FileReader();
    reader.onload = () => {
      imageDataUrl = reader.result as string;
      step = 'crop';
    };
    reader.readAsDataURL(file);
  }

  function dataUrlToBlob(dataUrl: string): Blob {
    const parts = dataUrl.split(',');
    const mime = parts[0].match(/:(.*?);/)![1];
    const bytes = atob(parts[1]);
    const ab = new ArrayBuffer(bytes.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < bytes.length; i++) ia[i] = bytes.charCodeAt(i);
    return new Blob([ab], { type: mime });
  }

  async function handleSave(croppedDataUrl: string) {
    if (!usr || saving) return;
    saving = true;
    try {
      const blob = dataUrlToBlob(croppedDataUrl);
      const file = new File([blob], 'avatar.jpg', { type: 'image/jpeg' });
      const res = await uploadViaSocket(null, file);
      if (!res.ok || !res.url) { showToast('Error al subir imagen'); return; }
      await emit('update_profile', { avatar: res.url });
      user.set({ ...usr, avatar: res.url });
      showToast('Foto de perfil actualizada');
      goto('/profile');
    } catch {
      showToast('Error al subir imagen');
    } finally {
      saving = false;
    }
  }

  function handleRetake() {
    imageDataUrl = '';
    step = 'camera';
  }

  function openGallery() {
    fileInput?.click();
  }
</script>

<div class="photo-page">
  <div class="header">
    <button class="back-btn" onclick={() => goto('/profile')}>
      <Icon name="arrow-left" size={22} style="color:var(--text)" />
    </button>
    <h1 class="title">Foto de perfil</h1>
    <div style="width:40px"></div>
  </div>

  <div class="content">
    {#if step === 'camera'}
      <CameraViewfinder oncapture={handleCapture} />
      <div class="gallery-row">
        <button class="gallery-btn" onclick={openGallery}>
          <Icon name="image" size={20} variant="filled" style="color:var(--text-2)" />
          Subir de galería
        </button>
      </div>
    {:else}
      <ImageCropper {saving} src={imageDataUrl} onsave={handleSave} onretake={handleRetake} />
    {/if}
  </div>

  <input type="file" accept="image/*" bind:this={fileInput} onchange={handleGallerySelected} class="hidden-input" />
</div>

<style>
  .photo-page {
    display: flex; flex-direction: column; height: 100%;
    background: var(--bg);
  }
  .header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 12px 16px; flex-shrink: 0;
  }
  .back-btn {
    width: 40px; height: 40px; border-radius: 50%;
    background: none; border: none; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    transition: background 0.15s;
  }
  .back-btn:hover { background: var(--bg-3); }
  .title { font-size: 17px; font-weight: 700; color: var(--text); }
  .content { flex: 1; display: flex; flex-direction: column; padding: 0 0 16px; }
  .gallery-row { padding: 16px 20px 0; }
  .gallery-btn {
    width: 100%; padding: 14px; border-radius: 12px;
    background: var(--bg-3); border: none; cursor: pointer;
    font-size: 15px; color: var(--text); display: flex;
    align-items: center; justify-content: center; gap: 8px;
    transition: background 0.15s;
  }
  .gallery-btn:hover { background: var(--border); }
  .hidden-input { display: none; }
</style>
