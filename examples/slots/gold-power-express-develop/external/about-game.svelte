<script lang="ts">
  import { initializeLocales } from './utils';

  const {
    rtpValue = 0,
    maxWinValue = 0,
    AboutGameSectionComponent,
    addMessages,
    translate,
    json
  }: AboutGameProps = $props();

  $effect(() => {
    initializeLocales(addMessages);
  });

  const getGameSections = () => [
    {
      title: translate('about_game_section.max_win.title'),
      content: translate('about_game_section.max_win.content', {values: {maxWinValue}}),
    },
    {
      title: translate('about_game_section.how_to_play.title'),
      content: translate('about_game_section.how_to_play.content'),
    },
    {
      title: translate('about_game_section.how_to_calculate_wins.title'),
      content: translate('about_game_section.how_to_calculate_wins.content'),
    },
    {
      title: translate('about_game_section.game_options.title'),
      content: json('about_game_section.game_options.content') as string[],
    },
    {
      title: translate('about_game_section.game_panel.title'),
      content: json('about_game_section.game_panel.content') as string[],
    },
    {
      title: translate('about_game_section.rtp_information.title'),
      content: translate('about_game_section.rtp_information.content', {values: {rtpValue}}),
    },
    {
      title: translate('about_game_section.additional_information.title'),
      content: translate('about_game_section.additional_information.content'),
    }
  ];

</script>

{#if AboutGameSectionComponent}
  <AboutGameSectionComponent aboutSectionsInfo={getGameSections()} />
{/if}
