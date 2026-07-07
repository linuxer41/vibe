<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import Page from '$lib/components/Page.svelte';
  import Header from '$lib/components/Header.svelte';
  import SettingSection from '$lib/components/SettingSection.svelte';
  import SettingRow from '$lib/components/SettingRow.svelte';
  import { socket, accountDeletion } from '$lib/stores';
  import Icon from '$lib/icon/Icon.svelte';

  let sk: any = $state(null);
  let deleteAt = $state<string | null>(null);
  let selectedDays = $state(0);

  socket.subscribe((v) => sk = v);
  accountDeletion.subscribe((v) => deleteAt = v);

  onMount(() => {
    sk?.emit('get_account_deletion', (res: any) => {
      accountDeletion.set(res.delete_at);
      deleteAt = res.delete_at;
    });
  });

  function schedule(days: number) {
    sk?.emit('schedule_account_deletion', { days }, () => {
      const d = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
      accountDeletion.set(d);
      deleteAt = d;
      selectedDays = days;
    });
  }

  function cancel() {
    sk?.emit('cancel_account_deletion', {}, () => {
      accountDeletion.set(null);
      deleteAt = null;
      selectedDays = 0;
    });
  }

  function formatDate(d: string) {
    if (!d) return '';
    return new Date(d + 'Z').toLocaleDateString('es', {
      year: 'numeric', month: 'long', day: 'numeric'
    });
  }
</script>

<Page>
  <Header title="Eliminación automática" onback={() => goto('/settings/security')} />
  <div class="content">
    {#if deleteAt}
      <div class="alert active">
        <Icon name="info" size={20} style="color: var(--danger)" />
        <span>Tu cuenta se eliminará el {formatDate(deleteAt)}</span>
      </div>
    {:else}
      <div class="alert">
        <Icon name="info" size={20} style="color: var(--text-3)" />
        <span>No hay eliminación programada</span>
      </div>
    {/if}

    <SettingSection label="Eliminar cuenta automáticamente si no uso la app durante">
      <div class="option" class:selected={selectedDays === 30} onclick={() => schedule(30)}>
        <span>1 mes</span>
        {#if selectedDays === 30}
          <Icon name="check" size={20} strokeWidth={3} style="color: var(--accent)" />
        {/if}
      </div>
      <div class="option" class:selected={selectedDays === 90} onclick={() => schedule(90)}>
        <span>3 meses</span>
        {#if selectedDays === 90}
          <Icon name="check" size={20} strokeWidth={3} style="color: var(--accent)" />
        {/if}
      </div>
      <div class="option" class:selected={selectedDays === 180} onclick={() => schedule(180)}>
        <span>6 meses</span>
        {#if selectedDays === 180}
          <Icon name="check" size={20} strokeWidth={3} style="color: var(--accent)" />
        {/if}
      </div>
      <div class="option" class:selected={selectedDays === 365} onclick={() => schedule(365)}>
        <span>1 año</span>
        {#if selectedDays === 365}
          <Icon name="check" size={20} strokeWidth={3} style="color: var(--accent)" />
        {/if}
      </div>
    </SettingSection>

    {#if selectedDays > 0 && !deleteAt}
      <p class="confirm-msg">Se eliminará tu cuenta si no abres la app en {selectedDays} días.</p>
    {/if}

    {#if deleteAt}
      <button class="cancel-btn" onclick={cancel}>
        Cancelar eliminación programada
      </button>
    {/if}
  </div>
</Page>

<style>
  .content { flex: 1; overflow-y: auto; }
  .alert {
    display: flex; align-items: center; gap: 10px;
    padding: 16px; background: var(--bg-2); margin-top: 12px;
    font-size: 14px; color: var(--text-2);
  }
  .alert.active { color: var(--danger); }
  .option {
    display: flex; align-items: center; justify-content: space-between;
    padding: 14px 16px; cursor: pointer; border-bottom: 1px solid var(--border-2);
    transition: background 0.15s; font-size: 15px; color: var(--text);
  }
  .option:hover { background: rgba(255,255,255,0.03); }
  .option.selected { color: var(--accent); font-weight: 500; }
  .confirm-msg { padding: 16px; font-size: 12px; color: var(--text-3); text-align: center; }
  .cancel-btn {
    width: calc(100% - 32px); margin: 16px; padding: 13px;
    background: none; border: 1.5px solid var(--danger); border-radius: 12px;
    color: var(--danger); font-size: 15px; font-weight: 600; cursor: pointer;
  }
  .cancel-btn:hover { background: rgba(239,68,68,0.06); }
</style>
