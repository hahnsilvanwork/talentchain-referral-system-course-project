"use client";

import { useState, useEffect } from "react";
import Icon from "@/components/ui/Icon";
import { api } from "@/lib/api";

const LAYER_COLORS: Record<number, { bg: string; fg: string }> = {
  1: { bg: "rgba(99,102,241,.2)",  fg: "var(--ind)" },
  2: { bg: "rgba(168,85,247,.15)", fg: "var(--pur)" },
  3: { bg: "rgba(6,182,212,.12)",  fg: "var(--cy)"  },
  4: { bg: "rgba(34,197,94,.12)",  fg: "var(--em)"  },
  5: { bg: "rgba(245,158,11,.12)", fg: "var(--am)"  },
};

// ── Downline Panel (Admin) ──────────────────────────────────────────
export function DownlinePanel({ userId }: { userId: string }) {
  const [data, setData] = useState<{
    userLayer: number;
    downline: { layer: number; users: any[] }[];
    totalCount: number;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    api.getDownline(userId)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [userId]);

  return (
    <div className="card" style={{ padding: 18 }}>
      <div style={{ fontFamily: "var(--disp)", fontSize: 13, fontWeight: 600, marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ color: "var(--em)" }}><Icon name="arrowRight" size={15} /></span>
        Downline — wer ist unter mir
        {data && data.totalCount > 0 && (
          <span style={{ marginLeft: "auto", fontSize: 10, fontFamily: "var(--mono)", color: "var(--em)", background: "var(--em-soft)", padding: "2px 8px", borderRadius: 20 }}>
            {data.totalCount} total
          </span>
        )}
      </div>

      {loading ? (
        <p style={{ fontSize: 11.5, color: "var(--t3)" }}>Lade Downline…</p>
      ) : !data || data.downline.length === 0 ? (
        <p style={{ fontSize: 11.5, color: "var(--t3)" }}>Keine Downline.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {data.downline.map((layer) => {
            const colors = LAYER_COLORS[layer.layer] || LAYER_COLORS[5];
            return (
              <div key={layer.layer} style={{ padding: "12px 14px", background: "var(--bg-input)", border: "1px solid var(--line)", borderRadius: "var(--r-md)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: layer.users.length > 0 ? 10 : 0 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 7, flexShrink: 0, background: colors.bg, color: colors.fg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, fontFamily: "var(--mono)" }}>
                    L{layer.layer}
                  </div>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: 12, fontWeight: 600 }}>Layer {layer.layer}</span>
                    <span style={{ marginLeft: 8, fontSize: 10, fontFamily: "var(--mono)", color: colors.fg, background: colors.bg, padding: "1px 7px", borderRadius: 10 }}>
                      {layer.users.length} User
                    </span>
                  </div>
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
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Admin Referral Baum ─────────────────────────────────────────────
interface AdminReferralProps {
  users: any[];
  selectedUserId: string | null;
  setSelectedUserId: (id: string | null) => void;
  referralChain: any[];
  referralLoading: boolean;
  onLoadChain: (userId: string) => void;
}

export function AdminReferralTree({
  users, selectedUserId, setSelectedUserId,
  referralChain, referralLoading, onLoadChain,
}: AdminReferralProps) {
  return (
    <div>
      <div className="card" style={{ padding: 16, marginBottom: 14 }}>
        <label className="field-label">User auswählen</label>
        <select
          className="field field-select"
          value={selectedUserId || ""}
          onChange={async (e) => {
            const uid = e.target.value;
            if (!uid) { setSelectedUserId(null); return; }
            onLoadChain(uid);
          }}
        >
          <option value="">User wählen…</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>{u.email} — {u.role}</option>
          ))}
        </select>
      </div>

      {!selectedUserId ? (
        <div className="card empty">
          <div className="empty-ic"><Icon name="tree" size={22} /></div>
          <div className="empty-title">User auswählen</div>
          <div className="empty-text">Wähle einen User um seine Kette zu sehen.</div>
        </div>
      ) : referralLoading ? (
        <p style={{ color: "var(--t3)", fontSize: 12.5, padding: "2rem", textAlign: "center" }}>Lade Kette…</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div className="card" style={{ padding: 18 }}>
            <div style={{ fontFamily: "var(--disp)", fontSize: 13, fontWeight: 600, marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ color: "var(--ind)" }}><Icon name="arrowLeft" size={15} /></span>
              Upline — wer ist über mir
            </div>
            {referralChain.length === 0 ? (
              <p style={{ fontSize: 11.5, color: "var(--t3)" }}>Keine Upline — dieser User ist Root.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {referralChain.map((node: any, i: number) => {
                  const colors = LAYER_COLORS[node.layer] || LAYER_COLORS[5];
                  const isLast = i === referralChain.length - 1;
                  return (
                    <div key={i} style={{
                      display: "flex", alignItems: "center", gap: 12,
                      padding: "10px 14px",
                      background: isLast ? "rgba(99,102,241,.08)" : "var(--bg-input)",
                      border: `1px solid ${isLast ? "var(--line-2)" : "var(--line)"}`,
                      borderRadius: "var(--r-md)",
                    }}>
                      <div style={{ width: 28, height: 28, borderRadius: 7, flexShrink: 0, background: colors.bg, color: colors.fg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, fontFamily: "var(--mono)" }}>
                        L{node.layer}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {node.user?.email}
                          {i === 0 && <span style={{ marginLeft: 6, fontSize: 9, color: "var(--ind)", background: "rgba(99,102,241,.12)", padding: "1px 5px", borderRadius: 3, fontFamily: "var(--mono)" }}>ROOT</span>}
                          {isLast && referralChain.length > 1 && <span style={{ marginLeft: 6, fontSize: 9, color: "var(--em)", background: "rgba(34,197,94,.12)", padding: "1px 5px", borderRadius: 3, fontFamily: "var(--mono)" }}>DU</span>}
                        </div>
                        <div style={{ fontSize: 9.5, color: "var(--t4)", fontFamily: "var(--mono)", marginTop: 2 }}>
                          {node.user?.role}{node.inviter && ` · eingeladen von ${node.inviter?.email}`}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <DownlinePanel userId={selectedUserId} />
        </div>
      )}
    </div>
  );
}

// ── User eigene Ansicht ─────────────────────────────────────────────
export function UserReferralView() {
  const [data, setData] = useState<{
    userLayer: number;
    downlineCounts: { layer: number; count: number }[];
    totalDownline: number;
    isInChain: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getMyPosition()
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
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
      {/* Eigene Position */}
      <div className="card" style={{ padding: 20 }}>
        <div style={{ fontFamily: "var(--disp)", fontSize: 13, fontWeight: 600, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: "var(--vio)" }}><Icon name="users" size={15} /></span>
          Deine Position im Netzwerk
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "16px 20px", background: "var(--bg-input)", borderRadius: "var(--r-lg)", border: "1px solid var(--line-2)" }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: myColors.bg, color: myColors.fg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 700, fontFamily: "var(--mono)", flexShrink: 0 }}>
            L{data.userLayer}
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, fontFamily: "var(--disp)" }}>Layer {data.userLayer}</div>
            <div style={{ fontSize: 11.5, color: "var(--t3)", marginTop: 3 }}>
              {data.userLayer === 1 && "Du bist L1 Ambassador — das höchste Level"}
              {data.userLayer === 2 && "Du wurdest von einem L1 Ambassador eingeladen"}
              {data.userLayer === 3 && "Du bist auf Layer 3 des Netzwerks"}
              {data.userLayer === 4 && "Du bist auf Layer 4 des Netzwerks"}
              {data.userLayer === 5 && "Du bist auf Layer 5 des Netzwerks"}
            </div>
          </div>
          <div style={{ marginLeft: "auto", textAlign: "right" }}>
            <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "var(--disp)", color: myColors.fg }}>{data.totalDownline}</div>
            <div style={{ fontSize: 10.5, color: "var(--t3)", fontFamily: "var(--mono)" }}>Personen unter dir</div>
          </div>
        </div>
      </div>

      {/* Downline Zahlen */}
      {data.downlineCounts.length > 0 && (
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontFamily: "var(--disp)", fontSize: 13, fontWeight: 600, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ color: "var(--em)" }}><Icon name="arrowRight" size={15} /></span>
            Dein Netzwerk unter dir
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {data.downlineCounts.map((d) => {
              const colors = LAYER_COLORS[d.layer] || LAYER_COLORS[5];
              const barWidth = Math.min(100, (d.count / (data.totalDownline || 1)) * 100);
              return (
                <div key={d.layer}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 7, flexShrink: 0, background: colors.bg, color: colors.fg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, fontFamily: "var(--mono)" }}>
                      L{d.layer}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                        <span style={{ fontSize: 11.5, color: "var(--t2)" }}>Layer {d.layer}</span>
                        <span style={{ fontSize: 11.5, fontFamily: "var(--mono)", fontWeight: 700, color: colors.fg }}>{d.count} User</span>
                      </div>
                      <div style={{ height: 5, background: "var(--bg-input)", borderRadius: 3, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${barWidth}%`, background: `linear-gradient(90deg, ${colors.fg}, ${colors.fg}99)`, borderRadius: 3 }} />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 14, padding: "10px 14px", background: "var(--em-soft)", border: "1px solid rgba(34,197,94,.2)", borderRadius: "var(--r-md)", display: "flex", alignItems: "center", gap: 10 }}>
            <Icon name="coin" size={14} style={{ color: "var(--em)" }} />
            <span style={{ fontSize: 11.5, color: "var(--em)" }}>
              Du erhältst Reward-Anteile von allen {data.totalDownline} Personen in deinem Netzwerk.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}