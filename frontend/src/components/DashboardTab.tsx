import React from 'react';
import { Parcel } from '@/lib/types';

interface DashboardTabProps {
  parcels: Parcel[];
}

export default function DashboardTab({ parcels }: DashboardTabProps) {
  const renderStateBadge = (state: number, isReleased: boolean) => {
    if (isReleased || state === 2) return <span className="parcel-badge badge-verified">Verified</span>;
    if (state === 1) return <span className="parcel-badge badge-growing">Growing</span>;
    return <span className="parcel-badge badge-planted">Planted</span>;
  };

  return (
    <div className="animate-in">
      <div className="page-title-box">
        <h2 className="page-title">Parcels Overview</h2>
      </div>

      <div className="parcels-grid">
        {parcels.length === 0 ? (
          <div className="card" style={{gridColumn: '1 / -1', display: 'flex', justifyContent: 'center', minHeight: '150px', alignItems: 'center'}}>
            <p style={{color: 'var(--muted)'}}>No parcels planted yet.</p>
          </div>
        ) : parcels.map(p => (
          <div className="card parcel-card" key={p.id}>
            <div className="parcel-header">
              <span className="parcel-id">Parcel #{p.id}</span>
              {renderStateBadge(p.state, p.isReleased)}
            </div>
            <div className="parcel-details">
              <div className="detail-row">
                <span className="detail-label">Escrowed:</span>
                <span className="detail-val">${p.escrowAmount}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Target NDVI:</span>
                <span className="detail-val">{p.targetNDVI === 0 ? "Not Funded" : p.targetNDVI}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Current NDVI:</span>
                <span className="detail-val">{p.currentNDVI}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
