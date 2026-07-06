<script lang="ts">
  let { checked, onchange }: {
    checked: boolean;
    onchange?: (e: Event) => void;
  } = $props();
</script>

<label class="toggle">
  <input type="checkbox" {checked} {onchange} />
  <span class="slider"></span>
</label>

<style>
  .toggle {
    position: relative; display: inline-block;
    width: 36px; height: 20px; flex-shrink: 0;
  }
  .toggle input { opacity: 0; width: 0; height: 0; }
  .slider {
    position: absolute; cursor: pointer;
    top: 0; left: 0; right: 0; bottom: 0;
    background: var(--bg-3); border-radius: 20px;
    transition: background 0.3s;
  }
  .slider::before {
    content: ''; position: absolute;
    height: 16px; width: 16px;
    left: 2px; bottom: 2px;
    background: #fff; border-radius: 50%;
    transition: transform 0.3s;
  }
  .toggle input:checked + .slider { background: var(--accent); }
  .toggle input:checked + .slider::before { transform: translateX(16px); }
</style>
