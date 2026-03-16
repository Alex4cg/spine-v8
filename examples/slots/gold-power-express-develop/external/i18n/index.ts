import en_EN from "./en-EN.json"
import en_EN_SOCIAL from "./en-EN-SOCIAL.json"
import ruRu from './ru-RU.json'
import frFr from './fr-FR.json'
import ptBr from './pt-BR.json'
import zhCN from './zh-CN.json'

export type LocaleData = typeof en_EN;

export const locales = {
  "en-EN": en_EN,
  "en-EN-SOCIAL": en_EN_SOCIAL,
  "ru-RU": ruRu,
  "fr-FR": frFr,
  "pt-BR": ptBr,
  "zh-CN": zhCN
} as const;

export type SupportedLocale = keyof typeof locales;

export const getLocaleData = (locale: SupportedLocale): LocaleData => {
  return locales[locale];
};

export const getSupportedLocales = (): SupportedLocale[] => {
  return Object.keys(locales) as SupportedLocale[];
};

let isInitialized = false;

export const initializeLocales = (
  addMessages: (locale: string, messages: any) => void
) => {
  if (!isInitialized) {
    getSupportedLocales().forEach((lang: SupportedLocale) => {
      addMessages(lang, locales[lang]);
    });
    isInitialized = true;
  }
};

export default locales;
