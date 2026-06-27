"use client";

import { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import { getContracts, roles } from "@/lib/ethers";
import ContractData from "@/contracts/MEWContracts.json";

type Role = "worker" | "sponsor";
type Tab = "dashboard" | "plant" | "fund" | "satellite";

interface LogEntry {
  time: string;
  msg: string;
}

interface Parcel {
  id: number;
  state: number; // 0=Planted, 1=Growing, 2=Verified
  escrowAmount: string;
  targetNDVI: number;
  currentNDVI: number;
  isReleased: boolean;
  owner: string;
}

const truncateAddress = (addr: string) =>
  `${addr.slice(0, 6)}...${addr.slice(-4)}`;

export default function Home() {
  const [activeRole, setActiveRole] = useState<Role>("worker");
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  
  const [parcels, setParcels] = useState<Parcel[]>([]);
  
  // Dashboard Aggregates
  const [totalDonated, setTotalDonated] = useState("0");
  const [totalPlanted, setTotalPlanted] = useState(0);
  const [avgNDVI, setAvgNDVI] = useState(0);

  // Simulation State
  const [simActiveForId, setSimActiveForId] = useState<number | null>(null);
  const [simMonthsPassed, setSimMonthsPassed] = useState(0);

  const addLog = (msg: string) => {
    const time = new Date().toLocaleTimeString();
    setLogs((prev) => [{ time, msg }, ...prev]);
  };

  const loadParcels = useCallback(async () => {
    try {
      const { forestNFT, escrow, mockOracle } = await getContracts(roles.worker);
      
      let id = 0;
      const loadedParcels: Parcel[] = [];
      let totalEscrowAmount = 0;
      let totalNdvi = 0;

      while (true) {
        try {
          const owner = await forestNFT.ownerOf(id);
          const state = await forestNFT.forestStates(id);
          const escrowData = await escrow.escrows(id);
          const currentNDVI = await mockOracle.getNDVIScore(id);

          const amt = parseFloat(ethers.formatUnits(escrowData.amount, 18));
          totalEscrowAmount += amt;
          totalNdvi += Number(currentNDVI);

          loadedParcels.push({
            id,
            state: Number(state),
            escrowAmount: amt.toLocaleString(),
            targetNDVI: Number(escrowData.targetNDVIScore),
            currentNDVI: Number(currentNDVI),
            isReleased: escrowData.isReleased,
            owner
          });
          id++;
        } catch (e) {
          // Reverts when token doesn't exist
          break;
        }
      }

      setParcels(loadedParcels);
      setTotalPlanted(loadedParcels.length);
      setTotalDonated(totalEscrowAmount.toLocaleString());
      setAvgNDVI(loadedParcels.length > 0 ? Math.round(totalNdvi / loadedParcels.length) : 0);

    } catch (err) {
      console.error("Error loading parcels", err);
    }
  }, []);

  useEffect(() => {
    loadParcels();
    const int = setInterval(loadParcels, 5000);
    return () => clearInterval(int);
  }, [loadParcels]);

  // Simulation Timer Logic
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (simActiveForId !== null) {
      timer = setInterval(async () => {
        setSimMonthsPassed(m => m + 6);
        
        try {
          const parcel = parcels.find(p => p.id === simActiveForId);
          if (!parcel) return;

          const { mockOracle, escrow } = await getContracts(roles.worker);
          
          // Increase NDVI
          const increment = Math.floor(Math.random() * 50) + 50; // +50 to +100 per 6mo
          const newScore = Math.min(parcel.currentNDVI + increment, 1000);
          
          const tx = await mockOracle.updateNDVIScore(simActiveForId, newScore);
          await tx.wait();
          addLog(`📡 Parcel #${simActiveForId}: Time Passed 6mo. NDVI updated to ${newScore}`);

          // Check Release
          if (newScore >= parcel.targetNDVI && !parcel.isReleased) {
            addLog(`✅ Parcel #${simActiveForId}: Target reached! Attempting release...`);
            const releaseTx = await escrow.checkAndRelease(simActiveForId);
            await releaseTx.wait();
            addLog(`💸 Parcel #${simActiveForId}: Funds Released to Worker!`);
            setSimActiveForId(null); // Stop simulation
          }

          loadParcels();
        } catch(e: any) {
          addLog(`❌ Sim Error: ${e.message}`);
        }
      }, 5000);
    }
    return () => clearInterval(timer);
  }, [simActiveForId, parcels, loadParcels]);

  // === ACTIONS ===
  const handlePlant = async () => {
    setLoading(true);
    try {
      addLog("🌱 Minting new Forest Parcel...");
      const { forestNFT } = await getContracts(roles.worker);
      const tx = await forestNFT.mintForest(roles.worker, "ipfs://new-parcel");
      await tx.wait();
      addLog(`✅ New parcel planted!`);
      await loadParcels();
    } catch (e: any) {
      addLog(`❌ Mint failed: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleFund = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const id = Number(fd.get("parcelId"));
    const amt = fd.get("amount") as string;
    const target = Number(fd.get("targetNDVI"));

    setLoading(true);
    try {
      addLog(`💰 Sponsoring Parcel #${id} with ${amt} USDC...`);
      const { mockUSDC, escrow } = await getContracts(roles.sponsor);
      
      const parsedAmt = ethers.parseUnits(amt, 18);
      
      const appTx = await mockUSDC.approve(ContractData.MEWEscrow.address, parsedAmt);
      await appTx.wait();

      const tx = await escrow.depositFunds(id, roles.worker, parsedAmt, target);
      await tx.wait();

      addLog(`✅ Funded Parcel #${id} successfully!`);
      await loadParcels();
      e.currentTarget.reset();
    } catch (e: any) {
      addLog(`❌ Fund failed: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const renderStateBadge = (state: number, isReleased: boolean) => {
    if (isReleased || state === 2) return <span className="parcel-state state-verified">Verified</span>;
    if (state === 1) return <span className="parcel-state state-growing">Growing</span>;
    return <span className="parcel-state state-planted">Planted</span>;
  };

  return (
    <div className="app-container">
      {/* NAVIGATION SIDEBAR */}
      <aside className="main-sidebar">
        <div className="brand">
          <div className="brand-icon">🌿</div>
          <div className="brand-title">EcoView</div>
        </div>
        
        <nav className="nav-menu">
          <button className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>
            📊 Dashboard
          </button>
          <button className={`nav-item ${activeTab === 'plant' ? 'active' : ''}`} onClick={() => setActiveTab('plant')}>
            🌱 Plant Area
          </button>
          <button className={`nav-item ${activeTab === 'fund' ? 'active' : ''}`} onClick={() => setActiveTab('fund')}>
            💰 Fund Project
          </button>
          <button className={`nav-item ${activeTab === 'satellite' ? 'active' : ''}`} onClick={() => setActiveTab('satellite')}>
            📡 Satellite Readings
          </button>
        </nav>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="main-content">
        <div className="page-header">
          <h1 className="page-title">
            {activeTab === 'dashboard' && "Overview"}
            {activeTab === 'plant' && "Plant & Register Parcel"}
            {activeTab === 'fund' && "Sponsor a Parcel"}
            {activeTab === 'satellite' && "Satellite Growth Simulation"}
          </h1>

          <div className="role-selector">
            <button 
              className={`role-pill ${activeRole === 'worker' ? 'active' : ''}`}
              onClick={() => setActiveRole('worker')}
            >
              👷 Worker Account
            </button>
            <button 
              className={`role-pill ${activeRole === 'sponsor' ? 'active' : ''}`}
              onClick={() => setActiveRole('sponsor')}
            >
              💎 Sponsor Account
            </button>
          </div>
        </div>

        {/* TAB 1: DASHBOARD */}
        {activeTab === 'dashboard' && (
          <div className="fade-in-up">
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-title">Total Donated (USDC)</div>
                <div className="stat-value">${totalDonated}</div>
              </div>
              <div className="stat-card">
                <div className="stat-title">Total Parcels Planted</div>
                <div className="stat-value">{totalPlanted}</div>
              </div>
              <div className="stat-card">
                <div className="stat-title">Avg Network NDVI</div>
                <div className="stat-value">{avgNDVI}</div>
              </div>
            </div>

            <h3 style={{marginBottom: '1rem', color: 'var(--leaf-700)'}}>Active Parcels</h3>
            <div className="parcel-grid">
              {parcels.length === 0 ? <p>No parcels planted yet.</p> : parcels.map(p => (
                <div className="parcel-item" key={p.id}>
                  <div className="parcel-header">
                    <span className="parcel-id">Parcel #{p.id}</span>
                    {renderStateBadge(p.state, p.isReleased)}
                  </div>
                  <div className="parcel-details">
                    <div className="detail-row">
                      <span>Escrowed:</span>
                      <span className="detail-val">${p.escrowAmount}</span>
                    </div>
                    <div className="detail-row">
                      <span>NDVI Target:</span>
                      <span className="detail-val">{p.targetNDVI === 0 ? "Not Funded" : p.targetNDVI}</span>
                    </div>
                    <div className="detail-row">
                      <span>Current NDVI:</span>
                      <span className="detail-val">{p.currentNDVI}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 2: PLANT */}
        {activeTab === 'plant' && (
          <div className="fade-in-up">
            <div className="card" style={{maxWidth: '500px'}}>
              <h2 style={{marginBottom: '1rem'}}>Register New Area</h2>
              <p style={{color: 'var(--muted)', marginBottom: '1.5rem'}}>
                As a Worker, you can mint a new Forest NFT which registers a physical plot of land on the blockchain. Once minted, Sponsors can fund it.
              </p>
              <button 
                className="btn btn-primary" 
                onClick={handlePlant} 
                disabled={activeRole !== 'worker' || loading}
              >
                {activeRole !== 'worker' ? 'Switch to Worker Account' : '🌱 Mint New Parcel'}
              </button>
            </div>
          </div>
        )}

        {/* TAB 3: FUND */}
        {activeTab === 'fund' && (
          <div className="fade-in-up">
            <div className="card" style={{maxWidth: '500px'}}>
              <h2 style={{marginBottom: '1rem'}}>Sponsor a Project</h2>
              <p style={{color: 'var(--muted)', marginBottom: '1.5rem'}}>
                Deposit USDC into the Escrow contract for a specific Parcel. Funds automatically unlock when Satellite NDVI readings hit the Target.
              </p>
              <form onSubmit={handleFund}>
                <label style={{display:'block', marginBottom:'0.5rem', fontWeight:600}}>Select Parcel ID</label>
                <select name="parcelId" className="input-field" required>
                  {parcels.filter(p => p.targetNDVI === 0).map(p => (
                    <option key={p.id} value={p.id}>Parcel #{p.id} (Unfunded)</option>
                  ))}
                  {parcels.filter(p => p.targetNDVI === 0).length === 0 && (
                    <option value="">No unfunded parcels available</option>
                  )}
                </select>

                <label style={{display:'block', marginBottom:'0.5rem', fontWeight:600}}>Deposit Amount (USDC)</label>
                <input type="number" name="amount" className="input-field" defaultValue="1000" required />

                <label style={{display:'block', marginBottom:'0.5rem', fontWeight:600}}>Target NDVI Release Score (e.g. 600)</label>
                <input type="number" name="targetNDVI" className="input-field" defaultValue="600" required />

                <button 
                  type="submit" 
                  className="btn btn-secondary" 
                  disabled={activeRole !== 'sponsor' || loading || parcels.filter(p => p.targetNDVI === 0).length === 0}
                >
                  {activeRole !== 'sponsor' ? 'Switch to Sponsor Account' : '💰 Deposit Funds'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* TAB 4: SATELLITE SIMULATION */}
        {activeTab === 'satellite' && (
          <div className="fade-in-up">
            <div className="card" style={{maxWidth: '600px'}}>
              <h2 style={{marginBottom: '1rem'}}>Simulate Nature</h2>
              <p style={{color: 'var(--muted)', marginBottom: '1.5rem'}}>
                Watch trees grow! Select a funded parcel and start the time simulator. Every 5 seconds equals 6 months of growth, increasing the NDVI score until Escrow is automatically released.
              </p>

              {simActiveForId !== null ? (
                <div style={{textAlign: 'center', padding: '2rem 0'}}>
                  <h3>Running Simulation for Parcel #{simActiveForId}</h3>
                  <div className="sim-timer">{simMonthsPassed / 12} Years Passed</div>
                  <p>Check the Activity Log for real-time NDVI Oracle updates!</p>
                  <button className="btn btn-secondary" style={{marginTop: '1rem'}} onClick={() => { setSimActiveForId(null); setSimMonthsPassed(0); }}>
                    Stop Simulation
                  </button>
                </div>
              ) : (
                <div className="parcel-grid" style={{gridTemplateColumns: '1fr'}}>
                  {parcels.filter(p => p.targetNDVI > 0 && !p.isReleased).map(p => (
                    <div className="parcel-item" key={p.id} style={{flexDirection: 'row', alignItems: 'center'}}>
                      <div style={{flex: 1}}>
                        <h4 style={{fontSize: '1.1rem'}}>Parcel #{p.id}</h4>
                        <div style={{fontSize: '0.8rem', color: 'var(--muted)'}}>Target NDVI: {p.targetNDVI} | Current: {p.currentNDVI}</div>
                        <div className="progress-container">
                          <div className="progress-bar" style={{width: `${Math.min((p.currentNDVI / p.targetNDVI)*100, 100)}%`}}></div>
                        </div>
                      </div>
                      <button className="btn btn-primary" style={{width: 'auto'}} onClick={() => { setSimActiveForId(p.id); setSimMonthsPassed(0); }}>
                        Start Time
                      </button>
                    </div>
                  ))}
                  {parcels.filter(p => p.targetNDVI > 0 && !p.isReleased).length === 0 && (
                    <p>No active funded parcels to simulate.</p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* ACTIVITY LOG SIDEBAR */}
      <aside className="activity-sidebar">
        <h3 className="activity-title">On-Chain Activity</h3>
        <div className="activity-list">
          {logs.length === 0 ? (
            <p style={{fontSize: '0.85rem', color: 'var(--muted)'}}>No recent activity. Mint a parcel or fund a project to see blockchain logs.</p>
          ) : (
            logs.map((log, i) => (
              <div className="log-item fade-in-up" key={i}>
                <div className="log-time">{log.time}</div>
                <div className="log-msg">{log.msg}</div>
              </div>
            ))
          )}
        </div>
      </aside>

    </div>
  );
}
