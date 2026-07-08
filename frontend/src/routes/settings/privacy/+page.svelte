<script lang="ts">
  import { emit } from '$lib/socket';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import HeaderLayout from '$lib/layouts/HeaderLayout.svelte';
  import SettingSection from '$lib/components/SettingSection.svelte';
  import SettingRow from '$lib/components/SettingRow.svelte';
  import Toggle from '$lib/components/Toggle.svelte';
  import { privacySettings, blockedUsers } from '$lib/stores';
  import type { PrivacySettings } from '$lib/types';
  import Icon from '$lib/icon/Icon.svelte';
  import type { IconName } from '$lib/icon/icons';

  let ps = $state<PrivacySettings>({
    last_seen: 'everyone', profile_photo: 'everyone',
    bio: 'everyone', status: 'contacts', calls: 'everyone',
    read_receipts: 1, message_history: 1
  });

  privacySettings.subscribe((v) => ps = v);

  onMount(() => {
    loadPrivacy();
  });

  async function loadPrivacy() {
    try {
      const res = await emit('get_privacy_settings');
      if (res) privacySettings.set(res);
    } catch {}
    try {
      const res = await emit('get_blocked_users');
      if (res) blockedUsers.set(res);
    } catch {}
  }

  const whoOptions = ['everyone', 'contacts', 'nobody'] as const;
  const whoLabels: Record<string, string> = {
    everyone: 'Todos', contacts: 'Mis contactos', nobody: 'Nadie'
  };

  let picking = $state<string | null>(null);

  function updateField(field: keyof PrivacySettings, value: any) {
    const updated = { ...ps, [field]: value };
    privacySettings.set(updated);
    emit('update_privacy_settings', { [field]: value });
  }
</script>

<HeaderLayout title="Privacidad" showBack onBack={() => goto('/settings')}>
  <div class="content">
    <SettingSection label="Quién puede ver mi información personal">
      <SettingRow label="Última vez y en línea" desc={whoLabels[ps.last_seen]} chevron onclick={() => picking = 'last_seen'} />
      <SettingRow label="Foto de perfil" desc={whoLabels[ps.profile_photo]} chevron onclick={() => picking = 'profile_photo'} />
      <SettingRow label="Información" desc={whoLabels[ps.bio]} chevron onclick={() => picking = 'bio'} />
      <SettingRow label="Estado" desc={whoLabels[ps.status]} chevron onclick={() => picking = 'status'} />
      <SettingRow label="Llamadas" desc={whoLabels[ps.calls]} chevron onclick={() => picking = 'calls'} />
    </SettingSection>
    <SettingSection label="Mensajes">
      <SettingRow label="Confirmaciones de lectura">
        <Toggle checked={!!ps.read_receipts} onchange={() => updateField('read_receipts', ps.read_receipts ? 0 : 1)} />
      </SettingRow>
      <SettingRow label="Historial de mensajes" desc={ps.message_history ? 'Conservar siempre' : 'No conservar'} chevron onclick={() => updateField('message_history', ps.message_history ? 0 : 1)} />
    </SettingSection>
    <SettingSection label="Bloqueados">
      <SettingRow label="Contactos bloqueados" desc={`${$blockedUsers.length} contactos`} chevron onclick={() => goto('/settings/blocked')} />
    </SettingSection>
  </div>
</HeaderLayout>

<!-- Picker BottomSheet -->
{#if picking}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<div class="picker-overlay" onclick={() => picking = null}>
<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<div class="picker-sheet" onclick={(e) => e.stopPropagation()}>
      <div class="picker-header">
        <h3>{picking.replace(/_/g, ' ')}</h3>
        <button class="picker-close" onclick={() => picking = null}>
          <Icon name="x" size={20} />
        </button>
      </div>
      <div class="picker-options">
        {#each whoOptions as opt}
          <button class="picker-option" class:selected={ps[picking as keyof PrivacySettings] === opt} onclick={() => { updateField(picking!, opt); picking = null; }}>
            <span>{whoLabels[opt]}</span>
            {#if ps[picking as keyof PrivacySettings] === opt}
              <Icon name="check" size={20} strokeWidth={3} style="color: var(--accent)" />
            {/if}
          </button>
        {/each}
      </div>
    </div>
  </div>
{/if}

<style>
  .content { flex: 1; overflow-y: auto; padding-bottom: 16px; }
  .picker-overlay {
    position: fixed; inset: 0; background: rgba(0,0,0,0.7);
    display: flex; align-items: flex-end; justify-content: center;
    z-index: 100; animation: fadeIn 0.2s ease-out;
  }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  .picker-sheet {
    background: var(--bg-2); border-radius: 16px 16px 0 0;
    padding: 16px 20px 24px; width: 100%; max-width: 430px;
    animation: slideUp 0.25s ease-out;
  }
  @keyframes slideUp { from { transform: translateY(40px); } to { transform: translateY(0); } }
  .picker-header {
    display: flex; align-items: center; justify-content: space-between;
    margin-bottom: 16px;
  }
  .picker-header h3 { font-size: 18px; font-weight: 600; color: var(--text); text-transform: capitalize; }
  .picker-close {
    background: none; border: none; color: var(--text-2); cursor: pointer;
    padding: 6px; border-radius: 50%; display: flex;
  }
  .picker-close:hover { background: var(--border); }
  .picker-options { display: flex; flex-direction: column; gap: 4px; }
  .picker-option {
    display: flex; align-items: center; justify-content: space-between;
    padding: 14px 12px; background: none; border: none;
    font-size: 15px; color: var(--text); cursor: pointer;
    border-radius: 10px; transition: background 0.15s;
  }
  .picker-option:hover { background: rgba(255,255,255,0.03); }
  .picker-option.selected { color: var(--accent); font-weight: 600; }
</style>
