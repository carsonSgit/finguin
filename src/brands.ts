import {
  type SimpleIcon,
  siMistralai,
  siOpencode,
  siSemrush,
  siUber,
  siUbereats,
  siVercel,
  siZara,
} from "simple-icons";

const brands: readonly (readonly [string, SimpleIcon])[] = [
  ["uber eats", siUbereats],
  ["uber", siUber],
  ["zara", siZara],
  ["mistral", siMistralai],
  ["vercel", siVercel],
  ["semrush", siSemrush],
  ["opencode", siOpencode],
];

export function brandFor(merchant: string): SimpleIcon | undefined {
  const text = merchant.toLowerCase();
  return brands.find(([keyword]) => text.includes(keyword))?.[1];
}
