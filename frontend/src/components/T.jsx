import React from 'react';
import { useTranslation } from 'react-i18next';

export function T({ fr, arKey }) {
  const { t, i18n } = useTranslation();
  if (i18n.language === 'fr') return <>{fr}</>;
  // Fallback to the arKey using i18next, or default back to FR if missing
  const arTranslation = t(arKey, { defaultValue: fr });
  return <>{arTranslation}</>;
}

export function THTML({ fr, arKey }) {
  const { t, i18n } = useTranslation();
  if (i18n.language === 'fr') return <span dangerouslySetInnerHTML={{__html: fr}} />;
  const arTranslation = t(arKey, { defaultValue: fr });
  return <span dangerouslySetInnerHTML={{__html: arTranslation}} />;
}
