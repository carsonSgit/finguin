import type { ExpenseCategory } from "./types";

type Rule = readonly [pattern: RegExp, merchant: string, category: ExpenseCategory];

const rules: readonly Rule[] = [
  [/^iga\b/i, "IGA", "Groceries"],
  [/provigo/i, "Provigo", "Groceries"],
  [/h-?mart/i, "H Mart", "Groceries"],
  [/adonis/i, "Adonis", "Groceries"],
  [/couche-?tard/i, "Couche-Tard", "Convenience"],
  [/^saq\d/i, "SAQ", "Convenience"],
  [/vending/i, "Vending machine", "Convenience"],
  [/ubereats/i, "Uber Eats", "Dining"],
  [/^uber\b/i, "Uber", "Transport"],
  [/chrono-recharge opus/i, "OPUS monthly pass", "Transport"],
  [/^gare /i, "exo train", "Transport"],
  [/time out/i, "Time Out Market", "Dining"],
  [/popeye/i, "Popeyes", "Dining"],
  [/jean coutu/i, "Jean Coutu", "Health"],
  [/pharmaprix/i, "Pharmaprix", "Health"],
  [/lush/i, "Lush", "Personal care"],
  [/sqdc/i, "SQDC", "Cannabis & vape"],
  [/semrush/i, "Semrush", "Subscriptions"],
  [/midjourney/i, "Midjourney", "Subscriptions"],
  [/mistral/i, "Mistral AI", "Subscriptions"],
  [/paper\.design/i, "Paper", "Subscriptions"],
  [/vercel/i, "Vercel", "Subscriptions"],
  [/opencode/i, "opencode", "Subscriptions"],
  [/^anomaly$/i, "OpenCode", "Subscriptions"],
  [/nintendo/i, "Nintendo eShop", "Entertainment"],
  [/eb games/i, "EB Games", "Entertainment"],
  [/steam/i, "Steam", "Entertainment"],
  [/harvard bus/i, "Harvard Business Publishing", "Education"],
  [/ebooks\.com|indigo/i, "", "Education"],
  [/dollarama/i, "Dollarama", "Shopping"],
  [/miniso/i, "Miniso", "Shopping"],
  [/walmart/i, "Walmart", "Shopping"],
  [/zara/i, "Zara", "Shopping"],
  [/brandy melville/i, "Brandy Melville", "Shopping"],
  [/holt renfrew/i, "Holt Renfrew", "Shopping"],
  [/simons/i, "Simons", "Shopping"],
  [/marshalls/i, "Marshalls", "Shopping"],
];

const tidy = (payee: string) =>
  payee
    .replace(/\s+\d{3,}$/, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/\b\p{L}/gu, (c) => c.toUpperCase());

export function classifyMerchant(payee: string): { merchant: string; category: ExpenseCategory } {
  const rule = rules.find(([pattern]) => pattern.test(payee));
  if (!rule) return { merchant: tidy(payee) || "Card purchase", category: "Uncategorized" };
  const [, merchant, category] = rule;
  return { merchant: merchant || tidy(payee), category };
}
