import { useTranslation } from 'react-i18next';

export function getBilingual(item, isAr) {
  if (!item) return {};

  const fr = {
    titre:         item.titre         || item.titre_ar || '',
    description:   item.description   || item.description_ar || '',
    diplome:       item.diplome       || item.diplome_ar || '',
    texte_complet: item.texte_complet || item.texte_complet_ar || '',
  };

  const ar = {
    titre:         item.titre_ar         || item.titre         || '',
    description:   item.description_ar   || item.description   || '',
    diplome:       item.diplome_ar        || item.diplome       || '',
    texte_complet: item.texte_complet_ar  || item.texte_complet || '',
  };

  return isAr ? ar : fr;
}

export default function useBilingual(item) {
  const { i18n } = useTranslation();
  const isAr = i18n.language?.startsWith('ar');

  return getBilingual(item, isAr);
}
