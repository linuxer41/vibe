<script lang="ts">
  import { emit } from '$lib/socket';
  import Icon from '$lib/icon/Icon.svelte';
  import { onMount } from 'svelte';
  import { avatarUrl, loadMemes } from '$lib/helpers';
  import { user, memes, showToast } from '$lib/stores';
  import type { User } from '$lib/types';

  let usr: User | null = $state(null);
  user.subscribe((v) => usr = v);

  let memeInput = $state({ imageUrl: '', caption: '', template: '' });

  onMount(() => { loadMemes(); });

  async function createMeme() {
    const m = memeInput;
    if (!m.imageUrl) return showToast('URL de imagen requerida');
    try {
      const res = await emit('create_meme', { imageUrl: m.imageUrl, caption: m.caption, template: m.template });
      if (res?.ok) { showToast('Meme creado'); memeInput = { imageUrl: '', caption: '', template: '' }; loadMemes(); }
    } catch {}
  }

  function likeMeme(memeId: number) { emit('like_meme', { memeId }); }
</script>

<div class="meme-create">
  <p class="create-title">Crear Meme</p>
  <input type="text" bind:value={memeInput.imageUrl} placeholder="URL de la imagen" class="modal-input" />
  <input type="text" bind:value={memeInput.caption} placeholder="Texto del meme" class="modal-input" />
  <input type="text" bind:value={memeInput.template} placeholder="Plantilla (opcional)" class="modal-input" />
  <button class="modal-btn" onclick={createMeme}><Icon name="plus" size={18} /> Crear Meme</button>
</div>
<div class="memes-feed">
  {#each $memes as m (m.id)}
    <div class="meme-card">
      <img src={m.image_url} alt={m.caption} class="meme-img" loading="lazy" />
      {#if m.caption}<p class="meme-caption">{m.caption}</p>{/if}
      <div class="meme-footer">
        <div class="meme-author">
          <img src={avatarUrl(m.user_id)} alt="" class="meme-avatar" />
          <span>{m.display_name}</span>
        </div>
        <button class="like-btn" onclick={() => likeMeme(m.id)}>
          <Icon name="thumbs-up" size={16} style="color: var(--danger)" />
          <span>{m.likes_count || 0}</span>
        </button>
      </div>
    </div>
  {/each}
  {#if $memes.length === 0}
    <div class="empty-state"><p>No hay memes aún</p></div>
  {/if}
</div>

<style>
  .meme-create { padding: 12px; border-bottom: 1px solid var(--border); }
  .create-title { font-size: 14px; font-weight: 600; color: var(--text); margin: 0 0 12px; }
  .modal-input { width: 100%; padding: 12px 16px; border: 2px solid var(--border); border-radius: 12px; font-size: 15px; outline: none; background: var(--bg-3); color: var(--text); margin-bottom: 12px; box-sizing: border-box; font-family: inherit; }
  .modal-btn { width: 100%; padding: 13px; background: var(--accent); color: #000; font-weight: 700; border: none; border-radius: 12px; font-size: 15px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; font-family: inherit; }
  .memes-feed { padding: 8px 12px; }
  .meme-card { margin-bottom: 12px; background: var(--bg-2); border-radius: 12px; overflow: hidden; }
  .meme-img { width: 100%; display: block; }
  .meme-caption { padding: 8px 12px; font-size: 14px; color: var(--text); font-weight: 500; }
  .meme-footer { display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; border-top: 1px solid var(--border); }
  .meme-author { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--text-2); }
  .meme-avatar { width: 20px; height: 20px; border-radius: 50%; object-fit: cover; }
  .like-btn { display: flex; align-items: center; gap: 4px; background: none; border: none; cursor: pointer; color: var(--danger); font-size: 12px; }
  .empty-state { display: flex; flex-direction: column; align-items: center; padding: 48px 24px; gap: 8px; }
  .empty-state p { color: var(--text-3); font-size: 14px; }
</style>
