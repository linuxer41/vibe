<script lang="ts">
  import { goto } from '$app/navigation';
  import Page from '$lib/components/Page.svelte';
  import Header from '$lib/components/Header.svelte';
</script>

<Page>
  <Header title="Política de privacidad" onback={() => goto(-1)} />
  <div class="content">
    <div class="section">
      <h2>1. Información que recopilamos</h2>
      <p>Recopilamos la información mínima necesaria para el funcionamiento del servicio: número de teléfono, nombre de usuario, nombre para mostrar, foto de perfil y biografía. No recopilamos datos de ubicación ni información del dispositivo más allá de lo necesario para la conexión.</p>
    </div>
    <div class="section">
      <h2>2. Uso de la información</h2>
      <p>Tu información se utiliza exclusivamente para: proveer el servicio de mensajería, autenticar tu identidad, mostrarte a otros usuarios, y notificarte sobre actividad en tu cuenta.</p>
    </div>
    <div class="section">
      <h2>3. Almacenamiento de datos</h2>
      <p>Los mensajes se almacenan localmente en la base de datos del servidor y se sincronizan entre tus dispositivos. Los estados multimedia se almacenan temporalmente y pueden eliminarse según tu configuración de autoeliminación.</p>
    </div>
    <div class="section">
      <h2>4. Compartición de datos</h2>
      <p>No compartimos tus datos personales con terceros. Tu número de teléfono es visible para tus contactos y para quienes tengan tu número registrado en la aplicación.</p>
    </div>
    <div class="section">
      <h2>5. Seguridad</h2>
      <p>Implementamos medidas de seguridad como verificación en dos pasos, bloqueo por PIN, y cifrado en tránsito para proteger tus datos. Puedes gestionar tus sesiones activas desde la configuración de seguridad.</p>
    </div>
    <div class="section">
      <h2>6. Tus derechos</h2>
      <p>Puedes solicitar la eliminación de tu cuenta y datos asociados en cualquier momento desde la configuración de privacidad. También puedes desactivar la verificación en dos pasos, gestionar tus sesiones, y controlar quién puede ver tu información.</p>
    </div>
    <div class="section">
      <h2>7. Cookies y tecnologías similares</h2>
      <p>Esta aplicación no utiliza cookies. Las sesiones se mantienen mediante tokens de autenticación almacenados localmente en tu dispositivo.</p>
    </div>
    <div class="section">
      <h2>8. Cambios en la política</h2>
      <p>Notificaremos cambios significativos en esta política a través de la aplicación. El uso continuado del servicio después de los cambios constituye aceptación de la política actualizada.</p>
    </div>
    <p class="updated">Última actualización: Julio 2026</p>
  </div>
</Page>

<style>
  .content { flex: 1; overflow-y: auto; padding: 16px; }
  .section { margin-bottom: 24px; }
  .section h2 { font-size: 16px; font-weight: 600; color: var(--text); margin-bottom: 8px; }
  .section p { font-size: 14px; color: var(--text-2); line-height: 1.6; }
  .updated { font-size: 12px; color: var(--text-3); text-align: center; margin-top: 32px; padding-bottom: 24px; }
</style>
