<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { avatarUrl, formatDate, formatPrice, loadProducts, loadFlashDeals, loadOrders, loadWishlists } from '$lib/helpers';
  import { user, socket, products, flashDeals, myOrders, wishlists, showToast } from '$lib/stores';
  import type { User, Product, FlashDeal } from '$lib/types';

  let usr: User | null = $state(null);
  let sk: any = $state(null);
  let activeTab: 'shop' | 'deals' | 'orders' | 'sell' = $state('shop');
  let category = $state('');
  let newProduct = $state({ name: '', description: '', price: '', images: '', category: '', stock: '' });
  let wishlistName = $state('');

  user.subscribe((v) => usr = v);
  socket.subscribe((v) => sk = v);

  onMount(() => { loadProducts(); loadFlashDeals(); loadOrders(); loadWishlists(); });

  function createProduct() {
    const p = newProduct;
    if (!p.name || !p.price) return showToast('Nombre y precio requeridos');
    sk?.emit('create_product', {
      name: p.name, description: p.description,
      price: parseFloat(p.price), images: p.images,
      category: p.category, stock: parseInt(p.stock) || 0
    }, (res: any) => {
      if (res?.ok) { showToast('Producto creado'); newProduct = { name: '', description: '', price: '', images: '', category: '', stock: '' }; loadProducts(); }
    });
  }

  function buyProduct(productId: number) {
    sk?.emit('buy_product', { productId, quantity: 1 }, (res: any) => {
      if (res?.ok) { showToast('Compra realizada'); loadOrders(); }
    });
  }

  function createWishlist() {
    if (!wishlistName) return;
    sk?.emit('create_wishlist', { name: wishlistName }, (res: any) => {
      if (res?.ok) { wishlistName = ''; loadWishlists(); showToast('Lista creada'); }
    });
  }

  function addToWishlist(wishlistId: number, productId: number) {
    sk?.emit('add_to_wishlist', { wishlistId, productId }, (res: any) => {
      if (res?.ok) showToast('Añadido a lista de deseos');
    });
  }
</script>

