import { Area, AreaChart } from "@finguin/bklit/charts/area-chart";
import { Grid } from "@finguin/bklit/charts/grid";
import { ChartTooltip, TooltipContent } from "@finguin/bklit/charts/tooltip/index";
import { XAxis } from "@finguin/bklit/charts/x-axis";
import { useReducedMotion } from "motion/react";
import { dollars } from "../model";

type Point = { readonly label: string; readonly value: number };

export function TrendChart({
  points,
  target,
  aspectRatio = "3 / 1",
  summary,
  valueLabel,
}: {
  readonly points: readonly Point[];
  readonly target?: number;
  readonly aspectRatio?: string;
  readonly summary: string;
  readonly valueLabel: string;
}) {
  const reducedMotion = useReducedMotion();
  if (points.length < 2) return null;
  const data = points.map((p, i) => ({ date: new Date(2026, i, 1), value: p.value, target: target ?? 0 }));
  const labels = points.map((p) => p.label);
  return (
    <figure className="chart" aria-label={summary}>
      <AreaChart
        data={data}
        aspectRatio={aspectRatio}
        margin={{ top: 12, right: 8, bottom: 26, left: 8 }}
        animationDuration={reducedMotion ? 0 : 600}
      >
        <Grid horizontal numTicksRows={3} strokeDasharray="2,4" />
        {target !== undefined && (
          <Area
            dataKey="target"
            fillOpacity={0}
            showHighlight={false}
            stroke="var(--line-strong)"
            strokeWidth={1}
          />
        )}
        <Area dataKey="value" fill="var(--positive)" fillOpacity={0.16} fadeBottom={100} strokeWidth={2} />
        <XAxis labels={labels} numTicks={6} />
        <ChartTooltip
          dateLabels={labels}
          content={({ index }) => {
            const point = points[index];
            if (!point) return null;
            const rows = [{ color: "var(--positive)", label: valueLabel, value: dollars(point.value) }];
            if (target !== undefined)
              rows.push({ color: "var(--line-strong)", label: "Target", value: dollars(target) });
            return <TooltipContent title={point.label} rows={rows} />;
          }}
        />
      </AreaChart>
    </figure>
  );
}

export function projectionPoints(points: readonly { readonly month: number; readonly value: number }[]) {
  const stride = Math.max(1, Math.floor(points.length / 40));
  return points
    .filter((_, i) => i % stride === 0 || i === points.length - 1)
    .map((p) => ({ label: p.month === 0 ? "Today" : `Month ${p.month}`, value: p.value }));
}
