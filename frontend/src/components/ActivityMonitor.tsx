import type { Activity } from '../types';

interface ActivityMonitorProps {
  activity: Activity;
  meter: number;
  threshold: number;
  alert: boolean;
}

export function ActivityMonitor({ activity, meter, threshold, alert }: ActivityMonitorProps) {
  const percentage = threshold > 0 ? (meter / threshold) * 100 : 0;

  // Determine color based on meter level
  let meterColor = '#22c55e'; // green
  if (percentage < 25) {
    meterColor = '#ef4444'; // red
  } else if (percentage < 50) {
    meterColor = '#f59e0b'; // orange
  }

  const activityEmoji = {
    sitting: '🪑',
    walking: '🚶',
    '...': '⏳',
  };

  return (
    <div className="card activity-monitor">
      <h2>Activity Monitor</h2>

      {alert && (
        <div className="alert-banner">
          ⚠️ Time to move! Inactivity detected.
        </div>
      )}

      <div className="activity-display">
        <div className="activity-icon">
          {activityEmoji[activity]}
        </div>
        <div className="activity-label">
          Current Activity: <strong>{activity}</strong>
        </div>
      </div>

      <div className="meter-container">
        <div className="meter-label">
          Inactivity Meter
        </div>
        <div className="meter-bar-background">
          <div
            className="meter-bar-fill"
            style={{
              width: `${percentage}%`,
              backgroundColor: meterColor,
            }}
          />
        </div>
        <div className="meter-value">
          {meter} / {threshold} ({Math.round(percentage)}%)
        </div>
      </div>

      <div className="info-text">
        {meter === 0 ? (
          <p className="warning-text">⚠️ Activity meter depleted - movement needed!</p>
        ) : activity === 'sitting' ? (
          <p>Sitting detected - meter decreasing slowly</p>
        ) : (
          <p>Active movement detected - meter recovering!</p>
        )}
      </div>
    </div>
  );
}
