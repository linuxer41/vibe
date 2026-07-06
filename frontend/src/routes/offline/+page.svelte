<script lang="ts">
  import { onMount } from 'svelte';

  let online = $state(true);

  onMount(() => {
    online = navigator.onLine;
    const handler = () => online = navigator.onLine;
    window.addEventListener('online', handler);
    window.addEventListener('offline', handler);
    return () => {
      window.removeEventListener('online', handler);
      window.removeEventListener('offline', handler);
    };
  });
</script>

<svelte:head>
  <title>Sin conexión — Vibe</title>
</svelte:head>

<div class="offline-page">
  <div class="offline-icon">
    {#if online}
      <svg viewBox="0 0 24 24" width="80" height="80" fill="none" stroke="var(--accent)" stroke-width="1.5">
        <path d="M22 12A10 10 0 0 0 12 2M2 12a10 10 0 0 0 10 10M12 6v6l4 2"/>
      </svg>
    {:else}
      <svg viewBox="0 0 24 24" width="80" height="80" fill="none" stroke="var(--accent)" stroke-width="1.5">
        <circle cx="12" cy="12" r="10"/>
        <path d="M16 16s-1.5-2-4-2-4 2-4 2M9 9h.01M15 9h.01"/>
      </svg>
    {/if}
  </div>
  <h1>{online ? 'De vuelta en línea' : 'Sin conexión'}</h1>
  <p>
    {#if online}
      Ya tienes conexión. Vuelve a la app.
    {:else}
      No hay conexión a Internet. Algunas funciones pueden no estar disponibles.
    {/if}
  </p>
  <a href="/" class="btn">Ir al inicio</a>
</div>

<style>
  :global(body) {
    margin: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: var(--bg);
    color: var(--text);
  }

  :global(:root) {
    --bg: #111b21;
    --text: #e9edef;
    --accent: #00a884;
    --card: #1f2c33;
    --border: #313d45;
  }

  .offline-page {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    padding: 2rem;
    text-align: center;
    gap: 1rem;
  }

  .offline-icon {
    margin-bottom: 0.5rem;
    opacity: 0.8;
  }

  h1 {
    font-size: 1.5rem;
    font-weight: 600;
    margin: 0;
  }

  p {
    font-size: 0.95rem;
    opacity: 0.7;
    max-width: 320px;
    line-height: 1.4;
    margin: 0;
  }

  .btn {
    display: inline-block;
    margin-top: 1.5rem;
    padding: 0.7rem 2rem;
    background: var(--accent);
    color: #fff;
    border-radius: 8px;
    text-decoration: none;
    font-weight: 600;
    font-size: 0.95rem;
  }
</style>
