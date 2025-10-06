import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import resourcesToBackend from "i18next-resources-to-backend";

i18n
  .use(initReactI18next)
  .use(
    resourcesToBackend((language: string, namespace: string) => {
      return import(`@/translations/${language}/${namespace}.json`);
    })
  )
  .init({
    lng: "en",
    fallbackLng: "en",
    supportedLngs: ["en", "el"],
    defaultNS: "common",
    fallbackNS: "common",
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: false,
    },
  });

export default i18n;
