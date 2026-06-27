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
    if (isReleased || state === 2) return <span className="parcel-badge badge-verified">Verified</span>;
    if (state === 1) return <span className="parcel-badge badge-growing">Growing</span>;
    return <span className="parcel-badge badge-planted">Planted</span>;
  };

  return (
    <>
      <header className="top-header">
        <div className="brand-area animate-in">
          <div className="brand-icon">🌿</div>
          <h1 className="brand-title">EcoView</h1>
        </div>
        
        <nav className="nav-menu animate-in" style={{animationDelay: '0.1s'}}>
          <button className={`nav-btn ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>
            Dashboard
          </button>
          <button className={`nav-btn ${activeTab === 'plant' ? 'active' : ''}`} onClick={() => setActiveTab('plant')}>
            Plant
          </button>
          <button className={`nav-btn ${activeTab === 'fund' ? 'active' : ''}`} onClick={() => setActiveTab('fund')}>
            Fund
          </button>
          <button className={`nav-btn ${activeTab === 'satellite' ? 'active' : ''}`} onClick={() => setActiveTab('satellite')}>
            Satellite
          </button>
        </nav>
      </header>

      {/* STATS STRIP (Grid of 4 as per wireframe) */}
      <div className="stats-strip animate-in" style={{animationDelay: '0.2s'}}>
        <div className="stat-box">
          <div className="stat-inner">
            <div className="stat-label">Total Donated (USDC)</div>
            <div className="stat-value">${totalDonated}</div>
          </div>
        </div>
        <div className="stat-box">
          <div className="stat-inner">
            <div className="stat-label">Total Parcels</div>
            <div className="stat-value">{totalPlanted}</div>
          </div>
        </div>
        <div className="stat-box">
          <div className="stat-inner">
            <div className="stat-label">Avg Network NDVI</div>
            <div className="stat-value">{avgNDVI}</div>
          </div>
        </div>
        <div className="stat-box">
          <div className="stat-inner" style={{justifyContent: 'center', gap: '0.75rem'}}>
            <div className="stat-label" style={{textAlign: 'center'}}>Active Role</div>
            <div className="role-selector">
              <button 
                className={`role-pill ${activeRole === 'worker' ? 'active' : ''}`}
                onClick={() => setActiveRole('worker')}
              >
                👷 Worker
              </button>
              <button 
                className={`role-pill ${activeRole === 'sponsor' ? 'active' : ''}`}
                onClick={() => setActiveRole('sponsor')}
              >
                💎 Sponsor
              </button>
            </div>
          </div>
        </div>
      </div>

      <main className="main-layout animate-in" style={{animationDelay: '0.3s'}}>
        
        {/* LEFT CONTENT AREA */}
        <div className="content-area">
          
          {/* TAB 1: DASHBOARD */}
          {activeTab === 'dashboard' && (
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
          )}

          {/* TAB 2: PLANT */}
          {activeTab === 'plant' && (
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
            <div className="animate-in">
              <div className="page-title-box">
                <h2 className="page-title">Sponsor Project</h2>
              </div>
              <div className="card" style={{maxWidth: '600px'}}>
                <p style={{color: 'var(--muted)', marginBottom: '2rem', lineHeight: 1.6}}>
                  Deposit USDC into the Escrow contract for a specific Parcel. Funds automatically unlock when Satellite NDVI readings hit the Target.
                </p>
                <form onSubmit={handleFund}>
                  <label className="input-label">Select Parcel ID</label>
                  <select name="parcelId" className="input-field" required>
                    {parcels.filter(p => p.targetNDVI === 0).map(p => (
                      <option key={p.id} value={p.id}>Parcel #{p.id} (Unfunded)</option>
                    ))}
                    {parcels.filter(p => p.targetNDVI === 0).length === 0 && (
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
                    <button className="btn btn-secondary" onClick={() => { setSimActiveForId(null); setSimMonthsPassed(0); }}>
                      Stop Simulation
                    </button>
                  </div>
                ) : (
                  <div className="parcels-grid" style={{gridTemplateColumns: '1fr'}}>
                    {parcels.filter(p => p.targetNDVI > 0 && !p.isReleased).map(p => (
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
                        <button className="btn btn-primary" onClick={() => { setSimActiveForId(p.id); setSimMonthsPassed(0); }}>
                          Start Time
                        </button>
                      </div>
                    ))}
                    {parcels.filter(p => p.targetNDVI > 0 && !p.isReleased).length === 0 && (
                      <p style={{color: 'var(--muted)'}}>No active funded parcels to simulate.</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

        </div>

        {/* RIGHT AREA: ACTIVITY LOG */}
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

      </main>
    </>
  );
}
