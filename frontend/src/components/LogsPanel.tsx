import React from 'react';
import { LogEntry } from '@/lib/types';

interface LogsPanelProps {
  logs: LogEntry[];
}

export default function LogsPanel({ logs }: LogsPanelProps) {
  return (
    <aside className="activity-area">
      <h3 className="activity-header">On-Chain Activity</h3>
      <div className="activity-list">
        {logs.length === 0 ? (
          <p style={{fontSize: '0.85rem', color: 'var(--muted)', textAlign: 'center', marginTop: '2rem'}}>
            No recent activity. Mint a parcel or fund a project to see blockchain logs.
          </p>
        ) : (
          logs.map((log, i) => (
            <div className="log-item" key={i}>
              <div className="log-time">{log.time}</div>
              <div className="log-msg">{log.msg}</div>
            </div>
          ))
        )}
      </div>
    </aside>
  );
}
