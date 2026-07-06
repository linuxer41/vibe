<script lang="ts">
  let {
    variant = 'text',
    width,
    height,
    count = 1,
    gap = 12,
    borderRadius,
  }: {
    variant?: 'text' | 'avatar' | 'card' | 'media' | 'circle';
    width?: string;
    height?: string;
    count?: number;
    gap?: number;
    borderRadius?: string;
  } = $props();
</script>

{#each Array(count) as _}
  <div
    class="skeleton"
    class:skeleton-text={variant === 'text'}
    class:skeleton-avatar={variant === 'avatar'}
    class:skeleton-card={variant === 'card'}
    class:skeleton-media={variant === 'media'}
    class:skeleton-circle={variant === 'circle'}
    style={[
      width ? `width:${width}` : '',
      height ? `height:${height}` : '',
      borderRadius ? `border-radius:${borderRadius}` : '',
      count > 1 ? `margin-bottom:${gap}px` : '',
    ].filter(Boolean).join(';')}
  ></div>
{/each}

<style>
  .skeleton {
    background: var(--bg-3);
    animation: shimmer 1.5s ease-in-out infinite;
  }
  .skeleton-text {
    width: 100%;
    height: 14px;
    border-radius: 6px;
    margin-bottom: 8px;
  }
  .skeleton-text:last-child {
    width: 65%;
  }
  .skeleton-avatar {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .skeleton-circle {
    border-radius: 50%;
  }
  .skeleton-card {
    width: 100%;
    height: 120px;
    border-radius: 14px;
    margin-bottom: 12px;
  }
  .skeleton-media {
    width: 100%;
    aspect-ratio: 16/9;
    border-radius: 12px;
    margin-bottom: 8px;
  }
  @keyframes shimmer {
    0% { opacity: 0.6; }
    50% { opacity: 1; }
    100% { opacity: 0.6; }
  }
</style>
