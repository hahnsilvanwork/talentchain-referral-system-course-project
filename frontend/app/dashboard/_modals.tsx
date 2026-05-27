"use client";

import Modal from "@/components/ui/Modal";
import Icon from "@/components/ui/Icon";
import RewardSplit from "@/components/dashboard/RewardSplit";

interface MatchEvent {
  id: string; totalFee: number;
  talent: { email: string };
}

interface User {
  id: string; email: string; walletAddress: string; role: string;
}

// ── Distribute Modal ────────────────────────────────────────────────
interface DistributeModalProps {
  open: boolean;
  onClose: () => void;
  eventId: string | null;
  events: MatchEvent[];
  loading: boolean;
  onConfirm: (id: string) => void;
}

export function DistributeModal({ open, onClose, eventId, events, loading, onConfirm }: DistributeModalProps) {
  const ev = events.find((e) => e.id === eventId);
  return (
    <Modal open={open} onClose={onClose}>
      <p style={{ fontSize: 10.5, fontFamily: "var(--mono)", color: "var(--em)", letterSpacing: ".12em", textTransform: "uppercase", marginBottom: 8 }}>Cardano Blockchain</p>
      <h3 style={{ fontFamily: "var(--disp)", fontSize: 19, fontWeight: 700, marginBottom: 6 }}>Rewards verteilen</h3>
      <p style={{ fontSize: 12.5, color: "var(--t2)", lineHeight: 1.6, marginBottom: 18 }}>
        Die Rewards werden automatisch via Backend on-chain gesendet. Dieser Vorgang kann nicht rückgängig gemacht werden.
      </p>
      {ev && <div style={{ marginBottom: 18 }}><RewardSplit totalFee={ev.totalFee} caption={ev.talent.email.split("@")[0]} /></div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        <button className="btn btn-em" onClick={() => eventId && onConfirm(eventId)} disabled={loading} style={{ padding: "12px" }}>
          {loading ? <span className="spinner" /> : <Icon name="check" size={14} strokeWidth={2.5} />}
          {loading ? "Sende Transaktion…" : "Rewards jetzt verteilen"}
        </button>
        <button className="btn btn-gho" onClick={onClose} disabled={loading} style={{ padding: "10px" }}>Abbrechen</button>
      </div>
    </Modal>
  );
}

// ── Cancel Modal ────────────────────────────────────────────────────
interface CancelModalProps {
  open: boolean;
  onClose: () => void;
  eventId: string | null;
  loading: boolean;
  onConfirm: (id: string) => void;
}

export function CancelModal({ open, onClose, eventId, loading, onConfirm }: CancelModalProps) {
  return (
    <Modal open={open} onClose={onClose}>
      <p style={{ fontSize: 10.5, fontFamily: "var(--mono)", color: "var(--rd)", letterSpacing: ".12em", textTransform: "uppercase", marginBottom: 8 }}>Achtung</p>
      <h3 style={{ fontFamily: "var(--disp)", fontSize: 19, fontWeight: 700, marginBottom: 6 }}>Event stornieren</h3>
      <p style={{ fontSize: 12.5, color: "var(--t2)", lineHeight: 1.6, marginBottom: 18 }}>
        Das Match-Event wird auf CANCELLED gesetzt. Es können keine Rewards mehr verteilt werden.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        <button className="btn" style={{ background: "var(--rd)", color: "#fff", padding: "12px" }} onClick={() => eventId && onConfirm(eventId)} disabled={loading}>
          {loading ? <span className="spinner" /> : <Icon name="x" size={14} strokeWidth={2.5} />}
          {loading ? "Storniere…" : "Event stornieren"}
        </button>
        <button className="btn btn-gho" onClick={onClose} disabled={loading} style={{ padding: "10px" }}>Abbrechen</button>
      </div>
    </Modal>
  );
}

// ── Set Inviter Modal ───────────────────────────────────────────────
interface SetInviterModalProps {
  open: boolean;
  onClose: () => void;
  user: User | null;
  users: User[];
  inviterAddress: string;
  setInviterAddress: (v: string) => void;
  loading: boolean;
  onConfirm: () => void;
}

export function SetInviterModal({ open, onClose, user, users, inviterAddress, setInviterAddress, loading, onConfirm }: SetInviterModalProps) {
  return (
    <Modal open={open} onClose={onClose}>
      <p style={{ fontSize: 10.5, fontFamily: "var(--mono)", color: "var(--vio)", letterSpacing: ".12em", textTransform: "uppercase", marginBottom: 8 }}>Referral-Beziehung</p>
      <h3 style={{ fontFamily: "var(--disp)", fontSize: 19, fontWeight: 700, marginBottom: 6 }}>Einlader setzen</h3>
      <p style={{ fontSize: 12.5, color: "var(--t2)", lineHeight: 1.6, marginBottom: 18 }}>
        Wähle die Person die <b>{user?.email}</b> eingeladen hat. Leer = L1 Root.
      </p>
      <div style={{ marginBottom: 16 }}>
        <label className="field-label">Einlader</label>
        <select className="field field-select" value={inviterAddress} onChange={(e) => setInviterAddress(e.target.value)}>
          <option value="">Kein Einlader (L1 Root)</option>
          {users.filter((u) => u.id !== user?.id).map((u) => (
            <option key={u.id} value={u.walletAddress}>{u.email} — {u.role}</option>
          ))}
        </select>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        <button className="btn btn-pri" onClick={onConfirm} disabled={loading} style={{ padding: "12px" }}>
          {loading ? <span className="spinner" /> : <Icon name="check" size={14} />}
          {loading ? "Speichere…" : "Beziehung erstellen"}
        </button>
        <button className="btn btn-gho" onClick={onClose} style={{ padding: "10px" }}>Abbrechen</button>
      </div>
    </Modal>
  );
}