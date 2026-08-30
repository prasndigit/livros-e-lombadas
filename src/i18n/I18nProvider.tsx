import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppLang, DEFAULT_LANG, getAppLang, languageName as rawLanguageName, setAppLang } from './langs';
import { TRANSLATIONS } from './strings';

type Vars = Record<string, string | number>;

interface I18nValue {
  lang: AppLang;
  ready: boolean;
  setLang: (code: AppLang) => void;
  t: (key: string, vars?: Vars) => string;
  /** Picks the `_one` / `_other` form of `keyBase` for `count`. */
  plural: (count: number, keyBase: string) => string;
  /** Localised language name for the "found in another language" badge. */
  langName: (code: string | undefined | null) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

function interpolate(template: string, vars?: Vars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`));
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<AppLang>(DEFAULT_LANG);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    getAppLang().then((l) => {
      setLangState(l);
      setReady(true);
    });
  }, []);

  const setLang = useCallback((code: AppLang) => {
    setLangState(code);
    setAppLang(code);
  }, []);

  const value = useMemo<I18nValue>(() => {
    const t = (key: string, vars?: Vars) => {
      const table = TRANSLATIONS[lang] ?? TRANSLATIONS[DEFAULT_LANG];
      const template = table[key] ?? TRANSLATIONS[DEFAULT_LANG][key] ?? key;
      return interpolate(template, vars);
    };
    const plural = (count: number, keyBase: string) => t(`${keyBase}${count === 1 ? '_one' : '_other'}`);
    const langName = (code: string | undefined | null) => rawLanguageName(lang, code);
    return { lang, ready, setLang, t, plural, langName };
  }, [lang, ready, setLang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useT(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useT must be used inside <I18nProvider>');
  return ctx;
}
