"use client";

import { motion } from "framer-motion";
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
      {/* Eyebrow */}
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}>
        <span style={{ width: 28, height: 28, borderRadius: 8, background: "var(--em-soft)", color: "var(--em)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon name="coin" size={14} strokeWidth={2} />
        </span>
        <p style={{ fontSize: 10.5, fontFamily: "var(--mono)", color: "var(--em)", letterSpacing: ".12em", textTransform: "uppercase" }}>
          Cardano Blockchain
        </p>
      </div>

      <h3 style={{ fontFamily: "var(--disp)", fontSize: 20, fontWeight: 700, marginBottom: 6, letterSpacing: "-.025em" }}>
        Rewards verteilen
      </h3>
      <p style={{ fontSize: 12.5, color: "var(--t2)", lineHeight: 1.65, marginBottom: 18 }}>
        Die Rewards werden automatisch via Backend on-chain gesendet. Dieser Vorgang kann nicht rückgängig gemacht werden.
      </p>

      {ev && (
        <div style={{ marginBottom: 18 }}>
          <RewardSplit totalFee={ev.totalFee} caption={ev.talent.email.split("@")[0]} />
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <motion.button
          className="btn btn-em"
          onClick={() => eventId && onConfirm(eventId)}
          disabled={loading}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          style={{ padding: "12px", fontSize: 13 }}
        >
          {loading ? <span className="spinner" /> : <Icon name="check" size={14} strokeWidth={2.5} />}
          {loading ? "Sende Transaktion…" : "Rewards jetzt verteilen"}
        </motion.button>
        <motion.button
          className="btn btn-gho"
          onClick={onClose}
          disabled={loading}
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          style={{ padding: "10px" }}
        >
          Abbrechen
        </motion.button>
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
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}>
        <span style={{ width: 28, height: 28, borderRadius: 8, background: "var(--rd-soft)", color: "var(--rd)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon name="x" size={14} strokeWidth={2.5} />
        </span>
        <p style={{ fontSize: 10.5, fontFamily: "var(--mono)", color: "var(--rd)", letterSpacing: ".12em", textTransform: "uppercase" }}>
          Achtung
        </p>
      </div>

      <h3 style={{ fontFamily: "var(--disp)", fontSize: 20, fontWeight: 700, marginBottom: 6, letterSpacing: "-.025em" }}>
        Event stornieren
      </h3>
      <p style={{ fontSize: 12.5, color: "var(--t2)", lineHeight: 1.65, marginBottom: 18 }}>
        Das Match-Event wird auf CANCELLED gesetzt. Es können keine Rewards mehr verteilt werden.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <motion.button
          className="btn"
          style={{ background: "linear-gradient(135deg, var(--rd), #c53030)", color: "#fff", padding: "12px", fontSize: 13, boxShadow: "0 3px 12px rgba(239,68,68,0.3)" }}
          onClick={() => eventId && onConfirm(eventId)}
          disabled={loading}
          whileHover={{ scale: 1.02, boxShadow: "0 6px 20px rgba(239,68,68,0.45)" }}
          whileTap={{ scale: 0.98 }}
        >
          {loading ? <span className="spinner" /> : <Icon name="x" size={14} strokeWidth={2.5} />}
          {loading ? "Storniere…" : "Event stornieren"}
        </motion.button>
        <motion.button
          className="btn btn-gho"
          onClick={onClose}
          disabled={loading}
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          style={{ padding: "10px" }}
        >
          Abbrechen
        </motion.button>
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
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}>
        <span style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(168,85,247,.14)", color: "var(--pur)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon name="users" size={14} />
        </span>
        <p style={{ fontSize: 10.5, fontFamily: "var(--mono)", color: "var(--vio)", letterSpacing: ".12em", textTransform: "uppercase" }}>
          Referral-Beziehung
        </p>
      </div>

      <h3 style={{ fontFamily: "var(--disp)", fontSize: 20, fontWeight: 700, marginBottom: 6, letterSpacing: "-.025em" }}>
        Einlader setzen
      </h3>
      <p style={{ fontSize: 12.5, color: "var(--t2)", lineHeight: 1.65, marginBottom: 18 }}>
        Wähle die Person die <b style={{ color: "var(--t1)" }}>{user?.email}</b> eingeladen hat. Leer lassen = L1 Root.
      </p>

      <div style={{ marginBottom: 18 }}>
        <label className="field-label">Einlader</label>
        <select
          className="field field-select"
          value={inviterAddress}
          onChange={(e) => setInviterAddress(e.target.value)}
        >
          <option value="">Kein Einlader (L1 Root)</option>
          {users.filter((u) => u.id !== user?.id).map((u) => (
            <option key={u.id} value={u.walletAddress}>
              {u.email} — {u.role}
            </option>
          ))}
        </select>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <motion.button
          className="btn btn-pri"
          onClick={onConfirm}
          disabled={loading}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          style={{ padding: "12px", fontSize: 13 }}
        >
          {loading ? <span className="spinner" /> : <Icon name="check" size={14} />}
          {loading ? "Speichere…" : "Beziehung erstellen"}
        </motion.button>
        <motion.button
          className="btn btn-gho"
          onClick={onClose}
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          style={{ padding: "10px" }}
        >
          Abbrechen
        </motion.button>
      </div>
    </Modal>
  );
}