<script lang="ts">
  import { goto } from '$app/navigation';
  import Page from '$lib/components/Page.svelte';
  import Header from '$lib/components/Header.svelte';
</script>

<Page>
  <Header title="Términos de servicio" onback={() => goto(-1)} />
  <div class="content">
    <div class="section">
      <h2>1. Aceptación de los términos</h2>
      <p>Al utilizar esta aplicación, aceptas los presentes términos de servicio en su totalidad. Si no estás de acuerdo con alguna parte, no debes usar la aplicación.</p>
    </div>
    <div class="section">
      <h2>2. Descripción del servicio</h2>
      <p>Esta aplicación es un sistema de mensajería que permite comunicarte con otros usuarios mediante mensajes de texto, llamadas de voz y video, y compartir estados multimedia.</p>
    </div>
    <div class="section">
      <h2>3. Registro y seguridad</h2>
      <p>Eres responsable de mantener la confidencialidad de tu número de teléfono y de las sesiones iniciadas en tus dispositivos. Debes notificar inmediatamente cualquier uso no autorizado de tu cuenta.</p>
    </div>
    <div class="section">
      <h2>4. Uso aceptable</h2>
      <p>No debes utilizar el servicio para actividades ilegales, acosar a otros usuarios, enviar spam, o distribuir contenido malicioso. Nos reservamos el derecho de suspender cuentas que violen estas normas.</p>
    </div>
    <div class="section">
      <h2>5. Privacidad</h2>
      <p>El tratamiento de tus datos personales se describe en nuestra <a href="/privacy-policy">Política de privacidad</a>. Utilizamos los datos mínimos necesarios para proveer el servicio.</p>
    </div>
    <div class="section">
      <h2>6. Limitación de responsabilidad</h2>
      <p>El servicio se proporciona "tal cual". No garantizamos disponibilidad continua ni nos hacemos responsables por daños derivados del uso o la imposibilidad de usar el servicio.</p>
    </div>
    <div class="section">
      <h2>7. Modificaciones</h2>
      <p>Podemos modificar estos términos en cualquier momento. Los cambios entrarán en vigor al ser publicados en esta página. El uso continuado del servicio tras los cambios constituye aceptación.</p>
    </div>
    <div class="section">
      <h2>8. Contacto</h2>
      <p>Para consultas sobre estos términos, puedes contactarnos a través de la aplicación o mediante los canales de soporte indicados.</p>
    </div>
    <p class="updated">Última actualización: Julio 2026</p>
  </div>
</Page>

<style>
  .content { flex: 1; overflow-y: auto; padding: 16px; }
  .section { margin-bottom: 24px; }
  .section h2 { font-size: 16px; font-weight: 600; color: var(--text); margin-bottom: 8px; }
  .section p { font-size: 14px; color: var(--text-2); line-height: 1.6; }
  .section a { color: var(--accent); text-decoration: none; }
  .updated { font-size: 12px; color: var(--text-3); text-align: center; margin-top: 32px; padding-bottom: 24px; }
</style>
