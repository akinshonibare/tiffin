export type Verdict = "correct" | "present" | "absent";

const ANSWERS = [
  "MONEY", "SPEND", "SAVED", "COSTS", "BILLS", "DEBIT", "FUNDS", "COINS",
  "GOODS", "PRICE", "CHEAP", "WORTH", "VALUE", "PENNY", "INDEX", "FRAUD",
  "AUDIT", "ASSET", "YIELD", "BONDS", "STOCK", "GRAND", "BUCKS", "DIMES",
  "DEALS", "OFFER", "SALES", "TAXES", "LOANS", "GAINS", "PIGGY", "TREAT",
  "SPLIT", "MINUS", "TOTAL", "GROSS", "OWING", "OWNED", "BANKS", "TRADE",
  "ROUND", "QUOTA", "DRAFT", "WAGER", "TIPSY", "LUNCH", "BREAD", "TOAST",
  "FEAST", "SNACK",
];

export const ANSWER_LIST = ANSWERS;

export function todaysWord(d = new Date()): string {
  const iso = d.toISOString().slice(0, 10);
  let h = 0;
  for (let i = 0; i < iso.length; i++) {
    h = (h * 31 + iso.charCodeAt(i)) >>> 0;
  }
  return ANSWERS[h % ANSWERS.length];
}

export function evaluateGuess(guess: string, answer: string): Verdict[] {
  const g = guess.toUpperCase().split("");
  const a = answer.toUpperCase().split("");
  const result: Verdict[] = Array(5).fill("absent");
  const taken: boolean[] = Array(5).fill(false);
  for (let i = 0; i < 5; i++) {
    if (g[i] === a[i]) {
      result[i] = "correct";
      taken[i] = true;
    }
  }
  for (let i = 0; i < 5; i++) {
    if (result[i] === "correct") continue;
    for (let j = 0; j < 5; j++) {
      if (!taken[j] && g[i] === a[j]) {
        result[i] = "present";
        taken[j] = true;
        break;
      }
    }
  }
  return result;
}

export function emojiRow(verdicts: Verdict[]): string {
  return verdicts
    .map((v) => (v === "correct" ? "🟩" : v === "present" ? "🟨" : "⬛"))
    .join("");
}

const KEY_ROWS = [
  ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
  ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
  ["ENTER", "Z", "X", "C", "V", "B", "N", "M", "BACK"],
];

export const KEYBOARD = KEY_ROWS;
