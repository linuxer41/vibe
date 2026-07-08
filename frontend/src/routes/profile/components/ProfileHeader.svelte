<script lang="ts">
  import { goto } from '$app/navigation';
  import { avatarUrl } from '$lib/helpers';
  import Icon from '$lib/icon/Icon.svelte';
  import type { User } from '$lib/types';

  let {
    usr,
    onedit
  }: {
    usr: User | null;
    onedit: () => void;
  } = $props();

  function handleAvatarClick() {
    goto('/profile/photo');
  }
</script>

<div class="profile-header">
  <div class="avatar-wrap" role="button" tabindex="0" onclick={handleAvatarClick} onkeydown={(e) => e.key === 'Enter' && handleAvatarClick()}>
    <img src={avatarUrl(usr?.id || 0, usr?.avatar)} alt="" class="profile-avatar" />
    <div class="avatar-overlay">
      <Icon name="camera" size={20} variant="filled" style="color:#fff" />
    </div>
  </div>
  <div class="name-wrap">
    <h2 class="profile-name">{usr?.display_name || 'Usuario'}</h2>
    <button class="edit-name-btn" onclick={onedit}>
      <Icon name="edit" size={14} style="color: var(--text-3)" />
    </button>
  </div>
  <span class="profile-handle">@{usr?.username || ''}</span>
  <span class="profile-bio">{usr?.bio || 'Hey there! I am using Vibe'}</span>
</div>

<style>
  .profile-header {
    display: flex; flex-direction: column; align-items: center;
    padding: 24px 20px 20px;
  }
  .avatar-wrap {
    position: relative; margin-bottom: 12px; cursor: pointer;
    border-radius: 50%; overflow: hidden;
  }
  .profile-avatar {
    width: 80px; height: 80px; border-radius: 50%;
    object-fit: cover; display: block;
    box-shadow: 0 4px 16px var(--shadow);
    transition: filter 0.2s;
  }
  .avatar-wrap:hover .profile-avatar { filter: brightness(0.6); }
  .avatar-overlay {
    position: absolute; inset: 0; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    opacity: 0; transition: opacity 0.2s; background: rgba(0,0,0,0.3);
  }
  .avatar-wrap:hover .avatar-overlay { opacity: 1; }
  .name-wrap { display: flex; align-items: center; gap: 6px; margin-bottom: 2px; }
  .profile-name { font-size: 20px; font-weight: 700; color: var(--text); margin: 0; }
  .edit-name-btn {
    background: none; border: none; cursor: pointer; padding: 4px;
    display: flex; align-items: center; opacity: 0.6;
    transition: opacity 0.15s;
  }
  .edit-name-btn:hover { opacity: 1; }
  .profile-handle { font-size: 14px; color: var(--text-3); margin-bottom: 4px; }
  .profile-bio { font-size: 14px; color: var(--text-2); text-align: center; line-height: 1.4; }
</style>