<div class="shop-view">
  <!-- Tabs -->
  <div class="shop-tabs">
    <button class="shop-tab" class:active={activeTab === 'shop'} onclick={() => activeTab = 'shop'}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0"/></svg>
      Tienda
    </button>
    <button class="shop-tab" class:active={activeTab === 'deals'} onclick={() => activeTab = 'deals'}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
      Ofertas
    </button>
    <button class="shop-tab" class:active={activeTab === 'orders'} onclick={() => activeTab = 'orders'}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2M9 5h6"/></svg>
      Pedidos
    </button>
    <button class="shop-tab" class:active={activeTab === 'sell'} onclick={() => activeTab = 'sell'}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
      Vender
    </button>
  </div>

  {#if activeTab === 'shop'}
    <!-- Products Grid -->
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
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
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
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
              </button>
            {/each}
          </div>
        </div>
      {/each}
      {#if $products.length === 0}
        <div class="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" stroke-width="1.5"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0"/></svg>
          <p>No hay productos aún</p>
        </div>
      {/if}
    </div>

  {:else if activeTab === 'deals'}
    <!-- Flash Deals -->
    <div class="deals-list">
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

    <!-- Wishlists -->
    <div class="wishlists-section">
      <h3 class="section-title">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
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

  {:else if activeTab === 'orders'}
    <!-- Orders -->
    <div class="orders-list">
      {#each $myOrders as o (o.id)}
        <div class="order-card">
          <div class="order-info">
            <span class="order-product">{o.name || `Producto #${o.product_id}`}</span>
            <span class="order-qty">x{o.quantity}</span>
            <span class="order-total">{formatPrice(o.total)}</span>
            <span class="order-status" class:paid={o.status === 'paid'} class:shipped={o.status === 'shipped'}>{o.status}</span>
          </div>
          <span class="order-date">{formatDate(o.created_at)}</span>
        </div>
      {/each}
      {#if $myOrders.length === 0}
        <div class="empty-state">
          <p>No hay pedidos</p>
        </div>
      {/if}
    </div>

  {:else if activeTab === 'sell'}
    <!-- Sell Product -->
    <div class="sell-form">
      <input type="text" bind:value={newProduct.name} placeholder="Nombre del producto" class="modal-input" />
      <textarea bind:value={newProduct.description} placeholder="Descripción" class="modal-input" rows={3}></textarea>
      <input type="number" bind:value={newProduct.price} placeholder="Precio" class="modal-input" step="0.01" />
      <input type="text" bind:value={newProduct.images} placeholder="URLs de imágenes (separadas por coma)" class="modal-input" />
      <select bind:value={newProduct.category} class="modal-input">
        <option value="">Categoría</option>
        <option value="ropa">Ropa</option>
        <option value="electronica">Electrónica</option>
        <option value="hogar">Hogar</option>
        <option value="otros">Otros</option>
      </select>
      <input type="number" bind:value={newProduct.stock} placeholder="Stock" class="modal-input" />
      <button class="modal-btn" onclick={createProduct}>Publicar producto</button>
    </div>
  {/if}
</div>

<style>
  .shop-view { flex: 1; overflow-y: auto; padding-bottom: 80px; }
  .shop-tabs { display: flex; gap: 2px; padding: 8px 12px; background: var(--bg-2); border-bottom: 1px solid var(--border); overflow-x: auto; }
  .shop-tab { flex: 1; display: flex; align-items: center; justify-content: center; gap: 4px; padding: 8px 6px; background: none; border: none; color: var(--text-3); font-size: 11px; font-weight: 500; cursor: pointer; border-radius: 8px; transition: all 0.2s; white-space: nowrap; }
  .shop-tab.active { background: var(--accent); color: #000; font-weight: 600; }
  .category-filter { display: flex; gap: 4px; padding: 8px 12px; overflow-x: auto; }
  .cat-btn { padding: 6px 14px; border-radius: 20px; border: none; background: var(--bg-3); color: var(--text-2); font-size: 12px; cursor: pointer; white-space: nowrap; transition: all 0.15s; }
  .cat-btn.active { background: var(--accent); color: #000; font-weight: 600; }
  .products-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; padding: 8px 12px; }
  .product-card { background: var(--bg-2); border-radius: 12px; overflow: hidden; }
  .product-img-wrap { aspect-ratio: 1; background: var(--bg-3); display: flex; align-items: center; justify-content: center; overflow: hidden; }
  .product-img { width: 100%; height: 100%; object-fit: cover; }
  .product-placeholder { opacity: 0.3; }
  .product-info { padding: 8px; }
  .product-name { display: block; font-size: 12px; font-weight: 500; color: var(--text); margin-bottom: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .product-price { display: block; font-size: 14px; font-weight: 700; color: var(--accent); }
  .product-stock { font-size: 10px; color: var(--text-3); }
  .product-stock.out { color: var(--danger); }
  .product-actions { display: flex; align-items: center; gap: 4px; padding: 0 8px 8px; }
  .small-btn { padding: 6px 12px; background: var(--accent); color: #000; font-weight: 600; border: none; border-radius: 6px; font-size: 11px; cursor: pointer; flex: 1; }
  .small-btn:disabled { opacity: 0.4; }
  .icon-sm { background: none; border: none; cursor: pointer; padding: 4px; }
  .empty-state { grid-column: 1/-1; display: flex; flex-direction: column; align-items: center; padding: 48px 24px; gap: 8px; }
  .empty-state p { color: var(--text-3); font-size: 14px; }
  .deals-list { padding: 8px 12px; }
  .deal-card { display: flex; align-items: center; gap: 12px; padding: 12px; background: var(--bg-2); border-radius: 12px; margin-bottom: 8px; }
  .deal-badge { background: #ef4444; color: #fff; font-size: 13px; font-weight: 700; padding: 4px 8px; border-radius: 6px; flex-shrink: 0; }
  .deal-info { flex: 1; }
  .deal-name { display: block; font-size: 14px; font-weight: 600; color: var(--text); }
  .deal-price { display: flex; align-items: center; gap: 6px; }
  .deal-original { font-size: 12px; color: var(--text-3); text-decoration: line-through; }
  .deal-final { font-size: 16px; font-weight: 700; color: var(--accent); }
  .deal-timer { font-size: 10px; color: #ef4444; }
  .section-title { display: flex; align-items: center; gap: 6px; font-size: 14px; font-weight: 600; color: var(--text); padding: 12px 12px 8px; margin: 0; }
  .wishlists-section { border-top: 1px solid var(--border); margin-top: 8px; }
  .wishlist-input { display: flex; gap: 8px; padding: 0 12px 8px; }
  .wishlist-input input { flex: 1; padding: 8px 12px; border-radius: 8px; border: none; background: var(--bg-3); color: var(--text); font-size: 13px; }
  .wishlist-card { display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; border-bottom: 1px solid var(--border-2); }
  .wl-name { font-size: 14px; font-weight: 500; color: var(--text); }
  .wl-count { font-size: 12px; color: var(--text-3); }
  .orders-list { padding: 8px 12px; }
  .order-card { display: flex; align-items: center; justify-content: space-between; padding: 12px; background: var(--bg-2); border-radius: 12px; margin-bottom: 8px; }
  .order-info { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .order-product { font-size: 14px; font-weight: 600; color: var(--text); }
  .order-qty { font-size: 12px; color: var(--text-3); }
  .order-total { font-size: 14px; font-weight: 700; color: var(--accent); }
  .order-status { font-size: 10px; padding: 2px 8px; border-radius: 4px; background: var(--bg-3); color: var(--text-2); text-transform: uppercase; font-weight: 600; }
  .order-status.paid { background: rgba(34,197,94,0.2); color: var(--accent); }
  .order-status.shipped { background: rgba(59,130,246,0.2); color: #3b82f6; }
  .order-date { font-size: 11px; color: var(--text-3); }
  .sell-form { padding: 12px; }
  .modal-input { width: 100%; padding: 14px 16px; border: 2px solid rgba(255,255,255,0.08); border-radius: 12px; font-size: 15px; outline: none; background: var(--bg-3); color: var(--text); margin-bottom: 14px; transition: border-color 0.2s; box-sizing: border-box; }
  .modal-input:focus { border-color: var(--accent); }
  .modal-input::placeholder { color: var(--text-3); }
  select.modal-input { appearance: auto; }
  textarea.modal-input { resize: vertical; font-family: inherit; }
  .modal-btn { width: 100%; padding: 13px; background: var(--accent); color: #000; font-weight: 700; border: none; border-radius: 12px; font-size: 15px; cursor: pointer; }
</style>
