<script lang="ts">
  import CameraCreator from '$lib/components/CameraCreator.svelte';
  import Icon from '$lib/icon/Icon.svelte';
  import type { User } from '$lib/types';

  let {
    sk,
    usr,
  }: {
    sk: any;
    usr: User | null;
  } = $props();

  let showCreate = $state(false);

  function handleClose() {
    showCreate = false;
  }

  function handlePost() {
    showCreate = false;
  }

  function handleStory() {
    showCreate = false;
  }
</script>

{#if showCreate}
  <CameraCreator {sk} {usr} onclose={handleClose} onpost={handlePost} onstory={handleStory} />
{/if}

<button class="create-fab" onclick={() => showCreate = true}>
  <Icon name="plus" size={28} />
</button>

<style>
  .create-fab {
    position: fixed; bottom: 80px; right: 16px;
    width: 56px; height: 56px; border-radius: 50%; background: var(--accent);
    border: none; cursor: pointer; display: flex; align-items: center; justify-content: center;
    box-shadow: 0 4px 16px rgba(0,0,0,0.3); z-index: 10; color: var(--bg);
  }
</style>
