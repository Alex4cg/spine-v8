import i18n from '@/assets/i18n/text.json';
import { launchParams } from '@clawbuster/facade';

type Language = `en-EN` | `ru-RU` | `fr-FR` | `pt-BR` | `zh-CN`;
type LocalizationFormatterMap = Record<string, Partial<Record<Language, () => string>>>;

export default class LocalizationFormatter {
  readonly FORMAT_MAP: LocalizationFormatterMap = {
    [i18n.aclonicaRegularSmall.welcomeScreen.feature1]: {
      [`en-EN`]: () => this.#applyReplacements(i18n.aclonicaRegularSmall.welcomeScreen.feature1, {
        [`coins `]: `coins\n`,
        [`the\n`]: `the `,
        [`triggers `]: `triggers\n`
      })
    },

    [i18n.aclonicaRegularSmall.welcomeScreen.feature2]: {
      [`en-EN`]: () =>
        this.#applyReplacements(i18n.aclonicaRegularSmall.welcomeScreen.feature2, {
          [`reel\n`]: `reel `,
          [`triggers `]: `triggers\n`
        })
    },

    [i18n.aclonicaRegularSmall.welcomeScreen.feature3]: {
      [`en-EN`]: () =>
        this.#applyReplacements(i18n.aclonicaRegularSmall.welcomeScreen.feature3, {
          [`jackpot\n`]: `jackpot `,
          [`with `]: `with\n`
        })
    }
  };

  tryFormatting(text: string) {
    return this.FORMAT_MAP[text]?.[launchParams.language as Language]?.() ?? text;
  }

  #applyReplacements(input: string, rules: Record<string, string>): string {
    let output = input;

    for (const [from, to] of Object.entries(rules)) {
      const regex = new RegExp(from.replace(/[.*+?^${}()|[\]\\]/g, `\\$&`), `g`);
      output = output.replace(regex, to);
    }

    return output;
  }
}
