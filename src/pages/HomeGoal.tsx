import { useState } from "react";
import type { Mutate } from "../App";
import { api } from "../api";
import { projectionPoints, TrendChart } from "../components/Chart";
import { GoalFields, NumberField } from "../components/PlanFields";
import { Scenarios } from "../components/Scenarios";
import { Card, Emoji, Screen, Tabs } from "../components/ui";
import { contributionRoom, requiredMonthly } from "../domain/insights";
import { duration, homeTarget, mortgage, projection } from "../domain/plan";
import type { Snapshot } from "../domain/types";
import { dollars, type Plan } from "../model";

const tabs = ["Plan", "Scenarios", "Costs"] as const;
type Tab = (typeof tabs)[number];

export function HomeGoal({ snapshot, mutate }: { readonly snapshot: Snapshot; readonly mutate: Mutate }) {
  const [tab, setTab] = useState<Tab>("Plan");
  const p = snapshot.plan;
  const saved = Math.round(snapshot.accounts.reduce((s, a) => s + a.balance * a.homeShare, 0) / 100);
  const forecast = projection(saved, p);
  const progress = Math.min((saved / forecast.target) * 100, 100);
  return (
    <Screen
      title="Home goal"
      actions={<Tabs label="Home goal view" value={tab} options={tabs} onChange={setTab} />}
    >
      {tab === "Scenarios" ? (
        <Scenarios snapshot={snapshot} mutate={mutate} />
      ) : (
        <>
          <Card className="hero">
            <div className="hero-head">
              <p className="label">
                <Emoji name="fhsa" size={18} /> Saved for a home
              </p>
              <p className="hero-value">{dollars(saved)}</p>
              <span className="delta">
                {progress.toFixed(0)}% of {dollars(forecast.target)} · ready in {duration(forecast.months)}
              </span>
            </div>
            <TrendChart
              valueLabel="Projected savings"
              points={projectionPoints(forecast.points)}
              target={forecast.target}
              summary={`Projected to reach ${dollars(forecast.target)} in ${duration(forecast.months)}`}
            />
          </Card>
          {tab === "Plan" ? (
            <PlanTab snapshot={snapshot} mutate={mutate} />
          ) : (
            <CostsTab snapshot={snapshot} mutate={mutate} />
          )}
        </>
      )}
    </Screen>
  );
}

function PlanTab({ snapshot, mutate }: { readonly snapshot: Snapshot; readonly mutate: Mutate }) {
  const p = snapshot.plan;
  const save = (plan: Plan) => mutate(() => api.savePlan(plan));
  const saved = Math.round(snapshot.accounts.reduce((s, a) => s + a.balance * a.homeShare, 0) / 100);
  const target = homeTarget(p);
  const year = new Date().getFullYear();
  const fhsa = snapshot.accounts.find((a) => a.type === "FHSA");
  const room = fhsa ? contributionRoom(snapshot.transactions, fhsa.id, year) : null;
  return (
    <>
      <Card>
        <div className="card-head">
          <h2>Target</h2>
          <span className="muted">{dollars(target)} cash needed</span>
        </div>
        <GoalFields plan={p} onChange={(plan) => void save(plan)} />
        <p className="footnote">
          Down payment of 20% or more, plus your own closing, moving and reserve estimates. Returns:{" "}
          {p.annualReturn}% a year.
        </p>
      </Card>
      <Card>
        <div className="card-head">
          <h2>Funding pace</h2>
          <span className="muted">monthly saving needed to reach {dollars(target)}</span>
        </div>
        <dl className="facts compact">
          {[12, 24, 36].map((months) => (
            <div key={months}>
              <dt>In {months} months</dt>
              <dd>{dollars(requiredMonthly(saved, p, months))}/mo</dd>
            </div>
          ))}
        </dl>
        {room && (
          <p className="footnote">
            FHSA {year}: {dollars(room.contributed / 100)} contributed of {dollars(room.annualLimit / 100)} —{" "}
            {dollars(room.room / 100)} room left.
          </p>
        )}
      </Card>
    </>
  );
}

function CostsTab({ snapshot, mutate }: { readonly snapshot: Snapshot; readonly mutate: Mutate }) {
  const p = snapshot.plan;
  const save = (plan: Plan) => mutate(() => api.savePlan(plan));
  const change = (patch: Partial<Plan>) => void save({ ...p, ...patch });
  const loan = p.price - (p.price * p.downPercent) / 100;
  const payment = mortgage(loan, p.rate, p.years);
  const qualifying = mortgage(loan, Math.max(p.rate + 2, 5.25), p.years);
  const stress = qualifying + p.propertyTax + p.heating;
  const ratio = p.grossIncome > 0 ? (stress / (p.grossIncome / 12)) * 100 : null;
  return (
    <div className="grid-2">
      <Card>
        <div className="card-head">
          <h2>Monthly cost</h2>
          <span className="muted">
            {dollars(payment + p.propertyTax + p.heating + p.insurance + p.maintenance)}
          </span>
        </div>
        <div className="fields">
          <NumberField
            label="Mortgage rate"
            value={p.rate}
            max={20}
            step={0.1}
            suffix="%"
            onChange={(rate) => change({ rate })}
          />
          <NumberField
            label="Amortization"
            value={p.years}
            min={5}
            max={30}
            suffix="yrs"
            onChange={(years) => change({ years })}
          />
          <NumberField
            label="Property tax"
            value={p.propertyTax}
            max={20000}
            onChange={(propertyTax) => change({ propertyTax })}
          />
          <NumberField
            label="Heating"
            value={p.heating}
            max={10000}
            onChange={(heating) => change({ heating })}
          />
          <NumberField
            label="Insurance"
            value={p.insurance}
            max={10000}
            onChange={(insurance) => change({ insurance })}
          />
          <NumberField
            label="Maintenance"
            value={p.maintenance}
            max={10000}
            onChange={(maintenance) => change({ maintenance })}
          />
        </div>
        <p className="footnote">Mortgage {dollars(payment)}/mo, Canadian semi-annual compounding.</p>
      </Card>
      <Card>
        <div className="card-head">
          <h2>Stress test</h2>
          <span className="muted">{ratio === null ? "Add income" : `${ratio.toFixed(1)}% of income`}</span>
        </div>
        <div className="fields">
          <NumberField
            label="Household income / yr"
            value={p.grossIncome}
            onChange={(grossIncome) => change({ grossIncome })}
          />
        </div>
        <p className="goal-figure">
          {dollars(stress)} <span className="muted">/ month at {Math.max(p.rate + 2, 5.25).toFixed(2)}%</span>
        </p>
        <p className="footnote">
          Higher of 5.25% or your rate + 2. An estimate, not a lender decision.{" "}
          <a
            href="https://www.canada.ca/en/financial-consumer-agency/services/mortgages/preparing-mortgage.html"
            target="_blank"
            rel="noreferrer"
          >
            FCAC guidance ↗
          </a>
        </p>
      </Card>
    </div>
  );
}
