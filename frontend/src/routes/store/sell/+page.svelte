<script lang="ts">
  import { emit } from '$lib/socket';
  import { loadProducts } from '$lib/helpers';
  import { user, showToast } from '$lib/stores';
  import type { User } from '$lib/types';
  import Icon from '$lib/icon/Icon.svelte';

  let usr: User | null = $state(null);
  let newProduct = $state({ name: '', description: '', price: '', images: '', category: '', stock: '' });

  user.subscribe((v) => usr = v);

  async function createProduct() {
    const p = newProduct;
    if (!p.name || !p.price) return showToast('Nombre y precio requeridos');
    try {
      const res = await emit('create_product', {
        name: p.name, description: p.description,
        price: parseFloat(p.price), images: p.images,
        category: p.category, stock: parseInt(p.stock) || 0
      });
      if (res?.ok) { showToast('Producto creado'); newProduct = { name: '', description: '', price: '', images: '', category: '', stock: '' }; loadProducts(); }
    } catch {}
  }
</script>

<div class="sell-form">
  <p class="sell-intro">Publica tu producto en la tienda</p>
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
  <button class="modal-btn" onclick={createProduct}>
    <Icon name="plus" size={18} />
    Publicar producto
  </button>
</div>

<style>
  .sell-form { padding: 12px; max-width: 400px; margin: 0 auto; }
  .sell-intro { font-size: 14px; color: var(--text-2); margin-bottom: 20px; text-align: center; }
  .modal-input { width: 100%; padding: 14px 16px; border: 2px solid var(--border); border-radius: 12px; font-size: 15px; outline: none; background: var(--bg-3); color: var(--text); margin-bottom: 14px; transition: border-color 0.2s; box-sizing: border-box; font-family: inherit; }
  .modal-input:focus { border-color: var(--accent); }
  .modal-input::placeholder { color: var(--text-3); }
  select.modal-input { appearance: auto; }
  textarea.modal-input { resize: vertical; }
  .modal-btn { width: 100%; padding: 14px; background: var(--accent); color: #000; font-weight: 700; border: none; border-radius: 12px; font-size: 16px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; }
</style>
