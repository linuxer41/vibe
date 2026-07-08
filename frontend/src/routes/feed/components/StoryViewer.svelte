<script lang="ts">
  import Icon from '$lib/icon/Icon.svelte';
  import { mediaUrl } from '$lib/helpers';
  import type { StoryGroup } from '$lib/types';

  let {
    group,
    onclose,
  }: {
    group: StoryGroup;
    onclose?: () => void;
  } = $props();

  let viewingIdx = $state(0);
  let storyTimer: number | null = $state(null);

  function nextStory() {
    if (viewingIdx < group.stories.length - 1) {
      viewingIdx++;
    } else {
      onclose?.();
    }
  }

  function prevStory() {
    if (viewingIdx > 0) viewingIdx--;
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); nextStory(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); prevStory(); }
    else if (e.key === 'Escape') { onclose?.(); }
  }

  function getStoryAvatar(): string {
    return group.user.avatar || `https://i.pravatar.cc/80?u=${group.user.id}`;
  }

  function getStoryName(): string {
    return group.user.display_name || group.user.username || '';
  }

  $effect(() => {
    if (storyTimer) clearTimeout(storyTimer);
    storyTimer = window.setTimeout(() => {
      nextStory();
    }, 5000);
    return () => { if (storyTimer) clearTimeout(storyTimer); };
  });
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="story-viewer" tabindex="0" onkeydown={handleKeydown} role="dialog">
  <div class="story-progress">
    {#each group.stories as _, si}
      <div class="progress-segment">
        <div class="progress-bar {si === viewingIdx ? 'active' : si < viewingIdx ? 'seen' : ''}"></div>
      </div>
    {/each}
  </div>
  <div class="story-header">
    <img src={getStoryAvatar()} alt="" class="story-viewer-avatar" />
    <span class="story-viewer-name">{getStoryName()}</span>
    <button class="story-close-btn" onclick={onclose}>
      <Icon name="x" size={24} />
    </button>
  </div>
  <div class="story-content" onclick={nextStory}>
    <img src={mediaUrl(group.stories[viewingIdx]?.media_url || '', { w: 400, h: 700 })} alt="" class="story-media" />
  </div>
  <div class="story-tap-left" onclick={(e) => { e.stopPropagation(); prevStory(); }}></div>
</div>

<style>
  .story-viewer {
    position: fixed; inset: 0; z-index: 60;
    background: var(--bg); display: flex; flex-direction: column;
    outline: none;
  }
  .story-progress {
    display: flex; gap: 3px; padding: 8px 8px 4px;
    padding-top: env(safe-area-inset-top, 8px);
    z-index: 2;
  }
  .progress-segment { flex: 1; height: 2px; background: var(--bg-3); border-radius: 2px; overflow: hidden; }
  .progress-bar { height: 100%; background: var(--text); border-radius: 2px; width: 0; transition: none; }
  .progress-bar.active { animation: progressAnim 5s linear forwards; }
  .progress-bar.seen { width: 100%; }
  @keyframes progressAnim { from { width: 0; } to { width: 100%; } }
  .story-header {
    display: flex; align-items: center; gap: 10px;
    padding: 8px 12px; z-index: 2;
  }
  .story-viewer-avatar { width: 32px; height: 32px; border-radius: 50%; object-fit: cover; }
  .story-viewer-name { color: var(--text); font-size: 14px; font-weight: 600; flex: 1; }
  .story-close-btn { background: none; border: none; color: var(--text); cursor: pointer; padding: 4px; }
  .story-content {
    flex: 1; display: flex; align-items: center; justify-content: center;
    position: relative; cursor: pointer;
  }
  .story-media {
    width: 100%; height: 100%; object-fit: contain;
  }
  .story-tap-left {
    position: absolute; top: 0; bottom: 0; left: 0; width: 35%;
    z-index: 3; cursor: pointer;
  }
</style>
