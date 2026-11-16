import type { Plan } from "../model";
export function NumberField({
  label,
  value,
  onChange,
  min = 0,
  max = 10000000,
  step = 1,
  suffix = "CAD",
}: {
  readonly label: string;
  readonly value: number;
  readonly onChange: (n: number) => void;
  readonly min?: number;
  readonly max?: number;
  readonly step?: number;
  readonly suffix?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <div className="input-unit">
        <input
          name={label}
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => {
            const n = e.currentTarget.valueAsNumber;
            if (e.currentTarget.validity.valid && Number.isFinite(n) && n >= min && n <= max) onChange(n);
          }}
        />
        <span>{suffix}</span>
      </div>
    </label>
  );
}
export function GoalFields({
  plan,
  onChange,
}: {
  readonly plan: Plan;
  readonly onChange: (plan: Plan) => void;
}) {
  return (
    <div className="form-grid">
      <NumberField
        label="Home price"
        value={plan.price}
        min={100000}
        max={5000000}
        step={10000}
        onChange={(price) => onChange({ ...plan, price })}
      />
      <NumberField
        label="Down payment"
        value={plan.downPercent}
        min={20}
        max={100}
        suffix="%"
        onChange={(downPercent) => onChange({ ...plan, downPercent })}
      />
      <NumberField
        label="Closing costs"
        value={plan.closing}
        max={500000}
        onChange={(closing) => onChange({ ...plan, closing })}
      />
      <NumberField
        label="Moving costs"
        value={plan.moving}
        max={100000}
        onChange={(moving) => onChange({ ...plan, moving })}
      />
      <NumberField
        label="Cash reserve after purchase"
        value={plan.reserve}
        max={500000}
        onChange={(reserve) => onChange({ ...plan, reserve })}
      />
      <NumberField
        label="Monthly house contribution"
        value={plan.monthly}
        max={100000}
        onChange={(monthly) => onChange({ ...plan, monthly })}
      />
    </div>
  );
}
