<script lang="ts">
    const { text = 'Sidebet active' } = $props()
</script>

<div class="top-text">{text}</div>

<style>
.top-text {
    position: absolute;
    color: rgba(255, 195, 0, 1);
    font-family: "Roboto Condensed", sans-serif;
    font-weight: 900;
    text-align: center;
    z-index: 10;
    pointer-events: none;
    white-space: nowrap;
    text-transform: uppercase;
    filter: drop-shadow(0rem 1rem 0rem rgba(72, 27, 2, 1)) drop-shadow(0rem -0.3rem 0rem rgba(251, 255, 181, 1));
    width: 100%;
    display: flex;
    justify-content: center;
    top: -20rem;
    left: 0;
    font-size: 12rem;
  }
  :global(.device-mobile) .top-text {
    top: -12rem;
    font-size: 8rem;
    left: 0;
    justify-content: center;
  }
</style>