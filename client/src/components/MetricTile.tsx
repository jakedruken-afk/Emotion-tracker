type MetricTileProps = {
  label: string;
  value: string | number;
  detail?: string;
  tone?: "coral" | "sky" | "gold" | "mint" | "plum";
};

const toneClasses: Record<NonNullable<MetricTileProps["tone"]>, string> = {
  coral: "metric-tile-coral",
  sky: "metric-tile-sky",
  gold: "metric-tile-gold",
  mint: "metric-tile-mint",
  plum: "metric-tile-plum",
};

export default function MetricTile({
  label,
  value,
  detail,
  tone = "sky",
}: MetricTileProps) {
  return (
    <div className={`metric-tile ${toneClasses[tone]}`}>
      <p className="metric-label">{label}</p>
      <p className="metric-value">{value}</p>
      {detail ? <p className="metric-detail">{detail}</p> : null}
    </div>
  );
}
