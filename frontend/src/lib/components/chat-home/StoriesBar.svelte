<script lang="ts">
  import { goto } from '$app/navigation';
  import { avatarUrl } from '$lib/helpers';
  import { contacts, posts, viewingPost } from '$lib/stores';
  import Icon from '$lib/icon/Icon.svelte';
  import type { User } from '$lib/types';

  let {
    userId,
    avatar
  }: {
    userId: number;
    avatar?: string;
  } = $props();
</script>

<div class="stories-bar">
  <div class="story-item" onclick={() => goto('/camera')}>
    <div class="story-avatar your-story">
      <img src={avatarUrl(userId, avatar)} alt="" />
      <div class="story-plus">
        <Icon name="plus" size={14} variant="filled" style="color:#fff" />
      </div>
    </div>
    <span class="story-label">You</span>
  </div>
  {#each $contacts as c}
    <div class="story-item" onclick={() => { const s = $posts.find((st: any) => st.user_id === c.id); if (s) viewingPost.set(s); }}>
      <div class="story-avatar" class:has-status={$posts.some((s: any) => s.user_id === c.id)}>
        <img src={avatarUrl(c.id, c.avatar)} alt="" />
      </div>
      <span class="story-label">{c.display_name?.split(' ')[0]}</span>
    </div>
  {/each}
</div>

<style>
  .stories-bar {
    display: flex; gap: 14px; padding: 12px 16px; overflow-x: auto;
    background: var(--bg-2); border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }
  .stories-bar::-webkit-scrollbar { display: none; }
  .story-item { display: flex; flex-direction: column; align-items: center; gap: 4px; cursor: pointer; flex-shrink: 0; }
  .story-avatar {
    width: 56px; height: 56px; border-radius: 50%;
    padding: 3px; background: var(--bg-3); overflow: hidden;
  }
  .story-avatar.has-status {
    background: conic-gradient(var(--accent) 0deg 180deg, var(--accent-hover) 180deg 360deg);
    padding: 2px;
  }
  .story-avatar img { width: 100%; height: 100%; border-radius: 50%; object-fit: cover; background: var(--bg); }
  .your-story { position: relative; }
  .story-plus {
    position: absolute; bottom: -1px; right: -1px;
    width: 20px; height: 20px; border-radius: 50%;
    background: var(--accent); display: flex; align-items: center; justify-content: center;
    border: 2px solid var(--bg-2);
  }
  .story-label { font-size: 10px; color: var(--text-2); white-space: nowrap; }
</style>
