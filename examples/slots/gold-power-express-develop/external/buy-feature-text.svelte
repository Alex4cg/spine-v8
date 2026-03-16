<script lang="ts">
    const { word = 'Buy feature' } = $props()
</script>

<div class="styled-text" data-text={word}>
    <span class="gradient-layer" data-text={word}>{word}</span>
</div>

<style>
  .styled-text {
    position: relative;
    color: transparent;
    font-size: 24rem;
    font-weight: 900;
    text-align: center;
    display: flex;
    align-items: center;
    justify-content: center;
    line-height: 95%;
    letter-spacing: 0.5rem;
    font-family: 'Roboto Condensed', sans-serif;
    transition: transform 0.12s ease-out;
  }

  /* Override buy-feature button backgrounds with our PNG states */
  :global(.buy-bonus-button) {
    background-image: url('/external/buy-feature/default.png') !important;
    background-size: cover !important;
    background-position: center !important;
    background-repeat: no-repeat !important;
  }

  :global(.buy-bonus-button:hover:not(:disabled)) {
    background-image: url('/external/buy-feature/hover.png') !important;
  }

  :global(.buy-bonus-button:active:not(:disabled)) {
    background-image: url('/external/buy-feature/pressed.png') !important;
    transform: none !important;
  }

  :global(.buy-bonus-button:disabled) {
    background-image: url('/external/buy-feature/disabled.png') !important;
    opacity: 1;
    pointer-events: none;
    cursor: not-allowed;
  }

  .styled-text::before {
    content: attr(data-text);
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1;
    -webkit-text-stroke: 2rem rgba(39, 59, 107, 1);
    filter: drop-shadow(0rem 1rem 0rem rgba(0, 0, 0, 1))
      drop-shadow(0rem 4.5rem 6rem rgba(39, 59, 107, 1));
  }

  .styled-text .gradient-layer {
    position: relative;
    z-index: 2;
    background: linear-gradient(180deg, #FFFFFF 0%, rgba(255, 255, 255, 0) 100%), #F8EDE4;
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
    mix-blend-mode: normal;
  }

  .styled-text .gradient-layer::before {
    content: attr(data-text);
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    display: flex;
    z-index: 1;
    background: radial-gradient(42.07% 35.71% at 46.43% 17.06%, #F7FFC0 0%, rgba(255, 255, 255, 0) 100%);
    -webkit-background-clip: text;
    mix-blend-mode: plus-lighter;
    background-clip: text;
    -webkit-text-fill-color: transparent;
  }
  :global(.device-mobile) .styled-text {
    font-size: 16rem;
    letter-spacing: 0rem;
  }

  :global(.buy-bonus-button:hover:not(:disabled)) .styled-text {
    transform: scale(1.08);
  }

  :global(.buy-bonus-button:active:not(:disabled)) .styled-text {
    transform: scale(0.92);
  }

  :global(.device-mobile) .styled-text::before {
    -webkit-text-stroke: 2rem rgba(39, 59, 107, 1);
    filter: drop-shadow(0rem 1.5rem 0rem rgba(0, 0, 0, 1))
    drop-shadow(0rem 1rem 4rem rgba(39, 59, 107, 1))
  }
</style>