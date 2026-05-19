import React from 'react';
import { tr, getLang } from '../i18n';

export function T({ fr, arKey }) {
  const lang = getLang();
  if (lang === 'fr') return <>{fr}</>;
  return <>{tr(arKey)}</>;
}

export function THTML({ fr, arKey }) {
  const lang = getLang();
  if (lang === 'fr') return <span dangerouslySetInnerHTML={{__html: fr}} />;
  return <span dangerouslySetInnerHTML={{__html: tr(arKey)}} />;
}
