import type { Plan } from "../model";

export function mortgage(principal: number, annualRate: number, years: number) {
  const rate = (1 + annualRate / 200) ** (1 / 6) - 1;
  return rate === 0 ? principal / (years * 12) : (principal * rate) / (1 - (1 + rate) ** (-years * 12));
}

export function homeTarget(plan: Plan) {
  return (plan.price * plan.downPercent) / 100 + plan.closing + plan.moving + plan.reserve;
}

export function projection(saved: number, plan: Plan) {
  const monthlyRate = (1 + plan.annualReturn / 100) ** (1 / 12) - 1;
  const target = homeTarget(plan);
  const points = [{ month: 0, value: saved }];
  let value = saved;
  let months = value >= target ? 0 : null;
  for (let month = 1; month <= 600 && months === null; month++) {
    value = value * (1 + monthlyRate) + plan.monthly;
    points.push({ month, value });
    if (value >= target) months = month;
  }
  return { months, points, target };
}

export const duration = (months: number | null) =>
  months === null ? "50+ years" : months === 0 ? "Funded" : `${Math.floor(months / 12)}y ${months % 12}m`;
