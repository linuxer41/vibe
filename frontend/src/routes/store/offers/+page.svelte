<script lang="ts">
  import { emit } from '$lib/socket';
  import { onMount } from 'svelte';
  import { formatPrice, loadFlashDeals, loadWishlists } from '$lib/helpers';
  import { user, flashDeals, wishlists, showToast } from '$lib/stores';
  import type { User } from '$lib/types';
  import Icon from '$lib/icon/Icon.svelte';

  let usr: User | null = $state(null);
  let wishlistName = $state('');

  user.subscribe((v) => usr = v);

  onMount(() => { loadFlashDeals(); loadWishlists(); });

  async function buyProduct(productId: number) {
    try {
      const res = await emit('buy_product', { productId, quantity: 1 });
      if (res?.ok) showToast('Compra realizada');
    } catch {}
  }

  async function createWishlist() {
    if (!wishlistName) return;
    try {
      const res = await emit('create_wishlist', { name: wishlistName });
      if (res?.ok) { wishlistName = ''; loadWishlists(); showToast('Lista creada'); }
    } catch {}
  }
</script>

<div class="deals-list">
  <h3 class="section-title">
    <Icon name="sun" size={16} style="color: var(--accent)" />
    Ofertas relámpago
  </h3>
  {#each $flashDeals as d (d.id)}
    <div class="deal-card">
      <div class="deal-badge">-{d.discount_percent}%</div>
      <div class="deal-info">
        <span class="deal-name">{d.name}</span>
        <span class="deal-price">
          <span class="deal-original">{formatPrice(d.price || 0)}</span>
          <span class="deal-final">{formatPrice((d.price || 0) * (1 - (d.discount_percent || 0) / 100))}</span>
        </span>
        <span class="deal-timer">🔥 Oferta por tiempo limitado</span>
      </div>
      <button class="small-btn" onclick={() => buyProduct(d.product_id)}>Comprar</button>
    </div>
  {/each}
  {#if $flashDeals.length === 0}
    <div class="empty-state">
      <p>No hay ofertas activas</p>
    </div>
  {/if}
</div>

<div class="wishlists-section">
  <h3 class="section-title">
    <Icon name="heart" size={16} style="color: var(--accent)" />
    Listas de deseos
  </h3>
  <div class="wishlist-input">
    <input type="text" bind:value={wishlistName} placeholder="Nombre de lista..." />
    <button class="small-btn" onclick={createWishlist}>Crear</button>
  </div>
  {#each $wishlists as wl}
    <div class="wishlist-card">
      <span class="wl-name">{wl.name}</span>
      <span class="wl-count">{wl.items?.length || 0} items</span>
    </div>
  {/each}
</div>

<style>
  .deals-list { padding: 8px 12px; }
  .section-title { display: flex; align-items: center; gap: 6px; font-size: 15px; font-weight: 700; color: var(--text); padding: 12px 0 8px; margin: 0; }
  .deal-card { display: flex; align-items: center; gap: 12px; padding: 14px; background: var(--bg-2); border-radius: 12px; margin-bottom: 8px; }
  .deal-badge { background: #ef4444; color: #fff; font-size: 14px; font-weight: 700; padding: 6px 10px; border-radius: 8px; flex-shrink: 0; }
  .deal-info { flex: 1; }
  .deal-name { display: block; font-size: 15px; font-weight: 600; color: var(--text); }
  .deal-price { display: flex; align-items: center; gap: 6px; }
  .deal-original { font-size: 13px; color: var(--text-3); text-decoration: line-through; }
  .deal-final { font-size: 17px; font-weight: 700; color: var(--accent); }
  .deal-timer { font-size: 11px; color: #ef4444; }
  .small-btn { padding: 8px 16px; background: var(--accent); color: #000; font-weight: 700; border: none; border-radius: 8px; font-size: 12px; cursor: pointer; flex-shrink: 0; }
  .empty-state { display: flex; flex-direction: column; align-items: center; padding: 48px 24px; gap: 8px; }
  .empty-state p { color: var(--text-3); font-size: 14px; }
  .wishlists-section { border-top: 1px solid var(--border); padding: 0 12px; }
  .wishlist-input { display: flex; gap: 8px; padding: 8px 0; }
  .wishlist-input input { flex: 1; padding: 10px 14px; border-radius: 10px; border: none; background: var(--bg-3); color: var(--text); font-size: 14px; }
  .wishlist-card { display: flex; align-items: center; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid var(--border-2); }
  .wl-name { font-size: 15px; font-weight: 500; color: var(--text); }
  .wl-count { font-size: 12px; color: var(--text-3); }
</style>
