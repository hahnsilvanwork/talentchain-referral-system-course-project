"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Icon from "@/components/ui/Icon";
import { api } from "@/lib/api";
import { scenarioLabel, chf } from "@/lib/scenarios";

interface HistoryItem {
  txHash: string;
  blockTime: number;
  matchEvent: {
    id: string;
    totalFee: number;
    scenario: string;
    talent: string;
  } | null;
}

function openTx(txHash: string) {
  window.open(
    `https://preprod.cardanoscan.io/transaction/${txHash}`,
    "_blank",
    "noopener,noreferrer"
  );
}

function timeAgo(blockTime: number): string {
  const diff = Date.now() - blockTime * 1000;
  const h = Math.floor(diff / 3_600_000);
  const d = Math.floor(h / 24);
  if (d > 0) return `vor ${d} Tag${d > 1 ? "en" : ""}`;
  if (h > 0) return `vor ${h} Std`;
  return "gerade eben";
}

function SkeletonRow() {
  return (
    <tr>
      {[...Array(6)].map((_, i) => (
        <td key={i} style={{ padding: "14px 16px" }}>
          <div className="skeleton skeleton-text" style={{ width: i === 0 ? 120 : 70 }} />
        </td>
      ))}
    </tr>
  );
}

export function RewardHistory() {
  const [data, setData] = useState<{
    walletAddress: string;
    history: HistoryItem[];
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getRewardHistory()
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {/* Wallet card skeleton */}
        <div className="card" style={{ padding: 16, display: "flex", alignItems: "center", gap: 12 }}>
          <div className="skeleton" style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div className="skeleton skeleton-text" style={{ width: 80, marginBottom: 8 }} />
            <div className="skeleton skeleton-text" style={{ width: "60%" }} />
          </div>
        </div>
        {/* Table skeleton */}
        <div className="card" style={{ overflow: "hidden" }}>
          <div style={{ padding: "13px 16px", borderBottom: "1px solid var(--line)", background: "var(--bg-input)" }}>
            <div className="skeleton skeleton-text" style={{ width: 140 }} />
          </div>
          <table className="tbl">
            <thead><tr>
              {["TX Hash","Talent","Szenario","Total Fee","Zeit","Link"].map(h => <th key={h}>{h}</th>)}
            </tr></thead>
            <tbody>{[...Array(3)].map((_, i) => <SkeletonRow key={i} />)}</tbody>
          </table>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="card empty">
        <div className="empty-ic"><Icon name="coin" size={22} /></div>
        <div className="empty-title">Nicht verfügbar</div>
        <div className="empty-text">Reward History konnte nicht geladen werden.</div>
      </div>
    );
  }

  const talentchainTxs = data.history.filter((h) => h.matchEvent !== null);
  const allTxs = data.history;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      style={{ display: "flex", flexDirection: "column", gap: 14 }}
    >
      {/* Wallet Info */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="card"
        style={{ padding: 16, display: "flex", alignItems: "center", gap: 12 }}
      >
        <div style={{
          width: 38,
          height: 38,
          borderRadius: 10,
          background: "rgba(99,102,241,.15)",
          color: "var(--ind)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          boxShadow: "0 0 0 1px rgba(99,102,241,0.15)",
        }}>
          <Icon name="wallet" size={17} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 10.5, color: "var(--t3)", fontFamily: "var(--mono)", marginBottom: 3 }}>Deine Wallet</div>
          <div style={{ fontSize: 11, fontFamily: "var(--mono)", color: "var(--t2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {data.walletAddress}
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <motion.div
            key={talentchainTxs.length}
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            style={{ fontSize: 20, fontWeight: 700, fontFamily: "var(--disp)", color: "var(--em)" }}
          >
            {talentchainTxs.length}
          </motion.div>
          <div style={{ fontSize: 10, color: "var(--t3)", fontFamily: "var(--mono)" }}>TalentChain TXs</div>
        </div>
      </motion.div>

      {/* TalentChain Rewards table */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08 }}
        className="card"
        style={{ overflow: "hidden" }}
      >
        <div style={{
          padding: "12px 16px",
          borderBottom: "1px solid var(--line)",
          display: "flex",
          alignItems: "center",
          gap: 8,
          background: "var(--bg-input)",
        }}>
          <span style={{ color: "var(--em)" }}><Icon name="coin" size={15} /></span>
          <span style={{ fontFamily: "var(--disp)", fontSize: 13, fontWeight: 600 }}>TalentChain Rewards</span>
          <span className="sec-count" style={{ marginLeft: 4 }}>{talentchainTxs.length} TOTAL</span>
        </div>

        {talentchainTxs.length === 0 ? (
          <div className="empty">
            <div className="empty-ic"><Icon name="coin" size={22} /></div>
            <div className="empty-title">Noch keine Rewards</div>
            <div className="empty-text">Du hast noch keine Rewards von TalentChain erhalten.</div>
          </div>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>TX Hash</th>
                <th>Talent</th>
                <th>Szenario</th>
                <th>Total Fee</th>
                <th>Zeit</th>
                <th style={{ textAlign: "right" }}>Link</th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence>
                {talentchainTxs.map((item, idx) => (
                  <motion.tr
                    key={item.txHash}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.04 }}
                  >
                    <td style={{ fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--t2)" }}>
                      {item.txHash.slice(0, 12)}…{item.txHash.slice(-6)}
                    </td>
                    <td style={{ fontSize: 11.5, color: "var(--t1)" }}>
                      {item.matchEvent?.talent}
                    </td>
                    <td>
                      <span style={{ fontSize: 9.5, fontFamily: "var(--mono)", color: "var(--t2)", background: "var(--bg-input)", border: "1px solid var(--line)", padding: "3px 8px", borderRadius: 6 }}>
                        {scenarioLabel(item.matchEvent?.scenario || "")}
                      </span>
                    </td>
                    <td style={{ fontFamily: "var(--mono)", fontSize: 11.5, color: "var(--em)", fontWeight: 700 }}>
                      {chf(item.matchEvent?.totalFee || 0)}
                    </td>
                    <td style={{ fontSize: 10.5, color: "var(--t4)", fontFamily: "var(--mono)" }}>
                      {timeAgo(item.blockTime)}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <motion.button
                        className="row-act"
                        style={{ background: "rgba(99,102,241,.1)", color: "var(--ind)", borderColor: "rgba(99,102,241,.2)" }}
                        onClick={() => openTx(item.txHash)}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        <Icon name="arrowRight" size={11} /> Cardanoscan
                      </motion.button>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        )}
      </motion.div>

      {/* All TX History */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.14 }}
        className="card"
        style={{ overflow: "hidden" }}
      >
        <div style={{
          padding: "12px 16px",
          borderBottom: "1px solid var(--line)",
          display: "flex",
          alignItems: "center",
          gap: 8,
          background: "var(--bg-input)",
        }}>
          <span style={{ color: "var(--vio)" }}><Icon name="clock" size={15} /></span>
          <span style={{ fontFamily: "var(--disp)", fontSize: 13, fontWeight: 600 }}>Alle Transaktionen</span>
          <span className="sec-count" style={{ marginLeft: 4 }}>{allTxs.length} TOTAL</span>
        </div>

        {allTxs.length === 0 ? (
          <div className="empty">
            <div className="empty-ic"><Icon name="clock" size={22} /></div>
            <div className="empty-title">Keine Transaktionen</div>
            <div className="empty-text">Noch keine Transaktionen auf dieser Wallet.</div>
          </div>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>TX Hash</th>
                <th>Typ</th>
                <th>Zeit</th>
                <th style={{ textAlign: "right" }}>Link</th>
              </tr>
            </thead>
            <tbody>
              {allTxs.map((item, idx) => (
                <motion.tr
                  key={item.txHash}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.03 }}
                >
                  <td style={{ fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--t2)" }}>
                    {item.txHash.slice(0, 16)}…{item.txHash.slice(-8)}
                  </td>
                  <td>
                    {item.matchEvent ? (
                      <span className="chip chip-em chip-no-dot">TalentChain Reward</span>
                    ) : (
                      <span className="chip chip-gray chip-no-dot">Transaktion</span>
                    )}
                  </td>
                  <td style={{ fontSize: 10.5, color: "var(--t4)", fontFamily: "var(--mono)" }}>
                    {timeAgo(item.blockTime)}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <motion.button
                      className="row-act"
                      style={{ background: "rgba(99,102,241,.1)", color: "var(--ind)", borderColor: "rgba(99,102,241,.2)" }}
                      onClick={() => openTx(item.txHash)}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <Icon name="arrowRight" size={11} /> TX
                    </motion.button>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        )}
      </motion.div>
    </motion.div>
  );
}