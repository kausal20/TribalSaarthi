import { LANGS, setLang, useLang, useT } from '../i18n/i18n';

/** Language picker for the whole site (and for the AI's replies). */
export function LanguageSwitch() {
  const lang = useLang();
  const t = useT();
  return (
    <div className="lang-switch" role="group" aria-label={t('Language')}>
      {LANGS.map((l) => (
        <button key={l.id} type="button" lang={l.id} aria-pressed={lang === l.id} onClick={() => setLang(l.id)}>{l.label}</button>
      ))}
    </div>
  );
}
