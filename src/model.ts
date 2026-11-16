import { z } from "zod";

export const planSchema = z.object({
  price: z.number().min(100000).max(5000000),
  downPercent: z.number().min(20).max(100),
  closing: z.number().min(0).max(500000),
  moving: z.number().min(0).max(100000),
  reserve: z.number().min(0).max(500000),
  monthly: z.number().min(0).max(100000),
  rate: z.number().min(0).max(20),
  years: z.number().int().min(5).max(30),
  annualReturn: z.number().min(-20).max(20),
  grossIncome: z.number().min(0).max(10000000),
  propertyTax: z.number().min(0).max(20000),
  heating: z.number().min(0).max(10000),
  insurance: z.number().min(0).max(10000),
  maintenance: z.number().min(0).max(10000),
});
export type Plan = Readonly<z.infer<typeof planSchema>>;
export const defaultPlan: Plan = {
  price: 500000,
  downPercent: 20,
  closing: 10000,
  moving: 2000,
  reserve: 10000,
  monthly: 1000,
  rate: 5,
  years: 25,
  annualReturn: 3,
  grossIncome: 0,
  propertyTax: 300,
  heating: 100,
  insurance: 100,
  maintenance: 200,
};
export const money = (cents: number) =>
  new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(
    cents / 100,
  );
export const dollars = (value: number) => money(value * 100);
export const shortMonth = (month: string) =>
  new Date(`${month}-15T12:00:00`).toLocaleDateString("en-CA", { month: "short" });
export const dayLabel = (date: string) =>
  new Date(`${date}T12:00:00`).toLocaleDateString("en-CA", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
export const shortDate = (date: string) =>
  new Date(`${date}T12:00:00`).toLocaleDateString("en-CA", { month: "short", day: "numeric" });
export const monthLabel = (month: string) =>
  new Date(`${month}-15T12:00:00`).toLocaleDateString("en-CA", { month: "long", year: "numeric" });
