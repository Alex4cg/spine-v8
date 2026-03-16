<script module lang="ts">
  export type PayTableLinesProps = {
    title: string;
    lines: Array<string | number[]>;
    maxRows: number;
  };
</script>

<script lang="ts">
  const { title, lines, maxRows }: PayTableLinesProps = $props();

  const normalizeLine = (line: string | number[]) => {
    if (Array.isArray(line)) {
      return line.map((v) => Number(v));
    }

    if (typeof line === 'string') {
      return line
        .split(`,`)
        .map((v) => Number(v.trim()))
        .filter((v) => Number.isFinite(v));
    }

    return [];
  };

  const computeConvertedLines = () => (Array.isArray(lines) ? lines : []).map(normalizeLine).filter((l) => l.length > 0);

  const convertedLines = $derived(() => computeConvertedLines());
  const maxColumns = $derived(() => {
    const currentConvertedLines = convertedLines();
    return currentConvertedLines.length > 0 ? currentConvertedLines[0].length : 0;
  });
</script>

<div class="section-content-modal">
  <h1>{title}</h1>
</div>

{#if convertedLines().length > 0}
  <div class="grid">
    {#each convertedLines() as line, lineIndex}
      <div class="line-container">
        <div class="line-number">
          {lineIndex + 1}
        </div>
        <div
          class="line"
          style="grid-template-rows: repeat({maxRows}, var(--cell-size)); grid-template-columns: repeat({maxColumns()}, var(--cell-size));"
        >
          {#each Array(maxRows) as _, row}
            {#each Array(maxColumns()) as _, col}
              <div class="cell {line[col] === row ? 'active' : 'inactive'}"></div>
            {/each}
          {/each}
        </div>
      </div>
    {/each}
  </div>
{/if}

<style>
  .grid {
    display: flex;
    flex-direction: row;
    flex-wrap: wrap;
    gap: 16rem;
    justify-content: space-between;
    margin-bottom: 32rem;
  }

  .line-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    flex: 0 0 calc(20% - 16rem);
  }

  .line-number {
    font-size: 20rem;
    font-weight: bold;
    color: white;
    margin-bottom: 8rem;
    text-align: center;
  }

  .line {
    --cell-size: 24rem;
    --cell-gap: 4rem;
    display: grid;
    gap: var(--cell-gap);
    border-radius: 4rem;
    width: fit-content;
    margin-bottom: 0;
  }

  .cell {
    width: 24rem;
    height: 24rem;
    border-radius: 4rem;
  }

  .active {
    background-color: yellow;
  }

  .inactive {
    background-color: rgba(255, 255, 255, 0.08);
  }

  :global(.device-mobile) .line-container {
    flex: 0 0 calc(33.333% - 16rem);
  }

  :global(.device-mobile) .grid {
    justify-content: flex-start;
  }

  :global(.device-mobile) .cell {
    height: 16rem;
    width: 16rem;
  }

  :global(.device-mobile) .line {
    --cell-size: 16rem;
    --cell-gap: 3rem;
  }

  :global(.device-mobile) .line-number {
    font-size: 16rem;
    margin-bottom: 4rem;
  }
</style>
