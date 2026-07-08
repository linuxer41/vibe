<script lang="ts">
  import { goto } from '$app/navigation';
  import Icon from '$lib/icon/Icon.svelte';
  import type { Sticker } from '$lib/types';

  let {
    show,
    stickers,
    onclose,
    onSelect
  }: {
    show: boolean;
    stickers: Sticker[];
    onclose: () => void;
    onSelect: (s: Sticker) => void;
  } = $props();
</script>

{#if show}
  <div class="sticker-overlay" onclick={onclose}>
    <div class="sticker-sheet" onclick={(e) => e.stopPropagation()}>
      <div class="sticker-header">
        <h3>Stickers</h3>
        <button class="close-btn" onclick={onclose}>
          <Icon name="x" size={20} />
        </button>
      </div>
      <div class="sticker-grid">
        {#each stickers as s (s.id)}
          <button class="sticker-item" onclick={() => onSelect(s)}>
            <img src={s.image_url} alt={s.emoji} class="sticker-img" loading="lazy" />
          </button>
        {/each}
        {#if stickers.length === 0}
          <div class="sticker-empty">
            <p>No tienes stickers</p>
            <button class="shop-btn" onclick={() => { onclose(); goto('/fun/stickers'); }}>
              <Icon name="cart" size={16} />
              Tienda de Stickers
            </button>
          </div>
        {:else}
          <button class="shop-link" onclick={() => { onclose(); goto('/fun/stickers'); }}>
            <Icon name="cart" size={16} />
            Tienda de Stickers
          </button>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .sticker-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 100; display: flex; align-items: flex-end; }
  .sticker-sheet { width: 100%; max-width: 430px; margin: 0 auto; background: var(--bg-2); border-radius: 16px 16px 0 0; max-height: 60vh; display: flex; flex-direction: column; }
  .sticker-header { display: flex; align-items: center; justify-content: space-between; padding: 16px; border-bottom: 1px solid var(--border); }
  .sticker-header h3 { font-size: 16px; color: var(--text); }
  .close-btn { background: none; border: none; color: var(--text-2); cursor: pointer; padding: 4px; border-radius: 50%; display: flex; }
  .sticker-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; padding: 16px; overflow-y: auto; }
  .sticker-item { background: none; border: none; cursor: pointer; padding: 4px; display: flex; align-items: center; justify-content: center; border-radius: 8px; transition: background 0.2s; }
  .sticker-item:hover { background: var(--bg-3); }
  .sticker-img { width: 64px; height: 64px; object-fit: contain; }
  .sticker-empty { grid-column: 1 / -1; text-align: center; padding: 20px; color: var(--text-2); }
  .sticker-empty p { margin-bottom: 12px; }
  .shop-btn { display: flex; align-items: center; gap: 6px; margin: 0 auto; padding: 8px 16px; background: var(--accent); color: #000; border: none; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; }
  .shop-link { grid-column: 1 / -1; display: flex; align-items: center; justify-content: center; gap: 6px; padding: 10px; background: none; border: none; color: var(--accent); font-size: 13px; font-weight: 600; cursor: pointer; border-top: 1px solid var(--border); margin-top: 8px; }
</style>
