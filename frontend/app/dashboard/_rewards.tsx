"use client";

import { useState, useEffect } from "react";
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
      <div className="card" style={{ padding: 24, textAlign: "center" }}>
        <p style={{ color: "var(--t3)", fontSize: 12.5 }}>Lade Reward History…</p>
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
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

      {/* Wallet Info */}
      <div className="card" style={{ padding: 16, display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(99,102,241,.15)", color: "var(--ind)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Icon name="wallet" size={17} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 10.5, color: "var(--t3)", fontFamily: "var(--mono)", marginBottom: 3 }}>Deine Wallet</div>
          <div style={{ fontSize: 11, fontFamily: "var(--mono)", color: "var(--t2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {data.walletAddress}
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontSize: 18, fontWeight: 700, fontFamily: "var(--disp)", color: "var(--em)" }}>
            {talentchainTxs.length}
          </div>
          <div style={{ fontSize: 10, color: "var(--t3)", fontFamily: "var(--mono)" }}>
            TalentChain TXs
          </div>
        </div>
      </div>

      {/* TalentChain Rewards */}
      <div className="card" style={{ overflow: "hidden" }}>
        <div style={{ padding: "13px 16px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: "var(--em)" }}><Icon name="coin" size={15} /></span>
          <span style={{ fontFamily: "var(--disp)", fontSize: 13, fontWeight: 600 }}>TalentChain Rewards</span>
          <span style={{ fontSize: 10, fontFamily: "var(--mono)", color: "var(--t3)", background: "var(--bg-card)", border: "1px solid var(--line)", padding: "2px 8px", borderRadius: 6, marginLeft: 4 }}>
            {talentchainTxs.length} TOTAL
          </span>
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
              {talentchainTxs.map((item) => (
                <tr key={item.txHash}>
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
                    <button
                      className="row-act"
                      style={{ background: "rgba(99,102,241,.1)", color: "var(--ind)", borderColor: "rgba(99,102,241,.2)" }}
                      onClick={() => openTx(item.txHash)}
                    >
                      <Icon name="arrowRight" size={11} /> Cardanoscan
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Alle TX History */}
      <div className="card" style={{ overflow: "hidden" }}>
        <div style={{ padding: "13px 16px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: "var(--vio)" }}><Icon name="clock" size={15} /></span>
          <span style={{ fontFamily: "var(--disp)", fontSize: 13, fontWeight: 600 }}>Alle Transaktionen</span>
          <span style={{ fontSize: 10, fontFamily: "var(--mono)", color: "var(--t3)", background: "var(--bg-card)", border: "1px solid var(--line)", padding: "2px 8px", borderRadius: 6, marginLeft: 4 }}>
            {allTxs.length} TOTAL
          </span>
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
              {allTxs.map((item) => (
                <tr key={item.txHash}>
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
                    <button
                      className="row-act"
                      style={{ background: "rgba(99,102,241,.1)", color: "var(--ind)", borderColor: "rgba(99,102,241,.2)" }}
                      onClick={() => openTx(item.txHash)}
                    >
                      <Icon name="arrowRight" size={11} /> TX
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}