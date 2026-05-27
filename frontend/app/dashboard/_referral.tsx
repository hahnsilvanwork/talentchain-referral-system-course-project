"use client";

import { useState, useEffect } from "react";
import Icon from "@/components/ui/Icon";
import CardanoLink, { ScriptAddressCard } from "@/components/ui/CardanoLink";
import { api } from "@/lib/api";

const LAYER_COLORS: Record<number, { bg: string; fg: string }> = {
  1: { bg: "rgba(99,102,241,.2)",  fg: "var(--ind)" },
  2: { bg: "rgba(168,85,247,.15)", fg: "var(--pur)" },
  3: { bg: "rgba(6,182,212,.12)",  fg: "var(--cy)"  },
  4: { bg: "rgba(34,197,94,.12)",  fg: "var(--em)"  },
  5: { bg: "rgba(245,158,11,.12)", fg: "var(--am)"  },
};

// MyInviteCode component
export function MyInviteCode() {
  const [data, setData] = useState<{
    hasCode: boolean;
    inviteCode: string | null;
    invitedCount: number;
    invitedBy: string | null;
    shareLink: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<"code"|"link"|null>(null);

  useEffect(() => {
    api.getMyCode().then(setData).catch(() => setData(null)).finally(() => setLoading(false));
  }, []);

  function copy(type: "code"|"link") {
    const text = type === "code" ? data?.inviteCode : data?.shareLink;
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  }

  if (loading) return <div className="card" style={{ padding: 24, textAlign: "center" }}><p style={{ color: "var(--t3)", fontSize: 12.5 }}>Lade Code…</p></div>;

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
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div className="card" style={{ padding: 24, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg,transparent,var(--vio),transparent)" }} />
        <div style={{ fontSize: 10.5, fontFamily: "var(--mono)", color: "var(--t3)", textTransform: "uppercase", letterSpacing: ".12em", marginBottom: 12 }}>Dein Einladungscode</div>
        <div style={{ fontFamily: "var(--mono)", fontSize: 32, fontWeight: 700, letterSpacing: ".18em", color: "var(--t1)", background: "var(--bg-input)", border: "2px solid var(--line-2)", borderRadius: "var(--r-lg)", padding: "14px 24px", textAlign: "center", marginBottom: 20 }}>
          {data.inviteCode}
        </div>
        <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
          <button className="btn btn-pri" onClick={() => copy("code")} style={{ flex: 1 }}>
            <Icon name="check" size={14} strokeWidth={2.5} />
            {copied === "code" ? "Kopiert!" : "Code kopieren"}
          </button>
          <button className="btn btn-gho" onClick={() => copy("link")} style={{ flex: 1 }}>
            <Icon name="arrowRight" size={14} />
            {copied === "link" ? "Kopiert!" : "Link kopieren"}
          </button>
        </div>
        <div style={{ padding: "10px 14px", background: "var(--bg-input)", border: "1px solid var(--line)", borderRadius: "var(--r-md)", marginBottom: 16 }}>
          <div style={{ fontSize: 9, fontFamily: "var(--mono)", color: "var(--t4)", marginBottom: 4, textTransform: "uppercase", letterSpacing: ".1em" }}>Direkt-Link</div>
          <div style={{ fontSize: 10.5, fontFamily: "var(--mono)", color: "var(--t2)", wordBreak: "break-all" }}>{data.shareLink}</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div style={{ padding: "12px 14px", background: "var(--bg-input)", border: "1px solid var(--line)", borderRadius: "var(--r-md)" }}>
            <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "var(--disp)", color: "var(--em)" }}>{data.invitedCount}</div>
            <div style={{ fontSize: 10.5, color: "var(--t3)", fontFamily: "var(--mono)", marginTop: 2 }}>Eingeladene User</div>
          </div>
          <div style={{ padding: "12px 14px", background: "var(--bg-input)", border: "1px solid var(--line)", borderRadius: "var(--r-md)" }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--t2)", marginBottom: 2 }}>{data.invitedBy ?? "—"}</div>
            <div style={{ fontSize: 10.5, color: "var(--t3)", fontFamily: "var(--mono)" }}>Hat mich eingeladen</div>
          </div>
        </div>
      </div>
      <div style={{ padding: "12px 16px", background: "rgba(139,92,246,.08)", border: "1px solid rgba(139,92,246,.2)", borderRadius: "var(--r-md)", display: "flex", gap: 10 }}>
        <span style={{ color: "var(--vio)", flexShrink: 0, marginTop: 1 }}><Icon name="shield" size={14} /></span>
        <p style={{ fontSize: 11.5, color: "var(--t2)", lineHeight: 1.6 }}>
          Jede Person die sich mit deinem Code registriert wird automatisch in der Referral-Kette unter dir eingetragen.
        </p>
      </div>
    </div>
  );
}

