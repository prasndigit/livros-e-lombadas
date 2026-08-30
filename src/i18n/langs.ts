import { getSetting, setSetting } from '../storage/settingsStore';

// MARC language codes — the same values Open Library's `language:` filter uses,
// so the app language doubles as the search-results language.
export type AppLang = 'por' | 'eng' | 'ger' | 'spa' | 'fre' | 'swe';

export const APP_LANGS: { code: AppLang; short: string; flag: string }[] = [
  { code: 'por', short: 'PT', flag: '🇵🇹' },
  { code: 'eng', short: 'EN', flag: '🇬🇧' },
  { code: 'ger', short: 'DE', flag: '🇩🇪' },
  { code: 'spa', short: 'ES', flag: '🇪🇸' },
  { code: 'fre', short: 'FR', flag: '🇫🇷' },
  { code: 'swe', short: 'SV', flag: '🇸🇪' },
];

export const DEFAULT_LANG: AppLang = 'por';

// Language names as shown in the "found in another language" badge, per app language.
const LANGUAGE_NAMES: Record<AppLang, Record<string, string>> = {
  por: { por: 'português', eng: 'inglês', ger: 'alemão', spa: 'espanhol', fre: 'francês', swe: 'sueco', ita: 'italiano', dut: 'neerlandês', rus: 'russo', pol: 'polaco', cat: 'catalão' },
  eng: { por: 'Portuguese', eng: 'English', ger: 'German', spa: 'Spanish', fre: 'French', swe: 'Swedish', ita: 'Italian', dut: 'Dutch', rus: 'Russian', pol: 'Polish', cat: 'Catalan' },
  ger: { por: 'Portugiesisch', eng: 'Englisch', ger: 'Deutsch', spa: 'Spanisch', fre: 'Französisch', swe: 'Schwedisch', ita: 'Italienisch', dut: 'Niederländisch', rus: 'Russisch', pol: 'Polnisch', cat: 'Katalanisch' },
  spa: { por: 'portugués', eng: 'inglés', ger: 'alemán', spa: 'español', fre: 'francés', swe: 'sueco', ita: 'italiano', dut: 'neerlandés', rus: 'ruso', pol: 'polaco', cat: 'catalán' },
  fre: { por: 'portugais', eng: 'anglais', ger: 'allemand', spa: 'espagnol', fre: 'français', swe: 'suédois', ita: 'italien', dut: 'néerlandais', rus: 'russe', pol: 'polonais', cat: 'catalan' },
  swe: { por: 'portugisiska', eng: 'engelska', ger: 'tyska', spa: 'spanska', fre: 'franska', swe: 'svenska', ita: 'italienska', dut: 'nederländska', rus: 'ryska', pol: 'polska', cat: 'katalanska' },
};

export function languageName(appLang: AppLang, code: string | undefined | null): string {
  const table = LANGUAGE_NAMES[appLang] ?? LANGUAGE_NAMES.por;
  if (!code) return table.eng;
  return table[code] ?? code;
}

const SETTING_KEY = 'appLang';

export async function getAppLang(): Promise<AppLang> {
  const stored = await getSetting(SETTING_KEY);
  return APP_LANGS.some((l) => l.code === stored) ? (stored as AppLang) : DEFAULT_LANG;
}

export async function setAppLang(code: AppLang): Promise<void> {
  await setSetting(SETTING_KEY, code);
}
