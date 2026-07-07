<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import Page from '$lib/components/Page.svelte';
  import Header from '$lib/components/Header.svelte';
  import SettingSection from '$lib/components/SettingSection.svelte';
  import SettingRow from '$lib/components/SettingRow.svelte';
  import { socket, blockedUsers } from '$lib/stores';
  import { avatarUrl } from '$lib/helpers';
  import type { User } from '$lib/types';
  import Icon from '$lib/icon/Icon.svelte';

  let sk: any = $state(null);
  socket.subscribe((v) => sk = v);

  onMount(() => {
    sk?.emit('get_blocked_users', (res: any) => blockedUsers.set(res));
  });

  function unblock(u: User) {
    sk?.emit('unblock_user', { userId: u.id }, () => {
      blockedUsers.update((list) => list.filter((b) => b.id !== u.id));
    });
  }
</script>

<Page>
  <Header title="Contactos bloqueados" onback={() => goto('/settings/security')} />
  <div class="content">
    {#if $blockedUsers.length === 0}
      <div class="empty">
        <Icon name="x" size={48} strokeWidth={1.5} style="color: var(--text-3)" />
        <p>No hay contactos bloqueados</p>
      </div>
    {:else}
      <SettingSection>
        {#each $blockedUsers as u}
          <div class="blocked-row">
            <img src={avatarUrl(u.id)} alt="" class="avatar" />
            <div class="info">
              <span class="name">{u.display_name}</span>
              <span class="phone">{u.phone}</span>
            </div>
            <button class="unblock-btn" onclick={() => unblock(u)}>Desbloquear</button>
          </div>
        {/each}
      </SettingSection>
    {/if}
  </div>
</Page>

<style>
  .content { flex: 1; overflow-y: auto; }
  .empty {
    display: flex; flex-direction: column; align-items: center;
    justify-content: center; padding: 80px 24px; gap: 12px;
  }
  .empty p { color: var(--text-3); font-size: 14px; }
  .blocked-row {
    display: flex; align-items: center; gap: 12px;
    padding: 12px 16px; border-bottom: 1px solid var(--border-2);
  }
  .avatar { width: 44px; height: 44px; border-radius: 50%; object-fit: cover; }
  .info { flex: 1; min-width: 0; }
  .name { display: block; font-size: 15px; font-weight: 500; color: var(--text); }
  .phone { display: block; font-size: 13px; color: var(--text-3); }
  .unblock-btn {
    padding: 8px 16px; border-radius: 8px; border: 1.5px solid var(--accent);
    background: none; color: var(--accent); font-size: 13px;
    font-weight: 600; cursor: pointer; transition: all 0.2s;
    white-space: nowrap;
  }
  .unblock-btn:hover { background: rgba(34,197,94,0.1); }
</style>
