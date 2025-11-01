import type { TempStatus, TemperatureSample } from '../types';

interface TemperatureCardProps {
  tempC: number | null;
  status: TempStatus;
  history: TemperatureSample[];
}

const statusColors: Record<TempStatus, string> = {
  low: '#38bdf8',
  normal: '#22c55e',
  elevated: '#f59e0b',
  fever: '#ef4444',
};

export function TemperatureCard({
  tempC,
  status,
  history,
}: TemperatureCardProps) {
  const displayTemp =
    tempC == null ? 'N/A' : `${tempC.toFixed(1)} °C (${toFahrenheit(tempC)} °F)`;

  const sparkline = createSparklinePath(history);

  return (
    <section className="card temperature-card" aria-label="Temperature trend">
      <header className="card-header">
        <div>
          <h2>Temperature</h2>
          <p className="card-subtitle">Last 2 hours</p>
        </div>
        <span
          className="status-pill"
          style={{ backgroundColor: statusColors[status] }}
        >
          {status.toUpperCase()}
        </span>
      </header>
      <div className="temperature-main" aria-live="polite">
        {displayTemp}
      </div>
      <div className="sparkline" aria-hidden="true">
        <svg viewBox="0 0 200 60" preserveAspectRatio="none">
          {sparkline ? (
            <>
              <path className="sparkline-area" d={sparkline.area} />
              <path className="sparkline-line" d={sparkline.line} />
            </>
          ) : (
            <line
              x1="0"
              y1="30"
              x2="200"
              y2="30"
              stroke="#1f2937"
              strokeWidth="2"
            />
          )}
        </svg>
      </div>
    </section>
  );
}

function toFahrenheit(tempC: number): string {
  const fahrenheit = tempC * 1.8 + 32;
  return fahrenheit.toFixed(1);
}

function createSparklinePath(history: TemperatureSample[] | null) {
  if (!history || history.length === 0) {
    return null;
  }

  const values = history.map((entry) => entry.value);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const range = Math.max(0.5, maxValue - minValue);

  const points = history.map((entry, index) => {
    const x = (index / Math.max(1, history.length - 1)) * 200;
    const normalized = (entry.value - minValue) / range;
    const y = 55 - normalized * 50;
    return { x, y };
  });

  const line = points
    .map((pt, idx) => (idx === 0 ? `M${pt.x},${pt.y}` : `L${pt.x},${pt.y}`))
    .join(' ');
  const area = `${line} L200,60 L0,60 Z`;

  return { line, area };
}
