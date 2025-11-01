import type { ActivitySample } from '../types';

interface ActivityCardProps {
  history: ActivitySample[];
  onOpenGraph: () => void;
}

export function ActivityCard({ history, onOpenGraph }: ActivityCardProps) {
  const normalized = normalizeHistory(history);

  return (
    <section className="card activity-card" aria-label="Activity last 10 minutes">
      <header className="card-header">
        <div>
          <h2>Activity</h2>
          <p className="card-subtitle">10 minute trend</p>
        </div>
        <button className="btn secondary" type="button" onClick={onOpenGraph}>
          Open Graph
        </button>
      </header>
      <div className="activity-bars">
        {normalized.map((bucket) => (
          <div key={bucket.key} className="activity-bar">
            <div
              className={`activity-fill ${bucket.movement ? 'active' : ''}`}
              style={{ height: bucket.movement ? '100%' : '20%' }}
            />
            <span className="activity-label">{bucket.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function normalizeHistory(history: ActivitySample[]): {
  key: string;
  movement: boolean;
  label: string;
}[] {
  const now = Date.now();
  const buckets: {
    key: string;
    movement: boolean;
    label: string;
  }[] = [];

  for (let minutesAgo = 9; minutesAgo >= 0; minutesAgo -= 1) {
    const windowStart = now - minutesAgo * 60 * 1000;
    const windowEnd = windowStart + 60 * 1000;
    const match = history.find(
      (item) => item.ts >= windowStart && item.ts < windowEnd
    );
    buckets.push({
      key: `${minutesAgo}`,
      movement: Boolean(match?.movement),
      label: minutesAgo === 0 ? 'Now' : `-${minutesAgo}m`,
    });
  }

  return buckets;
}
