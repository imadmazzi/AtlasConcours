import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import frTranslation from './locales/fr.json';
import arTranslation from './locales/ar.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      fr: { translation: frTranslation },
      ar: { translation: arTranslation }
    },
    fallbackLng: 'fr',
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'ac_lang',
    },
    interpolation: {
      escapeValue: false 
    }
  });

export default i18n;
