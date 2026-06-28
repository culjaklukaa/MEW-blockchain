import React from 'react';
import { Parcel, Role } from '@/lib/types';

interface FundTabProps {
  parcels: Parcel[];
  activeRole: Role;
  loading: boolean;
  onFund: (e: React.FormEvent<HTMLFormElement>) => void;
}

export default function FundTab({ parcels, activeRole, loading, onFund }: FundTabProps) {
  const unfundedParcels = parcels.filter(p => p.targetNDVI === 0);

  return (
    <div className="animate-in">
      <div className="page-title-box">
        <h2 className="page-title">Sponsor Project</h2>
      </div>
      <div className="card" style={{maxWidth: '600px'}}>
        <p style={{color: 'var(--muted)', marginBottom: '2rem', lineHeight: 1.6}}>
          Deposit USDC into the Escrow contract for a specific Parcel. Funds automatically unlock when Satellite NDVI readings hit the Target.
        </p>
        <form onSubmit={onFund}>
          <label className="input-label">Select Parcel ID</label>
          <select name="parcelId" className="input-field" required>
            {unfundedParcels.map(p => (
              <option key={p.id} value={p.id}>Parcel #{p.id} (Unfunded)</option>
            ))}
            {unfundedParcels.length === 0 && (
              <option value="">No unfunded parcels available</option>
            )}
          </select>

          <label className="input-label">Deposit Amount (USDC)</label>
          <input type="number" name="amount" className="input-field" defaultValue="1000" required />

          <label className="input-label">Target NDVI Release Score (e.g. 600)</label>
          <input type="number" name="targetNDVI" className="input-field" defaultValue="600" required />

          <button 
            type="submit" 
            className="btn btn-secondary" 
            disabled={activeRole !== 'sponsor' || loading || unfundedParcels.length === 0}
          >
            {activeRole !== 'sponsor' ? 'Switch to Sponsor Account' : '💰 Deposit Funds'}
          </button>
        </form>
      </div>
    </div>
  );
}
