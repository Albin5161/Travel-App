/**
 * What a name may be: letters in any language ("Albin", "ആൽബിൻ", "अल्बिन"), with spaces, hyphens,
 * apostrophes and full stops between them ("Mary-Ann", "D'Souza", "K. Albin"). No numbers, symbols
 * or emoji, and at least one letter. One rule for the name step, Profile and Join a trip.
 *
 * Written without \p{L}: refusing what can't be in a name is enough, and works in every engine.
 */
// Digits, including Devanagari and Malayalam ones.
const DIGITS = /[0-9०-९൦-൯]/;
// Symbols a name doesn't have.
const SYMBOLS = /[!-&(-,/:-@[-`{-~¡-¿×÷‐-―‘‚-‟†-‾₠-⃏℀-⅏]/;
// Emoji and pictographs: most sit past U+FFFF (a surrogate pair), the rest in the symbol blocks.
const EMOJI = /[\uD800-\uDBFF][\uDC00-\uDFFF]|[←-⇿⌀-⏿①-➿⬀-⯿️]/;
// What may sit between letters: the space, the hyphen, the apostrophes (straight and curly), the stop.
const JOINERS = /[\s\-'’.]/g;

export const NAME_MISSING = 'Add your first name to continue.';
export const NAME_LETTERS = 'Use letters only. No numbers or symbols.';

/** What's wrong with a name, as words to show, or null when it's fine. */
export function nameProblem(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return NAME_MISSING;
  if (DIGITS.test(trimmed) || SYMBOLS.test(trimmed) || EMOJI.test(trimmed)) return NAME_LETTERS;
  if (!trimmed.replace(JOINERS, '')) return NAME_LETTERS;
  return null;
}
