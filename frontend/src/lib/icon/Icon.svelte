<script lang="ts">
  import { ICONS } from './icons';
  import type { IconName } from './icons';

  let {
    name,
    size = 24,
    variant = 'outline',
    strokeWidth = 2,
    class: className = '',
    style = ''
  }: {
    name: IconName;
    size?: number;
    variant?: 'outline' | 'filled';
    strokeWidth?: number;
    class?: string;
    style?: string;
  } = $props();

  const paths = $derived(ICONS[name]);
  let svgHtml = $derived(
    `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${variant === 'filled' ? 'currentColor' : 'none'}" stroke="${variant === 'filled' ? 'none' : 'currentColor'}" stroke-width="${variant === 'filled' ? 0 : strokeWidth}" stroke-linecap="round" stroke-linejoin="round">${paths?.outline || ''}</svg>`
  );
</script>

<span {style} class={className}>{@html svgHtml}</span>
