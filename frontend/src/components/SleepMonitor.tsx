import type { SensorStats } from '../types';

interface SleepMonitorProps {
  temp: SensorStats | null;
  light: SensorStats | null;
  sound: SensorStats | null;
}

interface StatCardProps {
  title: string;
  icon: string;
  stats: SensorStats | null;
  unit: string;
}

function StatCard({ title, icon, stats, unit }: StatCardProps) {
  if (!stats) {
    return (
      <div className="stat-card">
        <div className="stat-header">
          <span className="stat-icon">{icon}</span>
          <h3>{title}</h3>
        </div>
        <div className="stat-value">
          <span className="loading">Waiting for data...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="stat-card">
      <div className="stat-header">
        <span className="stat-icon">{icon}</span>
        <h3>{title}</h3>
      </div>
      <div className="stat-value">
        <div className="current-value">
          {stats.last.toFixed(1)}<span className="unit">{unit}</span>
        </div>
      </div>
      <div className="stat-details">
        <div className="stat-item">
          <span className="stat-label">Average:</span>
          <span className="stat-number">{stats.avg.toFixed(1)}{unit}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Min:</span>
          <span className="stat-number">{stats.min.toFixed(1)}{unit}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Max:</span>
          <span className="stat-number">{stats.max.toFixed(1)}{unit}</span>
        </div>
      </div>
    </div>
  );
}

export function SleepMonitor({ temp, light, sound }: SleepMonitorProps) {
  return (
    <div className="card sleep-monitor">
      <h2>Sleep Environment Monitor</h2>
      <p className="subtitle">Monitoring environmental conditions during sleep mode</p>

      <div className="stats-grid">
        <StatCard
          title="Temperature"
          icon="🌡️"
          stats={temp}
          unit="°C"
        />
        <StatCard
          title="Light Level"
          icon="💡"
          stats={light}
          unit=""
        />
        <StatCard
          title="Sound Level"
          icon="🔊"
          stats={sound}
          unit=""
        />
      </div>
    </div>
  );
}
