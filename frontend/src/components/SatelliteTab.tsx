import React from 'react';
import { Parcel } from '@/lib/types';

interface SatelliteTabProps {
  parcels: Parcel[];
  simActiveForId: number | null;
  simMonthsPassed: number;
  onStartSim: (id: number) => void;
  onStopSim: () => void;
}

export default function SatelliteTab({ 
  parcels, 
  simActiveForId, 
  simMonthsPassed, 
  onStartSim, 
  onStopSim 
}: SatelliteTabProps) {
  const fundedParcels = parcels.filter(p => p.targetNDVI > 0 && !p.isReleased);

  return (
    <div className="animate-in">
      <div className="page-title-box">
        <h2 className="page-title">Simulate Growth</h2>
      </div>
      <div className="card" style={{maxWidth: '700px'}}>
        <p style={{color: 'var(--muted)', marginBottom: '2rem', lineHeight: 1.6}}>
          Watch trees grow! Select a funded parcel and start the time simulator. Every 5 seconds equals 6 months of growth, increasing the NDVI score until Escrow is automatically released.
        </p>

        {simActiveForId !== null ? (
          <div style={{textAlign: 'center', padding: '2rem 0'}}>
            <h3 style={{color: 'var(--foreground)'}}>Running Simulation for Parcel #{simActiveForId}</h3>
            <div className="sim-timer">{simMonthsPassed / 12} Years Passed</div>
            <p style={{color: 'var(--muted)', marginBottom: '2rem'}}>Check the Activity Log for real-time NDVI Oracle updates!</p>
            <button className="btn btn-secondary" onClick={onStopSim}>
              Stop Simulation
            </button>
          </div>
        ) : (
          <div className="parcels-grid" style={{gridTemplateColumns: '1fr'}}>
            {fundedParcels.map(p => (
              <div className="card" key={p.id} style={{display: 'flex', flexDirection: 'column', gap: '1.5rem', boxShadow: 'none', border: '1px solid var(--border-medium)'}}>
                <div>
                  <h4 style={{fontSize: '1.25rem', color: 'var(--foreground)', marginBottom: '0.5rem'}}>Parcel #{p.id}</h4>
                  <div style={{fontSize: '0.85rem', color: 'var(--muted)'}}>
                    Target NDVI: {p.targetNDVI} | Current: <span style={{color: 'var(--foreground)', fontWeight: 600}}>{p.currentNDVI}</span>
                  </div>
                  <div className="progress-container">
                    <div className="progress-bar" style={{width: `${Math.min((p.currentNDVI / p.targetNDVI)*100, 100)}%`}}></div>
                  </div>
                </div>
                <button className="btn btn-primary" onClick={() => onStartSim(p.id)}>
                  Start Time
                </button>
              </div>
            ))}
            {fundedParcels.length === 0 && (
              <p style={{color: 'var(--muted)'}}>No active funded parcels to simulate.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
