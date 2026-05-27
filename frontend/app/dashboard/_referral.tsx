"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Icon from "@/components/ui/Icon";
import CardanoLink, { ScriptAddressCard } from "@/components/ui/CardanoLink";
import { api } from "@/lib/api";

const LAYER_COLORS: Record<number, { bg: string; fg: string; glow: string }> = {
  1: { bg: "rgba(99,102,241,.2)",  fg: "var(--ind)", glow: "rgba(99,102,241,0.15)" },
  2: { bg: "rgba(168,85,247,.15)", fg: "var(--pur)", glow: "rgba(168,85,247,0.12)" },
  3: { bg: "rgba(6,182,212,.12)",  fg: "var(--cy)",  glow: "rgba(6,182,212,0.1)" },
  4: { bg: "rgba(34,197,94,.12)",  fg: "var(--em)",  glow: "rgba(34,197,94,0.1)" },
  5: { bg: "rgba(245,158,11,.12)", fg: "var(--am)",  glow: "rgba(245,158,11,0.1)" },
};

// ── MyInviteCode ────────────────────────────────────────────────────
export function MyInviteCode() {
  const [data, setData] = useState<{
    hasCode: boolean;
    inviteCode: string | null;
    invitedCount: number;
    invitedBy: string | null;
    shareLink: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<"code" | "link" | null>(null);

  useEffect(() => {
    api.getMyCode().then(setData).catch(() => setData(null)).finally(() => setLoading(false));
  }, []);

  function copy(type: "code" | "link") {
    const text = type === "code" ? data?.inviteCode : data?.shareLink;
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  }

  if (loading) {
    return (
      <div className="card" style={{ padding: 24 }}>
        <div className="skeleton skeleton-text" style={{ width: 120, marginBottom: 16 }} />
        <div className="skeleton" style={{ height: 64, borderRadius: 12, marginBottom: 16 }} />
        <div style={{ display: "flex", gap: 10 }}>
          <div className="skeleton" style={{ flex: 1, height: 36, borderRadius: 9 }} />
          <div className="skeleton" style={{ flex: 1, height: 36, borderRadius: 9 }} />
        </div>
      </div>
    );
  }

  if (!data || !data.hasCode) {
    return (
      <div className="card empty">
        <div className="empty-ic"><Icon name="users" size={22} /></div>
        <div className="empty-title">Kein Einladungscode</div>
        <div className="empty-text">Du bist nicht im Referral-Netzwerk. Wende dich an den Admin.</div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      style={{ display: "flex", flexDirection: "column", gap: 14 }}
    >
      <div className="card" style={{ padding: 24, position: "relative", overflow: "hidden" }}>
        {/* Animated top line */}
        <motion.div
          animate={{ backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"] }}
          transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
          style={{
            position: "absolute", top: 0, left: 0, right: 0, height: 2,
            background: "linear-gradient(90deg, transparent, var(--vio), var(--ind), var(--cy), transparent)",
            backgroundSize: "200% 100%",
          }}
        />

        <div style={{ fontSize: 10.5, fontFamily: "var(--mono)", color: "var(--t3)", textTransform: "uppercase", letterSpacing: ".12em", marginBottom: 12 }}>
          Dein Einladungscode
        </div>

        {/* Code display */}
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1, type: "spring", stiffness: 300, damping: 20 }}
          style={{
            fontFamily: "var(--mono)",
            fontSize: 32,
            fontWeight: 700,
            letterSpacing: ".18em",
            color: "var(--t1)",
            background: "var(--bg-input)",
            border: "2px solid var(--line-2)",
            borderRadius: "var(--r-lg)",
            padding: "14px 24px",
            textAlign: "center",
            marginBottom: 20,
            position: "relative",
          }}
        >
          {data.inviteCode}
          {/* Glow behind */}
          <div style={{
            position: "absolute", inset: 0, borderRadius: "inherit",
            background: "radial-gradient(ellipse at center, rgba(139,92,246,0.06), transparent 70%)",
            pointerEvents: "none",
          }} />
        </motion.div>

        {/* Copy buttons */}
        <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
          <motion.button
            className="btn btn-pri"
            onClick={() => copy("code")}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            style={{ flex: 1 }}
          >
            <Icon name="check" size={14} strokeWidth={2.5} />
            {copied === "code" ? "Kopiert!" : "Code kopieren"}
          </motion.button>
          <motion.button
            className="btn btn-gho"
            onClick={() => copy("link")}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            style={{ flex: 1 }}
          >
            <Icon name="arrowRight" size={14} />
            {copied === "link" ? "Kopiert!" : "Link kopieren"}
          </motion.button>
        </div>

        {/* Share link */}
        <div style={{ padding: "10px 14px", background: "var(--bg-input)", border: "1px solid var(--line)", borderRadius: "var(--r-md)", marginBottom: 16 }}>
          <div style={{ fontSize: 9, fontFamily: "var(--mono)", color: "var(--t4)", marginBottom: 4, textTransform: "uppercase", letterSpacing: ".1em" }}>Direkt-Link</div>
          <div style={{ fontSize: 10.5, fontFamily: "var(--mono)", color: "var(--t2)", wordBreak: "break-all" }}>{data.shareLink}</div>
        </div>

        {/* Stats grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <motion.div
            whileHover={{ scale: 1.02 }}
            style={{ padding: "12px 14px", background: "var(--bg-input)", border: "1px solid var(--line)", borderRadius: "var(--r-md)" }}
          >
            <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "var(--disp)", color: "var(--em)" }}>{data.invitedCount}</div>
            <div style={{ fontSize: 10.5, color: "var(--t3)", fontFamily: "var(--mono)", marginTop: 2 }}>Eingeladene User</div>
          </motion.div>
          <motion.div
            whileHover={{ scale: 1.02 }}
            style={{ padding: "12px 14px", background: "var(--bg-input)", border: "1px solid var(--line)", borderRadius: "var(--r-md)" }}
          >
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--t2)", marginBottom: 2 }}>{data.invitedBy ?? "—"}</div>
            <div style={{ fontSize: 10.5, color: "var(--t3)", fontFamily: "var(--mono)" }}>Hat mich eingeladen</div>
          </motion.div>
        </div>
      </div>

      <div style={{ padding: "12px 16px", background: "rgba(139,92,246,.08)", border: "1px solid rgba(139,92,246,.2)", borderRadius: "var(--r-md)", display: "flex", gap: 10 }}>
        <span style={{ color: "var(--vio)", flexShrink: 0, marginTop: 1 }}><Icon name="shield" size={14} /></span>
        <p style={{ fontSize: 11.5, color: "var(--t2)", lineHeight: 1.6 }}>
          Jede Person die sich mit deinem Code registriert wird automatisch in der Referral-Kette unter dir eingetragen.
        </p>
      </div>
    </motion.div>
  );
}

// ── useScriptAddress ────────────────────────────────────────────────
function useScriptAddress() {
  const [address, setAddress] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api.getScriptAddress().then((r) => setAddress(r.address)).catch(() => setAddress(null)).finally(() => setLoading(false));
  }, []);
  return { address, loading };
}

// ── DownlinePanel ───────────────────────────────────────────────────
export function DownlinePanel({ userId }: { userId: string }) {
  const [data, setData] = useState<{ userLayer: number; downline: { layer: number; users: any[] }[]; totalCount: number } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    api.getDownline(userId).then(setData).catch(() => setData(null)).finally(() => setLoading(false));
  }, [userId]);

  return (
    <div className="card" style={{ padding: 18 }}>
      <div style={{ fontFamily: "var(--disp)", fontSize: 13, fontWeight: 600, marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ color: "var(--em)" }}><Icon name="arrowRight" size={15} /></span>
        Downline — wer ist unter mir
        {data && data.totalCount > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            style={{ marginLeft: "auto", fontSize: 10, fontFamily: "var(--mono)", color: "var(--em)", background: "var(--em-soft)", padding: "2px 8px", borderRadius: 20 }}
          >
            {data.totalCount} total
          </motion.span>
        )}
      </div>

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[...Array(3)].map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 56, borderRadius: 9 }} />
          ))}
        </div>
      ) : !data || data.downline.length === 0 ? (
        <p style={{ fontSize: 11.5, color: "var(--t3)" }}>Keine Downline.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {data.downline.map((layer, idx) => {
            const c = LAYER_COLORS[layer.layer] || LAYER_COLORS[5];
            return (
              <motion.div
                key={layer.layer}
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.06, duration: 0.35 }}
                style={{ padding: "12px 14px", background: "var(--bg-input)", border: "1px solid var(--line)", borderRadius: "var(--r-md)" }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: layer.users.length > 0 ? 10 : 0 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 7, flexShrink: 0, background: c.bg, color: c.fg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, fontFamily: "var(--mono)", boxShadow: `0 0 0 1px ${c.bg}` }}>
                    L{layer.layer}
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 600 }}>Layer {layer.layer}</span>
                  <span style={{ fontSize: 10, fontFamily: "var(--mono)", color: c.fg, background: c.bg, padding: "1px 7px", borderRadius: 10 }}>{layer.users.length} User</span>
                </div>
                {layer.users.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, paddingLeft: 38 }}>
                    {layer.users.slice(0, 5).map((u: any, i: number) => (
                      <span key={i} style={{ fontSize: 10, fontFamily: "var(--mono)", background: "var(--bg-card)", border: "1px solid var(--line)", padding: "2px 8px", borderRadius: 6, color: "var(--t2)" }}>
                        {u.email?.split("@")[0] || "User"}
                      </span>
                    ))}
                    {layer.users.length > 5 && (
                      <span style={{ fontSize: 10, fontFamily: "var(--mono)", color: "var(--t3)", padding: "2px 8px" }}>
                        +{layer.users.length - 5} weitere
                      </span>
                    )}
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── AdminReferralTree ───────────────────────────────────────────────
export function AdminReferralTree({ users, selectedUserId, setSelectedUserId, referralChain, referralLoading, onLoadChain }: {
  users: any[];
  selectedUserId: string | null;
  setSelectedUserId: (id: string | null) => void;
  referralChain: any[];
  referralLoading: boolean;
  onLoadChain: (userId: string) => void;
}) {
  const { address: scriptAddress, loading: scriptLoading } = useScriptAddress();

  return (
    <div>
      <ScriptAddressCard address={scriptAddress} loading={scriptLoading} />

      {/* User selector */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="card"
        style={{ padding: 16, marginBottom: 14 }}
      >
        <label className="field-label">User auswählen</label>
        <select
          className="field field-select"
          value={selectedUserId || ""}
          onChange={(e) => {
            const uid = e.target.value;
            if (!uid) { setSelectedUserId(null); return; }
            onLoadChain(uid);
          }}
        >
          <option value="">User wählen…</option>
          {users.map((u) => <option key={u.id} value={u.id}>{u.email} — {u.role}</option>)}
        </select>
      </motion.div>

      <AnimatePresence mode="wait">
        {!selectedUserId ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="card empty"
          >
            <div className="empty-ic"><Icon name="tree" size={22} /></div>
            <div className="empty-title">User auswählen</div>
            <div className="empty-text">Wähle einen User um seine Kette zu sehen.</div>
          </motion.div>
        ) : referralLoading ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}
          >
            {[0, 1].map(i => (
              <div key={i} className="card" style={{ padding: 18 }}>
                <div className="skeleton skeleton-title" style={{ width: 140, marginBottom: 14 }} />
                {[...Array(3)].map((_, j) => (
                  <div key={j} className="skeleton" style={{ height: 56, borderRadius: 9, marginBottom: 8 }} />
                ))}
              </div>
            ))}
          </motion.div>
        ) : (
          <motion.div
            key="content"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}
          >
            {/* Upline */}
            <div className="card" style={{ padding: 18 }}>
              <div style={{ fontFamily: "var(--disp)", fontSize: 13, fontWeight: 600, marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ color: "var(--ind)" }}><Icon name="arrowLeft" size={15} /></span>
                Upline — wer ist über mir
                {scriptAddress && (
                  <span style={{ marginLeft: "auto" }}>
                    <CardanoLink type="script" value={scriptAddress} label="Alle UTxOs" variant="button" />
                  </span>
                )}
              </div>

              {referralChain.length === 0 ? (
                <p style={{ fontSize: 11.5, color: "var(--t3)" }}>Keine Upline — dieser User ist Root.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {referralChain.map((node: any, i: number) => {
                    const c = LAYER_COLORS[node.layer] || LAYER_COLORS[5];
                    const isLast = i === referralChain.length - 1;
                    return (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -12 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.07, duration: 0.35 }}
                        style={{
                          padding: "10px 14px",
                          background: isLast ? "rgba(99,102,241,.08)" : "var(--bg-input)",
                          border: `1px solid ${isLast ? "var(--line-2)" : "var(--line)"}`,
                          borderRadius: "var(--r-md)",
                          position: "relative",
                          overflow: "hidden",
                        }}
                      >
                        {isLast && (
                          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: "linear-gradient(90deg, transparent, var(--ind), transparent)" }} />
                        )}
                        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: node.utxoTxHash ? 8 : 0 }}>
                          <div style={{
                            width: 28, height: 28, borderRadius: 7, flexShrink: 0,
                            background: c.bg, color: c.fg,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 10, fontWeight: 700, fontFamily: "var(--mono)",
                            boxShadow: `0 0 0 1px ${c.bg}`,
                          }}>
                            L{node.layer}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {node.user?.email}
                              {i === 0 && (
                                <span style={{ marginLeft: 6, fontSize: 9, color: "var(--ind)", background: "rgba(99,102,241,.12)", padding: "1px 5px", borderRadius: 3, fontFamily: "var(--mono)" }}>ROOT</span>
                              )}
                              {isLast && referralChain.length > 1 && (
                                <span style={{ marginLeft: 6, fontSize: 9, color: "var(--em)", background: "rgba(34,197,94,.12)", padding: "1px 5px", borderRadius: 3, fontFamily: "var(--mono)" }}>DU</span>
                              )}
                            </div>
                            <div style={{ fontSize: 9.5, color: "var(--t4)", fontFamily: "var(--mono)", marginTop: 2 }}>
                              {node.user?.role}{node.inviter && ` · eingeladen von ${node.inviter?.email}`}
                            </div>
                          </div>
                          {node.user?.walletAddress && (
                            <CardanoLink type="address" value={node.user.walletAddress} label="Wallet" variant="button" />
                          )}
                        </div>
                        {node.utxoTxHash && (
                          <div style={{ display: "flex", alignItems: "center", gap: 8, paddingLeft: 40, paddingTop: 6, borderTop: "1px solid var(--line)", marginTop: 6 }}>
                            <span style={{ fontSize: 9, fontFamily: "var(--mono)", color: "var(--t4)", flexShrink: 0 }}>UTxO:</span>
                            <span style={{ fontSize: 9.5, fontFamily: "var(--mono)", color: "var(--t3)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {node.utxoTxHash.slice(0, 14)}…{node.utxoTxHash.slice(-6)}
                            </span>
                            <CardanoLink type="tx" value={node.utxoTxHash} label="UTxO" variant="button" />
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>

            <DownlinePanel userId={selectedUserId} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── UserReferralView ────────────────────────────────────────────────
export function UserReferralView() {
  const [data, setData] = useState<{
    userLayer: number;
    downlineCounts: { layer: number; count: number }[];
    totalDownline: number;
    isInChain: boolean;
    utxoTxHash?: string;
    walletAddress?: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"position" | "code">("position");

  useEffect(() => {
    api.getMyPosition().then(setData).catch(() => setData(null)).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <div className="skeleton" style={{ width: 120, height: 32, borderRadius: 7 }} />
          <div className="skeleton" style={{ width: 140, height: 32, borderRadius: 7 }} />
        </div>
        <div className="card" style={{ padding: 20 }}>
          <div className="skeleton skeleton-title" style={{ width: 180, marginBottom: 16 }} />
          <div className="skeleton" style={{ height: 80, borderRadius: 12 }} />
        </div>
      </div>
    );
  }

  if (!data || !data.isInChain) {
    return (
      <div className="card empty">
        <div className="empty-ic"><Icon name="tree" size={22} /></div>
        <div className="empty-title">Noch nicht im Netzwerk</div>
        <div className="empty-text">Du wurdest noch nicht in das Referral-Netzwerk eingeladen.</div>
      </div>
    );
  }

  const myColors = LAYER_COLORS[data.userLayer] || LAYER_COLORS[5];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      style={{ display: "flex", flexDirection: "column", gap: 14 }}
    >
      {/* Tab switcher */}
      <div style={{ display: "flex", gap: 8 }}>
        <motion.button
          onClick={() => setTab("position")}
          className={tab === "position" ? "btn btn-pri btn-sm" : "btn btn-gho btn-sm"}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
        >
          <Icon name="users" size={12} /> Meine Position
        </motion.button>
        <motion.button
          onClick={() => setTab("code")}
          className={tab === "code" ? "btn btn-pri btn-sm" : "btn btn-gho btn-sm"}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
        >
          <Icon name="arrowRight" size={12} /> Mein Einladungscode
        </motion.button>
      </div>

      <AnimatePresence mode="wait">
        {tab === "code" ? (
          <motion.div key="code" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.25 }}>
            <MyInviteCode />
          </motion.div>
        ) : (
          <motion.div key="position" initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 16 }} transition={{ duration: 0.25 }}>

            {/* Position card */}
            <div className="card" style={{ padding: 20, marginBottom: 14 }}>
              <div style={{ fontFamily: "var(--disp)", fontSize: 13, fontWeight: 600, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ color: "var(--vio)" }}><Icon name="users" size={15} /></span>
                Deine Position im Netzwerk
              </div>

              <motion.div
                whileHover={{ scale: 1.01 }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                  padding: "16px 20px",
                  background: "var(--bg-input)",
                  borderRadius: "var(--r-lg)",
                  border: "1px solid var(--line-2)",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                {/* Background glow */}
                <div style={{ position: "absolute", top: -20, left: -20, width: 100, height: 100, borderRadius: "50%", background: `radial-gradient(circle, ${myColors.glow} 0%, transparent 70%)`, pointerEvents: "none" }} />

                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.1, type: "spring", stiffness: 400, damping: 17 }}
                  style={{
                    width: 48, height: 48, borderRadius: 12,
                    background: myColors.bg, color: myColors.fg,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 16, fontWeight: 700, fontFamily: "var(--mono)",
                    flexShrink: 0,
                    boxShadow: `0 4px 16px ${myColors.glow}`,
                  }}
                >
                  L{data.userLayer}
                </motion.div>

                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, fontFamily: "var(--disp)" }}>Layer {data.userLayer}</div>
                  <div style={{ fontSize: 11.5, color: "var(--t3)", marginTop: 3 }}>
                    {data.userLayer === 1 && "Du bist L1 Ambassador — das höchste Level"}
                    {data.userLayer === 2 && "Du wurdest von einem L1 Ambassador eingeladen"}
                    {data.userLayer === 3 && "Du bist auf Layer 3"}
                    {data.userLayer === 4 && "Du bist auf Layer 4"}
                    {data.userLayer === 5 && "Du bist auf Layer 5"}
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                    {data.walletAddress && <CardanoLink type="address" value={data.walletAddress} label="Meine Wallet" variant="button" />}
                    {data.utxoTxHash && <CardanoLink type="tx" value={data.utxoTxHash} label="Mein Referral UTxO" variant="button" />}
                  </div>
                </div>

                <div style={{ marginLeft: "auto", textAlign: "right", flexShrink: 0 }}>
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.2 }}
                    style={{ fontSize: 24, fontWeight: 700, fontFamily: "var(--disp)", color: myColors.fg }}
                  >
                    {data.totalDownline}
                  </motion.div>
                  <div style={{ fontSize: 10.5, color: "var(--t3)", fontFamily: "var(--mono)" }}>Personen unter dir</div>
                </div>
              </motion.div>
            </div>

            {/* Downline distribution */}
            {data.downlineCounts.length > 0 && (
              <div className="card" style={{ padding: 20 }}>
                <div style={{ fontFamily: "var(--disp)", fontSize: 13, fontWeight: 600, marginBottom: 16 }}>Dein Netzwerk</div>
                {data.downlineCounts.map((d, idx) => {
                  const c = LAYER_COLORS[d.layer] || LAYER_COLORS[5];
                  const bw = Math.min(100, (d.count / (data.totalDownline || 1)) * 100);
                  return (
                    <motion.div
                      key={d.layer}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.06 }}
                      style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}
                    >
                      <div style={{ width: 28, height: 28, borderRadius: 7, flexShrink: 0, background: c.bg, color: c.fg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, fontFamily: "var(--mono)" }}>
                        L{d.layer}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                          <span style={{ fontSize: 11.5, color: "var(--t2)" }}>Layer {d.layer}</span>
                          <span style={{ fontSize: 11.5, fontFamily: "var(--mono)", fontWeight: 700, color: c.fg }}>{d.count} User</span>
                        </div>
                        <div style={{ height: 5, background: "var(--bg-input)", borderRadius: 3, overflow: "hidden" }}>
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${bw}%` }}
                            transition={{ delay: 0.2 + idx * 0.06, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                            style={{ height: "100%", background: `linear-gradient(90deg, ${c.fg}, ${c.fg}99)`, borderRadius: 3 }}
                          />
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}