<script lang="ts">
  import { avatarUrl } from '$lib/helpers';

  let {
    userId,
    notificationCount = 0,
    onclick,
    size = 32,
    avatar
  }: {
    userId: number;
    notificationCount?: number;
    onclick?: () => void;
    size?: number;
    avatar?: string;
  } = $props();
</script>

<button class="header-avatar-btn" role="button" tabindex="0" {onclick} onkeydown={(e) => e.key === 'Enter' && onclick?.()}>
  <img src={avatarUrl(userId, avatar)} alt="" class="avatar" style="width:{size}px;height:{size}px" />
  {#if notificationCount > 0}
    <span class="badge">{notificationCount}</span>
  {/if}
</button>

<style>
  .header-avatar-btn {
    background: none; border: none; cursor: pointer;
    padding: 0; position: relative; display: flex;
  }
  .avatar {
    border-radius: 50%; object-fit: cover;
  }
  .badge {
    position: absolute; top: -2px; right: -2px;
    min-width: 16px; height: 16px; border-radius: 8px;
    background: #ef4444; color: #fff; font-size: 9px; font-weight: 700;
    display: flex; align-items: center; justify-content: center; padding: 0 4px;
  }
</style>
