<script lang="ts">
  import { onMount } from 'svelte';
  import { formatDate, formatPrice, loadOrders } from '$lib/helpers';
  import { myOrders } from '$lib/stores';
  import Icon from '$lib/icon/Icon.svelte';

  onMount(() => { loadOrders(); });
</script>

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
      <Icon name="document" size={48} strokeWidth={1.5} style="color: var(--text-3)" />
      <p>No hay pedidos</p>
    </div>
  {/if}
</div>

<style>
  .orders-list { padding: 12px; }
  .order-card { display: flex; align-items: center; justify-content: space-between; padding: 14px; background: var(--bg-2); border-radius: 12px; margin-bottom: 8px; }
  .order-info { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .order-product { font-size: 15px; font-weight: 600; color: var(--text); }
  .order-qty { font-size: 13px; color: var(--text-3); }
  .order-total { font-size: 15px; font-weight: 700; color: var(--accent); }
  .order-status { font-size: 10px; padding: 3px 10px; border-radius: 6px; background: var(--bg-3); color: var(--text-2); text-transform: uppercase; font-weight: 700; }
  .order-status.paid { background: rgba(var(--accent-rgb),0.2); color: var(--accent); }
  .order-status.shipped { background: rgba(59,130,246,0.2); color: #3b82f6; }
  .order-date { font-size: 11px; color: var(--text-3); }
  .empty-state { display: flex; flex-direction: column; align-items: center; padding: 48px 24px; gap: 8px; }
  .empty-state p { color: var(--text-3); font-size: 14px; }
</style>