function useScriptAddress() {
  const [address, setAddress] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api.getScriptAddress().then((r) => setAddress(r.address)).catch(() => setAddress(null)).finally(() => setLoading(false));
  }, []);
  return { address, loading };
}

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
        {data && data.totalCount > 0 && <span style={{ marginLeft: "auto", fontSize: 10, fontFamily: "var(--mono)", color: "var(--em)", background: "var(--em-soft)", padding: "2px 8px", borderRadius: 20 }}>{data.totalCount} total</span>}
      </div>
      {loading ? <p style={{ fontSize: 11.5, color: "var(--t3)" }}>Lade Downline…</p>
        : !data || data.downline.length === 0 ? <p style={{ fontSize: 11.5, color: "var(--t3)" }}>Keine Downline.</p>
        : <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {data.downline.map((layer) => {
            const c = LAYER_COLORS[layer.layer] || LAYER_COLORS[5];
            return (
              <div key={layer.layer} style={{ padding: "12px 14px", background: "var(--bg-input)", border: "1px solid var(--line)", borderRadius: "var(--r-md)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: layer.users.length > 0 ? 10 : 0 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 7, flexShrink: 0, background: c.bg, color: c.fg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, fontFamily: "var(--mono)" }}>L{layer.layer}</div>
                  <span style={{ fontSize: 12, fontWeight: 600 }}>Layer {layer.layer}</span>
                  <span style={{ fontSize: 10, fontFamily: "var(--mono)", color: c.fg, background: c.bg, padding: "1px 7px", borderRadius: 10 }}>{layer.users.length} User</span>
                </div>
                {layer.users.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, paddingLeft: 38 }}>
                    {layer.users.slice(0, 5).map((u: any, i: number) => (
                      <span key={i} style={{ fontSize: 10, fontFamily: "var(--mono)", background: "var(--bg-card)", border: "1px solid var(--line)", padding: "2px 8px", borderRadius: 6, color: "var(--t2)" }}>{u.email?.split("@")[0] || "User"}</span>
                    ))}
                    {layer.users.length > 5 && <span style={{ fontSize: 10, fontFamily: "var(--mono)", color: "var(--t3)", padding: "2px 8px" }}>+{layer.users.length - 5} weitere</span>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      }
    </div>
  );
}

export function AdminReferralTree({ users, selectedUserId, setSelectedUserId, referralChain, referralLoading, onLoadChain }: {
  users: any[]; selectedUserId: string | null; setSelectedUserId: (id: string | null) => void;
  referralChain: any[]; referralLoading: boolean; onLoadChain: (userId: string) => void;
}) {
  const { address: scriptAddress, loading: scriptLoading } = useScriptAddress();
  return (
    <div>
      <ScriptAddressCard address={scriptAddress} loading={scriptLoading} />
      <div className="card" style={{ padding: 16, marginBottom: 14 }}>
        <label className="field-label">User auswählen</label>
        <select className="field field-select" value={selectedUserId || ""} onChange={(e) => { const uid = e.target.value; if (!uid) { setSelectedUserId(null); return; } onLoadChain(uid); }}>
          <option value="">User wählen…</option>
          {users.map((u) => <option key={u.id} value={u.id}>{u.email} — {u.role}</option>)}
        </select>
      </div>
      {!selectedUserId ? (
        <div className="card empty"><div className="empty-ic"><Icon name="tree" size={22} /></div><div className="empty-title">User auswählen</div><div className="empty-text">Wähle einen User um seine Kette zu sehen.</div></div>
      ) : referralLoading ? (
        <p style={{ color: "var(--t3)", fontSize: 12.5, padding: "2rem", textAlign: "center" }}>Lade Kette…</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div className="card" style={{ padding: 18 }}>
            <div style={{ fontFamily: "var(--disp)", fontSize: 13, fontWeight: 600, marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ color: "var(--ind)" }}><Icon name="arrowLeft" size={15} /></span>
              Upline — wer ist über mir
              {scriptAddress && <span style={{ marginLeft: "auto" }}><CardanoLink type="script" value={scriptAddress} label="Alle UTxOs" variant="button" /></span>}
            </div>
            {referralChain.length === 0 ? <p style={{ fontSize: 11.5, color: "var(--t3)" }}>Keine Upline — dieser User ist Root.</p>
              : <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {referralChain.map((node: any, i: number) => {
                  const c = LAYER_COLORS[node.layer] || LAYER_COLORS[5];
                  const isLast = i === referralChain.length - 1;
                  return (
                    <div key={i} style={{ padding: "10px 14px", background: isLast ? "rgba(99,102,241,.08)" : "var(--bg-input)", border: `1px solid ${isLast ? "var(--line-2)" : "var(--line)"}`, borderRadius: "var(--r-md)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: node.utxoTxHash ? 8 : 0 }}>
                        <div style={{ width: 28, height: 28, borderRadius: 7, flexShrink: 0, background: c.bg, color: c.fg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, fontFamily: "var(--mono)" }}>L{node.layer}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {node.user?.email}
                            {i === 0 && <span style={{ marginLeft: 6, fontSize: 9, color: "var(--ind)", background: "rgba(99,102,241,.12)", padding: "1px 5px", borderRadius: 3, fontFamily: "var(--mono)" }}>ROOT</span>}
                            {isLast && referralChain.length > 1 && <span style={{ marginLeft: 6, fontSize: 9, color: "var(--em)", background: "rgba(34,197,94,.12)", padding: "1px 5px", borderRadius: 3, fontFamily: "var(--mono)" }}>DU</span>}
                          </div>
                          <div style={{ fontSize: 9.5, color: "var(--t4)", fontFamily: "var(--mono)", marginTop: 2 }}>{node.user?.role}{node.inviter && ` · eingeladen von ${node.inviter?.email}`}</div>
                        </div>
                        {node.user?.walletAddress && <CardanoLink type="address" value={node.user.walletAddress} label="Wallet" variant="button" />}
                      </div>
                      {node.utxoTxHash && (
                        <div style={{ display: "flex", alignItems: "center", gap: 8, paddingLeft: 40, paddingTop: 6, borderTop: "1px solid var(--line)", marginTop: 6 }}>
                          <span style={{ fontSize: 9, fontFamily: "var(--mono)", color: "var(--t4)", flexShrink: 0 }}>UTxO:</span>
                          <span style={{ fontSize: 9.5, fontFamily: "var(--mono)", color: "var(--t3)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{node.utxoTxHash.slice(0, 14)}…{node.utxoTxHash.slice(-6)}</span>
                          <CardanoLink type="tx" value={node.utxoTxHash} label="UTxO" variant="button" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            }
          </div>
          <DownlinePanel userId={selectedUserId} />
        </div>
      )}
    </div>
  );
}

export function UserReferralView() {
  const [data, setData] = useState<{ userLayer: number; downlineCounts: { layer: number; count: number }[]; totalDownline: number; isInChain: boolean; utxoTxHash?: string; walletAddress?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"position"|"code">("position");

  useEffect(() => {
    api.getMyPosition().then(setData).catch(() => setData(null)).finally(() => setLoading(false));
  }, []);

  if (loading) return <p style={{ color: "var(--t3)", fontSize: 12.5, padding: "2rem", textAlign: "center" }}>Lade deine Position…</p>;

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
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => setTab("position")} className={tab === "position" ? "btn btn-pri btn-sm" : "btn btn-gho btn-sm"}><Icon name="users" size={12} /> Meine Position</button>
        <button onClick={() => setTab("code")} className={tab === "code" ? "btn btn-pri btn-sm" : "btn btn-gho btn-sm"}><Icon name="arrowRight" size={12} /> Mein Einladungscode</button>
      </div>

      {tab === "code" ? <MyInviteCode /> : (
        <>
          <div className="card" style={{ padding: 20 }}>
            <div style={{ fontFamily: "var(--disp)", fontSize: 13, fontWeight: 600, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ color: "var(--vio)" }}><Icon name="users" size={15} /></span>
              Deine Position im Netzwerk
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "16px 20px", background: "var(--bg-input)", borderRadius: "var(--r-lg)", border: "1px solid var(--line-2)" }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: myColors.bg, color: myColors.fg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 700, fontFamily: "var(--mono)", flexShrink: 0 }}>L{data.userLayer}</div>
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
              <div style={{ marginLeft: "auto", textAlign: "right" }}>
                <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "var(--disp)", color: myColors.fg }}>{data.totalDownline}</div>
                <div style={{ fontSize: 10.5, color: "var(--t3)", fontFamily: "var(--mono)" }}>Personen unter dir</div>
              </div>
            </div>
          </div>
          {data.downlineCounts.length > 0 && (
            <div className="card" style={{ padding: 20 }}>
              <div style={{ fontFamily: "var(--disp)", fontSize: 13, fontWeight: 600, marginBottom: 16 }}>Dein Netzwerk</div>
              {data.downlineCounts.map((d) => {
                const c = LAYER_COLORS[d.layer] || LAYER_COLORS[5];
                const bw = Math.min(100, (d.count / (data.totalDownline || 1)) * 100);
                return (
                  <div key={d.layer} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 7, flexShrink: 0, background: c.bg, color: c.fg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, fontFamily: "var(--mono)" }}>L{d.layer}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                        <span style={{ fontSize: 11.5, color: "var(--t2)" }}>Layer {d.layer}</span>
                        <span style={{ fontSize: 11.5, fontFamily: "var(--mono)", fontWeight: 700, color: c.fg }}>{d.count} User</span>
                      </div>
                      <div style={{ height: 5, background: "var(--bg-input)", borderRadius: 3, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${bw}%`, background: `linear-gradient(90deg, ${c.fg}, ${c.fg}99)`, borderRadius: 3 }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}