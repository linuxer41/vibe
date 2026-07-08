<script lang="ts">
  import Icon from '$lib/icon/Icon.svelte';
  import BottomSheet from '$lib/components/BottomSheet.svelte';
  import { countries, type Country } from '$lib/countries';

  let {
    show,
    onclose,
    onselect
  }: {
    show: boolean;
    onclose: () => void;
    onselect: (country: Country) => void;
  } = $props();

  let countrySearch = $state('');

  let filteredCountries = $derived(
    countries.filter(c =>
      c.name.toLowerCase().includes(countrySearch.toLowerCase()) ||
      c.dial.includes(countrySearch) ||
      c.code.toLowerCase().includes(countrySearch.toLowerCase())
    )
  );

  function handleSelect(c: Country) {
    onselect(c);
    countrySearch = '';
  }

  function handleClose() {
    onclose();
    countrySearch = '';
  }
</script>

<BottomSheet show={show} onclose={handleClose} title="Seleccionar país">
  <div class="sheet-search">
    <Icon name="search" size={16} style="color: var(--text-3)" />
    <input type="text" bind:value={countrySearch} placeholder="Buscar país..." class="sheet-search-input" />
  </div>
  <div class="country-list">
    {#each filteredCountries as c (c.code)}
      <button class="country-item" onclick={() => handleSelect(c)}>
        <span class="ci-flag">{c.flag}</span>
        <span class="ci-name">{c.name}</span>
        <span class="ci-dial">+{c.dial}</span>
      </button>
    {/each}
  </div>
</BottomSheet>

<style>
  .sheet-search {
    display: flex; align-items: center; gap: 10px;
    padding: 12px 16px; border-bottom: 1px solid var(--border);
  }
  .sheet-search-input {
    flex: 1; background: none; border: none; outline: none;
    font-size: 15px; color: var(--text); font-family: inherit;
  }
  .sheet-search-input::placeholder { color: var(--text-3); }
  .country-list { flex: 1; overflow-y: auto; }
  .country-item {
    display: flex; align-items: center; gap: 12px;
    width: 100%; padding: 13px 16px; background: none;
    border: none; cursor: pointer; transition: background 0.15s;
    text-align: left;
  }
  .country-item:hover { background: var(--bg); }
  .country-item:active { background: var(--bg-2); }
  .ci-flag { font-size: 24px; line-height: 1; }
  .ci-name { flex: 1; font-size: 15px; color: var(--text); font-weight: 500; }
  .ci-dial { font-size: 14px; color: var(--text-3); }
</style>
