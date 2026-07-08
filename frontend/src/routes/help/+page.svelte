<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import Icon from '$lib/icon/Icon.svelte';
  import MinimalLayout from '$lib/layouts/MinimalLayout.svelte';
  import Page from '$lib/components/Page.svelte';
</script>

<MinimalLayout>
<Page>
  <div class="help-body">
    <button class="back-btn" onclick={() => goto($page.url.searchParams.get('from') || '/init', { noScroll: true })}>
      <Icon name="chevron-left" size={24} />
    </button>
    <h1 class="help-title">Vibe — Cómo funciona</h1>

    <section>
      <h2>Chats</h2>
      <p>Mensajería privada y grupal con texto, imágenes, video, audio y documentos. Los mensajes tienen estado de enviado/entregado/leído. Puedes responder, reenviar, fijar chats y buscar mensajes.</p>
    </section>

    <section>
      <h2>Feed</h2>
      <p>Publicaciones de texto, imagen y video que expiran a las 24h. Puedes dar like, comentar y ver posts de tus contactos o del feed general.</p>
    </section>

    <section>
      <h2>Live Streaming</h2>
      <p>Transmite en vivo con cambio de cámara frontal/trasera y zoom digital. Los espectadores pueden comentar, reaccionar y enviar regalos (estrellas).</p>
    </section>

    <section>
      <h2>Llamadas</h2>
      <p>Llamadas de audio y video P2P con señalización vía Socket.IO. También disponible en grupos mediante LiveKit.</p>
    </section>

    <section>
      <h2>Canales y Comunidades</h2>
      <p>Crea o únete a canales públicos. Participa en comunidades con posts comunitarios.</p>
    </section>

    <section>
      <h2>Tienda</h2>
      <p>Productos con imágenes y precios. Compra, guarda en wishlist y aprovecha ofertas relámpago (Flash Deals).</p>
    </section>

    <section>
      <h2>Juegos</h2>
      <p>Juegos multijugador con sesiones en tiempo real y puntuaciones.</p>
    </section>

    <section>
      <h2>Watch Together</h2>
      <p>Visualización sincronizada de videos con control de reproducción compartido.</p>
    </section>

    <section>
      <h2>Estrellas y Vibe Balance</h2>
      <p>Gana estrellas por actividad en la app (mensajes, feed, lives, etc.). Gástalas en lives como regalos para streamers.</p>
    </section>

    <section>
      <h2>Perfil</h2>
      <p>Personaliza tu avatar 3D, edita tu nombre y bio, y revisa tu actividad.</p>
    </section>

    <section>
      <h2>Privacidad</h2>
      <p>Bloqueo de usuarios, two-step auth, passcode de app, y autodestrucción programada de cuenta.</p>
    </section>
  </div>
</Page>
</MinimalLayout>

<style>
  .help-body {
    padding: 24px 20px 48px; max-width: 600px; margin: 0 auto;
  }
  .back-btn {
    background: none; border: none; color: var(--text); cursor: pointer;
    padding: 8px 0; margin-bottom: 16px; display: flex;
  }
  .help-title {
    font-size: 22px; font-weight: 700; color: var(--text);
    margin-bottom: 28px;
  }
  section {
    margin-bottom: 28px;
  }
  section h2 {
    font-size: 16px; font-weight: 700; color: var(--text);
    margin-bottom: 6px;
  }
  section p {
    font-size: 14px; color: var(--text-2); line-height: 1.6;
    margin: 0;
  }
</style>
