<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { loadMyStickers } from '$lib/helpers';
  import { user, socket, stickerPacks, myStickers, showToast } from '$lib/stores';
  import type { User, StickerPack, Sticker } from '$lib/types';

  let usr: User | null = $state(null);
  let sk: any = $state(null);
  let packs: StickerPack[] = $state([]);
  let myStkr: Sticker[] = $state([]);
  let activeTab: 'shop' | 'mine' = $state('shop');
  let packStickers: Map<number, Sticker[]> = $state(new Map());
  let loadingPacks = $state<Set<number>>(new Set());

  user.subscribe((v) => usr = v);
  socket.subscribe((v) => sk = v);
  stickerPacks.subscribe((v) => packs = v);
  myStickers.subscribe((v) => myStkr = v);

  onMount(() => {
    sk?.emit('get_sticker_packs', (list: StickerPack[]) => stickerPacks.set(list || []));
    loadMyStickers();
  });

  function loadPackStickers(packId: number) {
    if (packStickers.has(packId)) return;
    loadingPacks.update((s) => { s.add(packId); return s; });
    sk?.emit('get_stickers', { packId }, (list: Sticker[]) => {
      packStickers.update((m) => { m.set(packId, list || []); return m; });
      loadingPacks.update((s) => { s.delete(packId); return s; });
    });
  }

  function buyPack(packId: number) {
    sk?.emit('purchase_sticker', { packId }, (res: any) => {
      if (res?.ok) {
        showToast('Pack comprado');
        loadMyStickers();
      } else {
        showToast('Error al comprar el pack', 'error');
      }
    });
  }

  function isOwned(packId: number): boolean {
    return myStkr.some((s) => s.pack_id === packId);
  }

  function switchTab(tab: 'shop' | 'mine') {
    activeTab = tab;
    if (tab === 'mine') loadMyStickers();
  }
</script>

