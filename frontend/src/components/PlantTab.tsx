import React from 'react';
import { Role } from '@/lib/types';

interface PlantTabProps {
  activeRole: Role;
  loading: boolean;
  onPlant: () => void;
}

export default function PlantTab({ activeRole, loading, onPlant }: PlantTabProps) {
  return (
    <div className="animate-in">
      <div className="page-title-box">
        <h2 className="page-title">Register Area</h2>
      </div>
      <div className="card" style={{maxWidth: '600px'}}>
        <p style={{color: 'var(--muted)', marginBottom: '2rem', lineHeight: 1.6}}>
          As a Worker, you can mint a new Forest NFT which registers a physical plot of land on the blockchain. Once minted, Sponsors can fund it.
        </p>
        <button 
          className="btn btn-primary" 
          onClick={onPlant} 
          disabled={activeRole !== 'worker' || loading}
        >
          {activeRole !== 'worker' ? 'Switch to Worker Account' : '🌱 Mint New Parcel'}
        </button>
      </div>
    </div>
  );
}
