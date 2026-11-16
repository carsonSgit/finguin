import { useState } from "react";
import type { Mutate } from "../App";
import { api } from "../api";
import { duration, projection } from "../domain/plan";
import type { Snapshot } from "../domain/types";
import { dollars } from "../model";
import { projectionPoints, TrendChart } from "./Chart";
import { NumberField } from "./PlanFields";
import { Card } from "./ui";

export function Scenarios({ snapshot, mutate }: { readonly snapshot: Snapshot; readonly mutate: Mutate }) {
  const [extra, setExtra] = useState(500);
  const [growth, setGrowth] = useState(snapshot.plan.annualReturn);
  const [price, setPrice] = useState(snapshot.plan.price);
  const [applied, setApplied] = useState(false);
  const saved = Math.round(snapshot.accounts.reduce((s, a) => s + a.balance * a.homeShare, 0) / 100);
  const baseline = projection(saved, snapshot.plan);
  const scenario = {
    ...snapshot.plan,
    monthly: Math.max(0, snapshot.plan.monthly + extra),
    annualReturn: growth,
    price,
  };
  const result = projection(saved, scenario);
  const difference =
    baseline.months !== null && result.months !== null ? baseline.months - result.months : null;
  const touch =
    <T,>(set: (v: T) => void) =>
    (v: T) => {
      set(v);
      setApplied(false);
    };
  return (
    <div className="grid-2">
      <Card>
        <div className="card-head">
          <h2>What if</h2>
        </div>
        <div className="fields">
          <NumberField
            label="Extra each month"
            value={extra}
            min={-snapshot.plan.monthly}
            max={100000 - snapshot.plan.monthly}
            step={100}
            onChange={touch(setExtra)}
          />
          <input
            name="extraContribution"
            type="range"
            aria-label="Extra monthly savings"
            min={-snapshot.plan.monthly}
            max={Math.min(5000, 100000 - snapshot.plan.monthly)}
            step={100}
            value={extra}
            onChange={(e) => touch(setExtra)(Number(e.target.value))}
          />
          <NumberField
            label="Annual return"
            value={growth}
            min={-20}
            max={20}
            step={0.5}
            suffix="%"
            onChange={touch(setGrowth)}
          />
          <NumberField
            label="Home price"
            value={price}
            min={100000}
            max={5000000}
            step={10000}
            onChange={touch(setPrice)}
          />
        </div>
        <button
          type="button"
          className="primary"
          disabled={applied}
          onClick={() => {
            void mutate(() => api.savePlan(scenario));
            setExtra(0);
            setApplied(true);
          }}
        >
          {applied ? "Applied to plan" : "Apply to plan"}
        </button>
      </Card>
      <Card>
        <div className="compare">
          <div>
            <span className="muted">Current plan</span>
            <strong>{duration(baseline.months)}</strong>
          </div>
          <span className="muted">→</span>
          <div>
            <span className="muted">This scenario</span>
            <strong>{duration(result.months)}</strong>
          </div>
        </div>
        <TrendChart
          valueLabel="Projected savings"
          points={projectionPoints(result.points)}
          target={result.target}
          aspectRatio="2 / 1"
          summary={`Scenario reaches ${dollars(result.target)} in ${duration(result.months)}`}
        />
        <p className="goal-figure">
          {difference === null
            ? "Try a larger contribution."
            : difference > 0
              ? `${difference} months sooner`
              : difference < 0
                ? `${-difference} months later`
                : "Same timeline"}
        </p>
        <p className="footnote">
          {dollars(scenario.monthly)}/mo toward {dollars(result.target)}. Month-end contributions; excludes
          taxes, fees and eligibility.
        </p>
      </Card>
    </div>
  );
}
