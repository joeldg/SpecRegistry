export type ChartDatum = { label: string; value: number; tone?: "accent" | "green" | "amber" | "red" };

export const toneColor: Record<NonNullable<ChartDatum["tone"]>, string> = {
  accent: "#5e6ad2",
  green: "#3fb950",
  amber: "#d29922",
  red: "#f85149",
};

export function total(values: Array<{ n: number }>) {
  return values.reduce((sum, row) => sum + Number(row.n ?? 0), 0);
}

export function fmtTokens(value: number | null | undefined) {
  const n = Number(value ?? 0);
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(Math.round(n));
}

export function BarChart({ data }: { data: ChartDatum[] }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="report-chart" role="img">
      {data.map((d) => (
        <div className="report-bar-row" key={d.label}>
          <div className="report-bar-label">{d.label}</div>
          <div className="report-bar-track">
            <div
              className="report-bar-fill"
              style={{ width: `${Math.max(4, (d.value / max) * 100)}%`, background: toneColor[d.tone ?? "accent"] }}
            />
          </div>
          <div className="report-bar-value mono">{d.value}</div>
        </div>
      ))}
    </div>
  );
}

export function DonutChart({ data }: { data: ChartDatum[] }) {
  const sum = data.reduce((acc, item) => acc + item.value, 0);
  let offset = 25;
  return (
    <div className="donut-wrap">
      <svg className="donut" viewBox="0 0 42 42" aria-hidden="true">
        <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="var(--border)" strokeWidth="6" />
        {data.map((d) => {
          const length = sum ? (d.value / sum) * 100 : 0;
          const strokeDasharray = `${length} ${100 - length}`;
          const strokeDashoffset = offset;
          offset -= length;
          return (
            <circle
              key={d.label}
              cx="21"
              cy="21"
              r="15.915"
              fill="transparent"
              stroke={toneColor[d.tone ?? "accent"]}
              strokeWidth="6"
              strokeDasharray={strokeDasharray}
              strokeDashoffset={strokeDashoffset}
            />
          );
        })}
        <text x="21" y="22" textAnchor="middle" className="donut-number">
          {sum}
        </text>
      </svg>
      <div className="legend">
        {data.map((d) => (
          <span key={d.label}>
            <i style={{ background: toneColor[d.tone ?? "accent"] }} /> {d.label} <b>{d.value}</b>
          </span>
        ))}
      </div>
    </div>
  );
}
