<script lang="ts">
  import Icon from '$lib/icon/Icon.svelte';
  import type { IconName } from '$lib/icon/icons';

  let {
    icon,
    title,
    hint,
    blob = 1
  }: {
    icon: IconName;
    title: string;
    hint: string;
    blob?: number;
  } = $props();
</script>

<div class="empty-state">
  <svg class="empty-blob" viewBox="0 0 200 160" fill="none">
    <path d={blob === 1
      ? 'M100 10C140 10 180 40 185 80C190 120 160 150 120 155C80 160 40 140 20 110C0 80 10 40 40 20C70 0 60 10 100 10Z'
      : blob === 2
      ? 'M30 100C10 70 0 30 30 15C60 0 100 10 130 30C160 50 180 80 170 110C160 140 130 155 100 150C70 145 50 130 30 100Z'
      : 'M170 60C190 90 195 130 170 145C145 160 105 155 70 140C35 125 10 105 5 80C0 55 15 30 40 15C65 0 100 10 130 20C160 30 150 30 170 60Z'}
      fill="var(--bg-2)" opacity="0.6"/>
    <path d={blob === 1
      ? 'M110 30C135 30 160 50 163 75C166 100 148 120 125 123C102 126 75 115 62 95C49 75 55 48 75 35C95 22 85 30 110 30Z'
      : blob === 2
      ? 'M50 85C35 65 30 40 50 30C70 20 95 25 115 40C135 55 145 75 140 90C135 105 115 115 95 112C75 109 65 105 50 85Z'
      : 'M155 65C170 85 172 110 155 120C138 130 110 128 85 118C60 108 45 95 42 80C39 65 48 48 65 40C82 32 105 38 125 45C145 52 140 45 155 65Z'}
      fill="var(--bg-3)" opacity="0.4"/>
  </svg>
  <div class="empty-content">
    <Icon name={icon} size={40} style="color:var(--text-3)" />
    <p>{title}</p>
    <span class="empty-hint">{hint}</span>
  </div>
</div>

<style>
  .empty-state { position: relative; flex: 1; display: flex; align-items: center; justify-content: center; min-height: 300px; }
  .empty-content { display: flex; flex-direction: column; align-items: center; gap: 12px; position: relative; z-index: 1; }
  .empty-content p { color: var(--text-2); font-size: 16px; font-weight: 600; text-align: center; }
  .empty-hint { color: var(--text-3); font-size: 13px; text-align: center; max-width: 220px; line-height: 1.4; }
  .empty-blob { position: absolute; width: 160px; height: auto; opacity: 0.5; z-index: 0; pointer-events: none; top: 50%; left: 50%; transform: translate(-50%, -50%); }
</style>
