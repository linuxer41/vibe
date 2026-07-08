<script lang="ts">
  import { emit } from '$lib/socket';
  import { onMount } from 'svelte';
  import { avatarUrl, formatPrice, loadProducts, loadFlashDeals, loadOrders, loadWishlists } from '$lib/helpers';
  import { user, products, flashDeals, myOrders, wishlists, showToast } from '$lib/stores';
  import type { User } from '$lib/types';
  import Icon from '$lib/icon/Icon.svelte';

  let usr: User | null = $state(null);
  let category = $state('');

  user.subscribe((v) => usr = v);

  onMount(() => { loadProducts(); loadFlashDeals(); loadOrders(); loadWishlists(); });

  async function buyProduct(productId: number) {
    try {
      const res = await emit('buy_product', { productId, quantity: 1 });
      if (res?.ok) { showToast('Compra realizada'); loadOrders(); }
    } catch {}
  }

  async function addToWishlist(wishlistId: number, productId: number) {
    try {
      const res = await emit('add_to_wishlist', { wishlistId, productId });
      if (res?.ok) showToast('Añadido a lista de deseos');
    } catch {}
  }
</script>

<div class="category-filter">
  <button class="cat-btn" class:active={!category} onclick={() => { category = ''; loadProducts(''); }}>Todos</button>
  <button class="cat-btn" class:active={category === 'ropa'} onclick={() => { category = 'ropa'; loadProducts('ropa'); }}>Ropa</button>
  <button class="cat-btn" class:active={category === 'electronica'} onclick={() => { category = 'electronica'; loadProducts('electronica'); }}>Electrónica</button>
  <button class="cat-btn" class:active={category === 'hogar'} onclick={() => { category = 'hogar'; loadProducts('hogar'); }}>Hogar</button>
  <button class="cat-btn" class:active={category === 'otros'} onclick={() => { category = 'otros'; loadProducts('otros'); }}>Otros</button>
</div>
<div class="products-grid">
  {#each $products as p (p.id)}
    <div class="product-card">
      <div class="product-img-wrap">
        {#if p.images}
          <img src={p.images.split(',')[0]} alt={p.name} class="product-img" />
        {:else}
          <div class="product-placeholder">
            <Icon name="image" size={32} strokeWidth={1.5} style="color: var(--text-3)" />
          </div>
        {/if}
      </div>
      <div class="product-info">
        <span class="product-name">{p.name}</span>
        <span class="product-price">{formatPrice(p.price)}</span>
        {#if p.stock > 0}<span class="product-stock">{p.stock} disp.</span>{:else}<span class="product-stock out">Agotado</span>{/if}
      </div>
      <div class="product-actions">
        <button class="small-btn" onclick={() => buyProduct(p.id)} disabled={p.stock <= 0}>Comprar</button>
        {#each $wishlists as wl}
          <button class="icon-sm" onclick={() => addToWishlist(wl.id, p.id)} title="Añadir a {wl.name}">
            <Icon name="heart" size={16} style="color: var(--accent)" />
          </button>
        {/each}
      </div>
    </div>
  {/each}
  {#if $products.length === 0}
    <div class="empty-state">
      <Icon name="shop" size={48} strokeWidth={1.5} style="color: var(--text-3)" />
      <p>No hay productos aún</p>
    </div>
  {/if}
</div>

<style>
  .category-filter { display: flex; gap: 4px; padding: 8px 12px; overflow-x: auto; }
  .cat-btn { padding: 8px 18px; border-radius: 20px; border: none; background: var(--bg-3); color: var(--text-2); font-size: 13px; font-weight: 600; cursor: pointer; white-space: nowrap; transition: all 0.15s; }
  .cat-btn.active { background: var(--accent); color: #000; font-weight: 700; }
  .products-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; padding: 8px 12px; }
  .product-card { background: var(--bg-2); border-radius: 12px; overflow: hidden; }
  .product-img-wrap { aspect-ratio: 1; background: var(--bg-3); display: flex; align-items: center; justify-content: center; overflow: hidden; }
  .product-img { width: 100%; height: 100%; object-fit: cover; }
  .product-placeholder { opacity: 0.3; }
  .product-info { padding: 10px; }
  .product-name { display: block; font-size: 13px; font-weight: 500; color: var(--text); margin-bottom: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .product-price { display: block; font-size: 15px; font-weight: 700; color: var(--accent); }
  .product-stock { font-size: 11px; color: var(--text-3); }
  .product-stock.out { color: var(--danger); }
  .product-actions { display: flex; align-items: center; gap: 4px; padding: 0 10px 10px; }
  .small-btn { padding: 8px 14px; background: var(--accent); color: #000; font-weight: 700; border: none; border-radius: 8px; font-size: 12px; cursor: pointer; flex: 1; }
  .small-btn:disabled { opacity: 0.4; }
  .icon-sm { background: none; border: none; cursor: pointer; padding: 4px; }
  .empty-state { grid-column: 1/-1; display: flex; flex-direction: column; align-items: center; padding: 48px 24px; gap: 8px; }
  .empty-state p { color: var(--text-3); font-size: 14px; }
</style>
