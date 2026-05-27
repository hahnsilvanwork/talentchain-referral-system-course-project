"use client";

// CardanoLink — öffnet preprod.cardanoscan.io für TX, Adresse oder Script.
// Verwendung:
//   <CardanoLink type="tx"      value={txHash} />
//   <CardanoLink type="address" value={walletAddress} label="Wallet ansehen" />
//   <CardanoLink type="script"  value={scriptAddress} label="Script" />

import { motion } from "framer-motion";
import Icon from "./Icon";

type CardanoLinkType = "tx" | "address" | "script";

interface CardanoLinkProps {
  type: CardanoLinkType;
  value: string;
  label?: string;
  /** Stil: "button" = row-act-Button, "inline" = reiner Textlink */
  variant?: "button" | "inline";
  truncate?: boolean;
}

const BASE = "https://preprod.cardanoscan.io";

const PATHS: Record<CardanoLinkType, string> = {
  tx:      "/transaction",
  address: "/address",
  script:  "/address",   // Script-Adresse ist auch eine Adresse auf Cardanoscan
};

const COLORS: Record<CardanoLinkType, { bg: string; fg: string; border: string }> = {
  tx:      { bg: "rgba(99,102,241,.1)",  fg: "var(--ind)", border: "rgba(99,102,241,.2)" },
  address: { bg: "rgba(6,182,212,.1)",   fg: "var(--cy)",  border: "rgba(6,182,212,.2)"  },
  script:  { bg: "rgba(168,85,247,.1)",  fg: "var(--pur)", border: "rgba(168,85,247,.2)" },
};

const LABELS: Record<CardanoLinkType, string> = {
  tx:      "TX",
  address: "Wallet",
  script:  "Script",
};

export function openCardano(type: CardanoLinkType, value: string) {
  window.open(`${BASE}${PATHS[type]}/${value}`, "_blank", "noopener,noreferrer");
}

export default function CardanoLink({
  type,
  value,
  label,
  variant = "button",
  truncate = true,
}: CardanoLinkProps) {
  if (!value) return null;

  const displayLabel = label ?? LABELS[type];
  const c = COLORS[type];

  const truncated = truncate
    ? `${value.slice(0, 8)}…${value.slice(-6)}`
    : value;

  if (variant === "inline") {
    return (
      <motion.span
        onClick={() => openCardano(type, value)}
        title={value}
        whileHover={{ x: 2 }}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
        style={{
          cursor: "pointer",
          color: c.fg,
          fontFamily: "var(--mono)",
          fontSize: 10.5,
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          textDecoration: "underline",
          textUnderlineOffset: 2,
          textDecorationColor: `${c.fg}55`,
        }}
      >
        {truncated}
        <motion.span
          animate={{ x: [0, 2, 0] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
        >
          <Icon name="arrowRight" size={10} />
        </motion.span>
      </motion.span>
    );
  }

  return (
    <motion.button
      className="row-act"
      style={{ background: c.bg, color: c.fg, borderColor: c.border }}
      onClick={() => openCardano(type, value)}
      title={value}
      whileHover={{ scale: 1.04, y: -1 }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: "spring", stiffness: 400, damping: 20 }}
    >
      <Icon name="arrowRight" size={11} />
      {displayLabel}
    </motion.button>
  );
}

// ── Kompakter TX-Badge mit Hash-Anzeige ────────────────────────────────────
// Zeigt Hash + Link in einer Zeile — ideal für Tabellenzellen.
interface TxBadgeProps {
  txHash: string;
  label?: string;
}

export function TxBadge({ txHash, label }: TxBadgeProps) {
  return (
    <motion.div
      whileHover={{ scale: 1.02, borderColor: "rgba(99,102,241,.35)" }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        background: "rgba(99,102,241,.07)",
        border: "1px solid rgba(99,102,241,.18)",
        borderRadius: "var(--r-sm)",
        padding: "4px 10px",
        cursor: "pointer",
      }}
      onClick={() => openCardano("tx", txHash)}
      title={`TX: ${txHash}`}
    >
      <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--t2)" }}>
        {txHash.slice(0, 10)}…{txHash.slice(-6)}
      </span>
      {label && (
        <span style={{ fontSize: 9, fontFamily: "var(--mono)", color: "var(--ind)", fontWeight: 700 }}>
          {label}
        </span>
      )}
      <Icon name="arrowRight" size={10} style={{ color: "var(--ind)" }} />
    </motion.div>
  );
}

// ── Script-Adresse Info-Karte ──────────────────────────────────────────────
interface ScriptCardProps {
  address: string | null;
  loading?: boolean;
}

export function ScriptAddressCard({ address, loading }: ScriptCardProps) {
  return (
    <motion.div
      className="card"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      style={{
        padding: "14px 16px",
        display: "flex",
        alignItems: "center",
        gap: 12,
        marginBottom: 14,
      }}
    >
      <motion.div
        whileHover={{ scale: 1.1, rotate: 5 }}
        transition={{ type: "spring", stiffness: 400, damping: 15 }}
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          background: "rgba(168,85,247,.14)",
          color: "var(--pur)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Icon name="shield" size={17} />
      </motion.div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 9.5,
            fontFamily: "var(--mono)",
            color: "var(--t4)",
            textTransform: "uppercase",
            letterSpacing: ".1em",
            marginBottom: 4,
          }}
        >
          Referral Registry · Smart Contract
        </div>
        {loading ? (
          <div className="skeleton" style={{ height: 14, width: "60%", borderRadius: 4 }} />
        ) : address ? (
          <span
            style={{
              fontSize: 10.5,
              fontFamily: "var(--mono)",
              color: "var(--t2)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              display: "block",
            }}
          >
            {address}
          </span>
        ) : (
          <span style={{ fontSize: 11, color: "var(--t3)" }}>Nicht verfügbar</span>
        )}
      </div>

      {address && (
        <div style={{ display: "flex", gap: 7, flexShrink: 0 }}>
          <motion.button
            className="btn btn-gho btn-sm"
            onClick={() => navigator.clipboard.writeText(address)}
            title="Adresse kopieren"
            whileHover={{ scale: 1.04, y: -1 }}
            whileTap={{ scale: 0.97 }}
            transition={{ type: "spring", stiffness: 400, damping: 20 }}
          >
            <Icon name="check" size={12} /> Kopieren
          </motion.button>
          <CardanoLink type="script" value={address} label="Cardanoscan" />
        </div>
      )}
    </motion.div>
  );
}
