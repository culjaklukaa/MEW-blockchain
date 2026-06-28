export type Role = "worker" | "sponsor";
export type Tab = "dashboard" | "plant" | "fund" | "satellite";

export interface LogEntry {
  time: string;
  msg: string;
}

export interface Parcel {
  id: number;
  state: number; // 0=Planted, 1=Growing, 2=Verified
  escrowAmount: string;
  targetNDVI: number;
  currentNDVI: number;
  isReleased: boolean;
  owner: string;
}
