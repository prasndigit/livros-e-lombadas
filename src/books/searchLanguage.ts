import { getSetting, setSetting } from '../storage/settingsStore';

// MARC language codes, as Open Library's `language:` filter expects them.
export type SearchLang = 'por' | 'eng' | 'ger' | 'spa' | 'fre' | 'swe';

export const SEARCH_LANGS: { code: SearchLang; short: string; name: string }[] = [
  { code: 'por', short: 'PT', name: 'português' },
  { code: 'eng', short: 'EN', name: 'inglês' },
  { code: 'ger', short: 'DE', name: 'alemão' },
  { code: 'spa', short: 'ES', name: 'espanhol' },
  { code: 'fre', short: 'FR', name: 'francês' },
  { code: 'swe', short: 'SV', name: 'sueco' },
];

export const DEFAULT_LANG: SearchLang = 'por';

// Names for languages that aren't selectable but may show up as "found in another
// language" badges.
const EXTRA_LANG_NAMES: Record<string, string> = {
  ita: 'italiano',
  dut: 'neerlandês',
  rus: 'russo',
  pol: 'polaco',
  cat: 'catalão',
  lat: 'latim',
  gre: 'grego',
  jpn: 'japonês',
  chi: 'chinês',
  ara: 'árabe',
};

export function languageName(code: string | undefined | null): string {
  if (!code) return 'outro idioma';
  const known = SEARCH_LANGS.find((l) => l.code === code);
  return known?.name ?? EXTRA_LANG_NAMES[code] ?? code;
}

const SETTING_KEY = 'searchLang';

export async function getSearchLang(): Promise<SearchLang> {
  const stored = await getSetting(SETTING_KEY);
  return SEARCH_LANGS.some((l) => l.code === stored) ? (stored as SearchLang) : DEFAULT_LANG;
}

export async function setSearchLang(code: SearchLang): Promise<void> {
  await setSetting(SETTING_KEY, code);
}
