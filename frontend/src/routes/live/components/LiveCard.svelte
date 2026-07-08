<script lang="ts">
  import Icon from '$lib/icon/Icon.svelte';
  import { avatarUrl } from '$lib/helpers';

  let {
    live,
    isLiked = false,
    onwatch = () => {},
    onlike = () => {},
    onshare = () => {}
  }: {
    live: any;
    isLiked?: boolean;
    onwatch?: (live: any) => void;
    onlike?: (live: any) => void;
    onshare?: (live: any) => void;
  } = $props();
</script>

<div class="live-swipe-card">
  <!-- Host avatar/name overlay top -->
  <div class="ls-top">
    <div class="ls-host-row" onclick={() => onwatch(live)}>
      <img src={avatarUrl(live.user_id, live.avatar)} alt="" class="ls-avatar" />
      <span class="ls-name">{live.display_name || live.username}</span>
      <span class="ls-badge">EN VIVO</span>
    </div>
  </div>

  <!-- Live preview area (background) -->
  <div class="ls-bg">
    <img src={avatarUrl(live.user_id, live.avatar)} alt="" class="ls-bg-img" />
  </div>

  <!-- Bottom info -->
  <div class="ls-bottom" onclick={() => onwatch(live)}>
    <p class="ls-title">{live.title || 'Live'}</p>
    <div class="ls-meta">
      <span class="ls-viewers">
        <Icon name="eye" size={14} />
        {live.viewer_count || 0}
      </span>
      <span class="ls-tag">{live.category || 'Entretenimiento'}</span>
    </div>
  </div>

  <!-- Right action buttons -->
  <div class="ls-actions" onclick={(e) => e.stopPropagation()}>
    <button class="ls-action" onclick={(e) => { e.stopPropagation(); onlike(live); }}>
      <Icon name="heart" size={28} variant={isLiked ? 'filled' : 'outline'} style="color: {isLiked ? '#ff3040' : '#fff'}" />
      <span class="ls-action-label">{live.likes_count || 0}</span>
    </button>
    <button class="ls-action" onclick={(e) => { e.stopPropagation(); onwatch(live); }}>
      <Icon name="message" size={28} />
      <span class="ls-action-label">{live.comments_count || 0}</span>
    </button>
    <button class="ls-action" onclick={(e) => { e.stopPropagation(); onshare(live); }}>
      <Icon name="share" size={28} />
    </button>
    <button class="ls-action" onclick={(e) => { e.stopPropagation(); onlike(live); }}>
      <Icon name="bookmark" size={28} />
    </button>
  </div>
</div>

<style>
  .live-swipe-card {
    height: 100%; scroll-snap-align: start;
    position: relative; overflow: hidden; display: flex;
    flex-direction: column; justify-content: space-between;
    background: #111;
  }

  .ls-bg { position: absolute; inset: 0; }
  .ls-bg-img { width: 100%; height: 100%; object-fit: cover; }

  .ls-top {
    position: relative; z-index: 2;
    padding: 60px 16px 20px;
    background: linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, transparent 100%);
  }
  .ls-host-row { display: flex; align-items: center; gap: 8px; cursor: pointer; }
  .ls-avatar { width: 36px; height: 36px; border-radius: 50%; object-fit: cover; border: 2px solid rgba(255,255,255,0.3); }
  .ls-name { color: #fff; font-size: 14px; font-weight: 600; text-shadow: 0 1px 4px rgba(0,0,0,0.5); }
  .ls-badge {
    background: #ef4444; color: #fff; font-size: 9px; font-weight: 700;
    padding: 2px 8px; border-radius: 4px; letter-spacing: 0.5px;
  }

  .ls-bottom {
    position: relative; z-index: 2; cursor: pointer;
    padding: 20px 16px 100px;
    background: linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 100%);
  }
  .ls-title { color: #fff; font-size: 15px; font-weight: 500; margin: 0 0 4px; }
  .ls-meta { display: flex; align-items: center; gap: 10px; }
  .ls-viewers { color: rgba(255,255,255,0.7); font-size: 12px; display: flex; align-items: center; gap: 4px; }
  .ls-tag { color: rgba(255,255,255,0.5); font-size: 11px; }

  .ls-actions {
    position: absolute; bottom: 120px; right: 12px; z-index: 3;
    display: flex; flex-direction: column; gap: 18px; align-items: center;
  }
  .ls-action {
    background: none; border: none; cursor: pointer;
    display: flex; flex-direction: column; align-items: center; gap: 2px;
    padding: 0; color: #fff; font-family: inherit;
  }
  .ls-action:active { transform: scale(0.9); }
  .ls-action-label { font-size: 11px; font-weight: 600; text-shadow: 0 1px 4px rgba(0,0,0,0.5); }
</style>
