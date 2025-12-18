import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import esTranslation from './locales/es/translation.json';
import enTranslation from './locales/en/translation.json';
import ptTranslation from './locales/pt/translation.json';

i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
        resources: {
            es: { translation: esTranslation },
            en: { translation: enTranslation },
            pt: { translation: ptTranslation }
        },
        fallbackLng: 'pt', // Portugués como idioma por defecto
        interpolation: {
            escapeValue: false // React ya escapa los valores
        },
        detection: {
            order: ['localStorage', 'navigator'],
            caches: ['localStorage'],
            lookupLocalStorage: 'astra-language'
        }
    });

export default i18n;
