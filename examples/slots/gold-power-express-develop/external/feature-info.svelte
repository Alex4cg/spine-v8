<script lang="ts">
  import { initializeLocales } from './utils';
  // @ts-ignore // TODO fix this
  import imgFeature_1 from "./assets/game-features/feature_1.png"
  // @ts-ignore // TODO fix this
  import imgFeature_2 from "./assets/game-features/feature_2.png"
  // @ts-ignore // TODO fix this
  import imgFeature_3 from "./assets/game-features/feature_3.png"

  const {
    FeaturesSectionInfoComponent,
    addMessages,
    translate,
    extraBetsMultipliers
  }: FeatureInfoProps = $props();

  $effect(() => {
    initializeLocales(addMessages);
  });

  const getGameSections = () => [
    {
      title: translate('game_features_section.feature_1.title'),
      content: translate(`game_features_section.feature_1.content`, {
        values: {
          betMultiplierLimitFrom: 2,
          betMultiplierLimitTo: 100,
          cashMultiplierLimitFrom: 2,
          cashMultiplierLimitTo: 100
        }
      }),
      img: imgFeature_1,
    },
    {
      title: translate('game_features_section.feature_2.title'),
      content: translate('game_features_section.feature_2.content'),
      img: imgFeature_2,
    },
    {
      title: translate('game_features_section.feature_3.title'),
      content: translate('game_features_section.feature_3.content'),
      img: imgFeature_3,
    },
  ];

</script>

{#if FeaturesSectionInfoComponent}
  <FeaturesSectionInfoComponent featureSectionsInfo={getGameSections()} />
{/if}
