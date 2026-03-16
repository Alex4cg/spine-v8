<script lang="ts">
  import { initializeLocales } from './utils';
  import PaytableLinesSection from './paytable-lines-section.svelte';

  // @ts-ignore // TODO fix this
  import imgSymbolWild from './assets/paytable/symbol_wild.png';
  // @ts-ignore // TODO fix this
  import imgSymbolHigh_1 from './assets/paytable/symbol_high_1.png';
  // @ts-ignore // TODO fix this
  import imgSymbolHigh_2 from './assets/paytable/symbol_high_2.png';
  // @ts-ignore // TODO fix this
  import imgSymbolHigh_3 from './assets/paytable/symbol_high_3.png';
  // @ts-ignore // TODO fix this
  import imgSymbolHigh_4 from './assets/paytable/symbol_high_4.png';
  // @ts-ignore // TODO fix this
  import imgSymbolLow_1 from './assets/paytable/symbol_low_1.png';
  // @ts-ignore // TODO fix this
  import imgSymbolLow_2 from './assets/paytable/symbol_low_2.png';
  // @ts-ignore // TODO fix this
  import imgSymbolLow_3 from './assets/paytable/symbol_low_3.png';
  // @ts-ignore // TODO fix this
  import imgSymbolLow_4 from './assets/paytable/symbol_low_4.png';

  const {
    paytableItems: propsPaytableItems = [],
    PaytableSymbolSectionComponent,
    PaytableLinesSectionComponent,
    lines,
    fullConfig,
    addMessages,
    translate
  }: PayTableProps = $props();

  $effect(() => {
    initializeLocales(addMessages);
  });

  const symbolImages: Record<string, string> = {
    'L4': imgSymbolLow_4,
    'L3': imgSymbolLow_3,
    'L2': imgSymbolLow_2,
    'L1': imgSymbolLow_1,
    'H4': imgSymbolHigh_4,
    'H3': imgSymbolHigh_3,
    'H2': imgSymbolHigh_2,
    'H1': imgSymbolHigh_1,
    'W': imgSymbolWild,
  };

  type CurrentPayTableItem = { symbolId: string; payouts: Record<string, number> }

  const normalizePayoutKey = (key: string) => {
    if (key.includes('-')) {
      return key.split('-')[1];
    }
    return key;
  };

  const getNormalizedPaytableItems = () => (propsPaytableItems as Array<CurrentPayTableItem>).map((item) => ({
    ...item,
    symbolId: (item.symbolId || ``).toUpperCase(),
    payouts: Object.fromEntries(
      Object.entries(item.payouts).map(([key, value]) => [
        normalizePayoutKey(key),
        value,
      ]),
    ),
  }));

  const getPaytableItems = () => getNormalizedPaytableItems()
    .filter((item) => item && ['H1', 'H2', 'H3', 'H4'].includes(item.symbolId));

  const getPaytableLowItems = () => getNormalizedPaytableItems()
    .filter((item) => ['L1', 'L2', 'L3', 'L4']
    .includes(item.symbolId));

  const getPaytableSpecialItems = () => getNormalizedPaytableItems()
    .filter((item) => ['W']
    .includes(item.symbolId));

  const maxRows = 3
  const calculatePayout = (multiplier: number) => `${multiplier}x`

</script>


{#if PaytableSymbolSectionComponent}
  <PaytableSymbolSectionComponent
    title={translate('paytable_section.high_symbols')}
    items={getPaytableItems()}
    symbolImgFromId={symbolImages}
    calculatePayout={calculatePayout}
  />
  <PaytableSymbolSectionComponent
    title={translate('paytable_section.low_symbols')}
    items={getPaytableLowItems()}
    symbolImgFromId={symbolImages}
    calculatePayout={calculatePayout}
  />
  {#if getPaytableSpecialItems().length > 0}
    <PaytableSymbolSectionComponent
      title={translate('paytable_section.special_symbols')}
      items={getPaytableSpecialItems()}
      symbolImgFromId={symbolImages}
      calculatePayout={calculatePayout}
    />
  {/if}
  {#if Array.isArray(lines) && lines.length > 0}
    <PaytableLinesSection
      title={translate('paytable_section.lines')}
      lines={lines}
      maxRows={maxRows}
    />
  {/if}
{/if}

<style>
  :global(.paytable-item .symbol-container) {
    position: relative !important;
    z-index: 1 !important;
    flex-shrink: 0 !important;
    overflow: visible !important;
    width: 302rem !important;
    height: 166rem !important;
  }

  :global(.paytable-item .symbol-container img) {
    max-width: 302rem !important;
    max-height: 166rem !important;
    width: auto !important;
    height: auto !important;
    object-fit: contain !important;
  }

  :global(.device-mobile .paytable-item .symbol-container) {
    width: 90rem !important;
    height: 60rem !important;
  }

  :global(.device-mobile .paytable-item .symbol-container img) {
    max-width: 90rem !important;
    max-height: 60rem !important;
  }

  :global(.paytable-grid) {
    display: flex !important;
    flex-wrap: wrap !important;
    gap: 1rem 1rem !important;
    justify-content: center !important;
    align-items: flex-start !important;
  }

  :global(.paytable-item) {
    flex: 0 0 calc(50% - 10rem) !important;
    max-width: 500rem !important;
    min-width: 400rem !important;
    display: flex !important;
    flex-direction: row !important;
    justify-content: flex-start !important;
    align-items: center !important;
    gap: 24rem !important;
    overflow: visible !important;
    position: relative !important;
  }

  :global(.paytable-content) {
    display: flex !important;
    flex-direction: row !important;
    gap: 1rem !important;
    align-items: center !important;
    width: 100% !important;
    overflow: visible !important;
    position: relative !important;
  }

  :global(.payouts-container) {
    position: relative !important;
    z-index: 10 !important;
    font-size: 30rem;
    line-height: 1.1;
    display: block !important;
    visibility: visible !important;
    opacity: 1 !important;
  }

  :global(.payout-count) {
    width: auto;
    margin-right: 8rem;
    font-weight: 700;
    color: rgba(150, 150, 150, 1) !important;
  }

  :global(.payout-value) {
    display: flex !important;
    visibility: visible !important;
  }

  :global(.payout-text) {
    display: inline !important;
    visibility: visible !important;
  }

  :global(.device-mobile .paytable-grid) {
    gap: 12rem 4rem !important;
    justify-content: space-between !important;
  }

  :global(.device-mobile .paytable-item) {
    flex: 0 0 calc(50% - 2rem) !important;
    max-width: calc(50% - 2rem) !important;
    min-width: auto !important;
    gap: 6rem !important;
  }

  :global(.device-mobile .paytable-content) {
    gap: 6rem !important;
  }

  :global(.device-mobile .payouts-container) {
    font-size: 18rem !important;
    line-height: 1.2 !important;
  }
</style>
