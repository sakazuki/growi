import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';
import locales from '@root/resource/locales';
import LanguageDetectorWrapper from './LanguageDetectorWrapper';

// extract metadata list from 'resource/locales/${locale}/meta.json'
export const localeMetadatas = Object.values(locales).map(locale => locale.meta);

export const i18nFactory = (userLocaleId) => {
  // setup LanguageDetector
  const langDetector = new LanguageDetector();
  langDetector.addDetector({
    name: 'userSettingDetector',
    lookup(options) {
      return userLocaleId;
    },
  });
  // Defined detection from the browser to convert id
  const languageDetectorWrapper = new LanguageDetectorWrapper(langDetector);

  i18n
    .use(languageDetectorWrapper)
    .use(initReactI18next) // if not using I18nextProvider
    .init({
      debug: (process.env.NODE_ENV !== 'production'),
      resources: locales,
      load: 'currentOnly',

      fallbackLng: 'en_US',
      detection: 'languageDetectorWrapper',

      interpolation: {
        escapeValue: false, // not needed for react!!
      },

      // react i18next special options (optional)
      react: {
        wait: false,
        withRef: true,
        bindI18n: 'languageChanged loaded',
        bindStore: 'added removed',
        nsMode: 'default',
      },
    });

  return i18n;
};
