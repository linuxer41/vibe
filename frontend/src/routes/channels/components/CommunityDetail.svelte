<script lang="ts">
  import type { Community } from '$lib/types';

  let {
    community
  }: {
    community: Community;
  } = $props();
</script>

<div class="ch-detail-header">
  <div class="ch-detail-info">
    <span class="ch-detail-desc">{community.description || 'Sin descripción'}</span>
    <span class="ch-detail-meta">{community.members_count || 0} miembros</span>
  </div>
</div>

<div class="ch-members">
  <p class="ch-members-placeholder">Has seleccionado la comunidad <strong>{community.name}</strong>. Comparte el nombre de la comunidad con otros para que se unan.</p>
</div>

<style>
  .ch-detail-header { padding: 16px; background: var(--bg-2); border-bottom: 1px solid var(--border); flex-shrink: 0; }
  .ch-detail-info { display: flex; flex-direction: column; gap: 4px; }
  .ch-detail-desc { font-size: 13px; color: var(--text-2); }
  .ch-detail-meta { font-size: 11px; color: var(--text-3); }

  .ch-members { flex: 1; overflow-y: auto; padding: 12px 16px; }
  .ch-members-placeholder { font-size: 14px; color: var(--text-2); line-height: 1.5; padding: 24px 0; }
</style>