<div class="shop-view">
  <div class="shop-header">
    <button class="back-btn" onclick={() => goto('/chat')}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="15 18 9 12 15 6"/></svg>
    </button>
    <span class="shop-title">Tienda de Stickers</span>
  </div>

  <div class="shop-tabs">
    <button class="shop-tab" class:active={activeTab === 'shop'} onclick={() => switchTab('shop')}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
      Tienda
    </button>
    <button class="shop-tab" class:active={activeTab === 'mine'} onclick={() => switchTab('mine')}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21a5 5 0 0 0 5-5V8a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h11z"/><path d="M9 14a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/></svg>
      Mis Stickers
    </button>
  </div>

  {#if activeTab === 'shop'}
    <div class="packs-list">
      {#each packs as pack (pack.id)}
        <div class="pack-card" onmouseenter={() => loadPackStickers(pack.id)}>
          <div class="pack-card-header">
            <div class="pack-info">
              <span class="pack-name">{pack.name}</span>
              <span class="pack-author">por {pack.display_name || 'Anónimo'}</span>
            </div>
            <div class="pack-price-tag">
              {#if pack.price > 0}
                <span class="pack-price">${pack.price}</span>
              {:else}
                <span class="pack-free-badge">Gratis</span>
              {/if}
            </div>
          </div>

          <div class="pack-previews">
            {#if loadingPacks.has(pack.id)}
              <div class="pack-loading">Cargando...</div>
            {:else}
              {#each packStickers.get(pack.id)?.slice(0, 4) || [] as st (st.id)}
                <img src={st.image_url} alt={st.emoji} class="pack-preview" loading="lazy" />
              {/each}
              {#if (packStickers.get(pack.id)?.length || 0) === 0 && !loadingPacks.has(pack.id)}
                <span class="pack-no-stickers">Vista previa no disponible</span>
              {/if}
            {/if}
          </div>

          {#if isOwned(pack.id)}
            <button class="pack-btn owned" disabled>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              Adquirido
            </button>
          {:else}
            <button class="pack-btn buy" onclick={() => buyPack(pack.id)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
              {pack.price > 0 ? `Comprar $${pack.price}` : 'Obtener gratis'}
            </button>
          {/if}
        </div>
      {/each}
      {#if packs.length === 0}
        <div class="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" stroke-width="1.5"><path d="M16 21a5 5 0 0 0 5-5V8a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h11z"/><path d="M9 14a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/></svg>
          <p>No hay packs disponibles</p>
        </div>
      {/if}
    </div>

  {:else}
    <div class="my-stickers-grid">
      {#each myStkr as s (s.id)}
        <div class="my-sticker-cell">
          <img src={s.image_url} alt={s.emoji} class="my-sticker-img" loading="lazy" />
          {#if s.pack_name}
            <span class="my-sticker-label">{s.pack_name}</span>
          {/if}
        </div>
      {/each}
      {#if myStkr.length === 0}
        <div class="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" stroke-width="1.5"><path d="M16 21a5 5 0 0 0 5-5V8a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h11z"/><path d="M9 14a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/></svg>
          <p>No tienes stickers aún</p>
          <button class="shop-link-btn" onclick={() => activeTab = 'shop'}>Ir a la tienda</button>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .shop-view { flex: 1; overflow-y: auto; padding-bottom: 80px; }
  .shop-header { display: flex; align-items: center; gap: 10px; padding: 10px 12px; background: var(--bg-2); border-bottom: 1px solid var(--border); flex-shrink: 0; }
  .back-btn { background: none; border: none; color: var(--text); cursor: pointer; padding: 4px; display: flex; border-radius: 50%; }
  .back-btn:hover { background: rgba(255,255,255,0.08); }
  .shop-title { font-size: 17px; font-weight: 700; color: var(--text); }
  .shop-tabs { display: flex; gap: 2px; padding: 8px 12px; background: var(--bg-2); border-bottom: 1px solid var(--border); }
  .shop-tab { flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px; padding: 8px 6px; background: none; border: none; color: var(--text-3); font-size: 12px; font-weight: 500; cursor: pointer; border-radius: 8px; transition: all 0.2s; }
  .shop-tab.active { background: var(--accent); color: #000; font-weight: 600; }

  .packs-list { padding: 12px; }
  .pack-card { background: var(--bg-2); border-radius: 16px; padding: 16px; margin-bottom: 12px; }
  .pack-card-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 12px; }
  .pack-info { flex: 1; }
  .pack-name { font-size: 16px; font-weight: 700; color: var(--text); display: block; }
  .pack-author { font-size: 12px; color: var(--text-3); }
  .pack-price-tag { flex-shrink: 0; }
  .pack-price { font-size: 18px; font-weight: 800; color: var(--accent); }
  .pack-free-badge { font-size: 12px; font-weight: 600; color: #22c55e; background: rgba(34,197,94,0.15); padding: 4px 10px; border-radius: 6px; }
  .pack-previews { display: flex; gap: 8px; margin-bottom: 12px; min-height: 60px; align-items: center; }
  .pack-preview { width: 60px; height: 60px; border-radius: 10px; object-fit: cover; background: var(--bg-3); }
  .pack-loading { font-size: 12px; color: var(--text-3); padding: 8px 0; }
  .pack-no-stickers { font-size: 12px; color: var(--text-3); font-style: italic; }
  .pack-btn {
    width: 100%; padding: 11px; border-radius: 10px; border: none;
    font-size: 14px; font-weight: 600; cursor: pointer; display: flex;
    align-items: center; justify-content: center; gap: 6px;
    transition: opacity 0.15s; font-family: inherit;
  }
  .pack-btn.buy { background: var(--accent); color: #000; }
  .pack-btn.owned { background: var(--bg-3); color: var(--text-3); cursor: default; }

  .my-stickers-grid {
    padding: 12px; display: flex; flex-wrap: wrap; gap: 8px;
  }
  .my-sticker-cell {
    width: calc(25% - 6px); display: flex; flex-direction: column;
    align-items: center; gap: 4px;
  }
  .my-sticker-img {
    width: 100%; aspect-ratio: 1; object-fit: contain;
    background: var(--bg-3); border-radius: 12px; padding: 6px;
  }
  .my-sticker-label { font-size: 10px; color: var(--text-3); text-align: center; word-break: break-all; }
  .empty-state { display: flex; flex-direction: column; align-items: center; padding: 48px 24px; gap: 12px; width: 100%; }
  .empty-state p { color: var(--text-3); font-size: 14px; }
  .shop-link-btn { padding: 10px 20px; background: var(--accent); color: #000; border: none; border-radius: 10px; font-size: 14px; font-weight: 600; cursor: pointer; font-family: inherit; }
</style>
