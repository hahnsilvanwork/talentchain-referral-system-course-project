# TalentChain

**Dezentrale Recruiting-Plattform auf der Cardano Blockchain**

TalentChain verbindet reale Recruiting-Ereignisse (Stellenwechsel, Vertragsabschlüsse) mit Smart Contracts. Rewards werden automatisch und manipulationssicher an alle Mitglieder der Einladungskette ausbezahlt.

**Kernprinzip: Off-Chain berechnen — On-Chain verifizieren.**

>Dieses Projekt läuft auf dem **Cardano Preprod Testnet**. Es wird kein echtes Geld bewegt.

---

## Inhaltsverzeichnis

- [Überblick](#überblick)
- [Voraussetzungen](#voraussetzungen)
- [Projektstruktur](#projektstruktur)
- [Setup — Schritt für Schritt](#setup--schritt-für-schritt)
  - [1. Repository klonen](#1-repository-klonen)
  - [2. Abhängigkeiten installieren](#2-abhängigkeiten-installieren)
  - [3. Cardano Wallet einrichten](#3-cardano-wallet-einrichten)
  - [4. Blockfrost API Key holen](#4-blockfrost-api-key-holen)
  - [5. Umgebungsvariablen konfigurieren](#5-umgebungsvariablen-konfigurieren)
  - [6. Datenbank einrichten](#6-datenbank-einrichten)
  - [7. Admin-Account erstellen](#7-admin-account-erstellen)
  - [8. Smart Contracts deployen](#8-smart-contracts-deployen)
  - [9. Backend starten](#9-backend-starten)
  - [10. Frontend starten](#10-frontend-starten)
- [Wallet für Browser einrichten](#wallet-für-browser-einrichten)
- [Ersten L1 Ambassador erstellen](#ersten-l1-ambassador-erstellen)
- [Umgebungsvariablen Referenz](#umgebungsvariablen-referenz)
- [Technologie-Stack](#technologie-stack)
- [Architektur](#architektur)
- [Häufige Fehler](#häufige-fehler)

---

## Überblick

| Schicht | Technologie |
|---|---|
| Frontend | Next.js 14 + React + Framer Motion |
| Backend | Node.js + Express + TypeScript |
| Datenbank | PostgreSQL + Prisma |
| Blockchain | Cardano Preprod Testnet |
| Smart Contracts | Aiken → Plutus V3 |
| Off-Chain SDK | Lucid Evolution |
| TX Signing | Cardano Serialization Library (CSL) |
| Provider | Blockfrost (kein eigener Node nötig) |
| Auth | JWT + bcrypt |

---

## Voraussetzungen

Folgende Programme müssen installiert sein:

| Tool | Version | Download |
|---|---|---|
| Node.js | ≥ 18 | https://nodejs.org |
| npm | ≥ 9 | kommt mit Node.js |
| PostgreSQL | ≥ 14 | https://www.postgresql.org/download |
| Git | aktuell | https://git-scm.com |

Ausserdem benötigt:

- **Blockfrost Account** (kostenlos) → https://blockfrost.io
- **Eternl Wallet** Browser-Extension (Chrome/Brave) → https://eternl.io
- **tADA** (Test-ADA) für das Admin-Wallet → Cardano Preprod Faucet

---

## Projektstruktur

```
talentchain/
├── backend/
│   ├── api/
│   │   ├── middleware/
│   │   │   └── auth.ts          # JWT + Admin Middleware
│   │   └── routes/
│   │       ├── auth.ts          # Register / Login
│   │       ├── admin.ts         # User-Verwaltung, L1, Blacklist
│   │       ├── match.ts         # Match-Events
│   │       ├── rewards.ts       # Reward-Verteilung
│   │       └── referral.ts      # Referral-Kette
│   ├── chain/
│   │   ├── blockfrost.ts        # Blockfrost Provider
│   │   ├── cardano-tx.ts        # TX-Bau via CSL
│   │   ├── chain-utils.ts       # Invite-Codes, Kaskaden-Entfernung
│   │   ├── datum-decoder.ts     # CBOR Datum Dekodierung
│   │   ├── mint-nft.ts          # Identity NFT Minting (Lucid)
│   │   ├── referral-chain.ts    # On-Chain Traversal, UTxO erstellen
│   │   ├── referral-traversal.ts # Reward-Berechnung
│   │   ├── registration-bonus.ts # Registrierungsbonus (CHF 60)
│   │   ├── send-rewards.ts      # Reward TX senden
│   │   ├── tx-signer.ts         # CSL Signing Helper
│   │   └── wallet.ts            # Admin-Wallet aus Seed Phrase
│   ├── prisma/
│   │   ├── schema.prisma        # Datenbankschema
│   │   └── client.ts            # Prisma Client
│   ├── scripts/
│   │   ├── seed-admin.ts        # Admin-Account erstellen
│   │   └── assign-invite-codes.ts # Migration: Invite-Codes vergeben
│   └── server.ts                # Express App Entry Point
├── contracts/
│   └── plutus.json              # Kompilierte Aiken Smart Contracts
├── frontend/
│   ├── app/
│   │   ├── dashboard/           # Dashboard Pages
│   │   ├── login/               # Login Page
│   │   └── page.tsx             # Landing Page
│   ├── components/
│   │   ├── dashboard/           # Dashboard-Komponenten
│   │   └── ui/                  # Wiederverwendbare UI-Komponenten
│   └── lib/
│       ├── api.ts               # API Client
│       └── scenarios.ts         # Szenarien & Fee-Berechnung
└── README.md
```

---

## Setup — Schritt für Schritt

### 1. Repository klonen

```bash
git clone <repository-url>
cd talentchain
```

---

### 2. Abhängigkeiten installieren

**Backend:**
```bash
cd backend
npm install
```

**Frontend:**
```bash
cd frontend
npm install
```

---

### 3. Cardano Wallet einrichten

Das Backend braucht ein **Admin-Wallet** mit einer Seed Phrase. Dieses Wallet signiert alle Blockchain-Transaktionen (NFT Minting, Referral UTxOs, Reward-Zahlungen).

#### Option A — Neues Wallet in Eternl erstellen (empfohlen)

1. Eternl Browser-Extension installieren: https://eternl.io
2. Eternl öffnen → **"Add Wallet"** → **"Create new wallet"**
3. Seed Phrase (24 Wörter) sicher notieren — diese kommt in die `.env`
4. Im Wallet: oben rechts auf das Netzwerk-Symbol → **"Preprod"** wählen
5. Wallet-Adresse kopieren (beginnt mit `addr_test1...`)

#### tADA besorgen (Test-ADA für Transaktionsgebühren)

Das Admin-Wallet braucht tADA für Gebühren. Mindestens **10 tADA** empfohlen.

1. Cardano Preprod Faucet öffnen: https://docs.cardano.org/cardano-testnets/tools/faucet
2. Netzwerk **"Preprod"** wählen
3. Wallet-Adresse einfügen → **"Request funds"**
4. Nach ca. 1–2 Minuten erscheinen die tADA im Wallet

#### Payment Key Hash (PKH) ermitteln

Der PKH wird für die Smart Contracts benötigt. Nach dem Setup (Schritt 5–6) ausführen:

```bash
cd backend
npx ts-node chain/get-pkh.ts
```

Oder im laufenden Backend über die API:
```bash
curl -X POST http://localhost:3001/api/admin/pkh \
  -H "Content-Type: application/json" \
  -d '{"address": "addr_test1..."}'
```

---

### 4. Blockfrost API Key holen

Blockfrost ersetzt einen eigenen Cardano-Node und ist kostenlos nutzbar.

1. Account erstellen: https://blockfrost.io
2. Dashboard → **"+ Add new project"**
3. Name: `TalentChain`, Network: **`Cardano Preprod`** → **"Save"**
4. Den generierten API Key kopieren (beginnt mit `preprod...`)

---

### 5. Umgebungsvariablen konfigurieren

Im `backend/` Ordner eine `.env` Datei erstellen:

```bash
cd backend
cp .env.example .env   # falls vorhanden, sonst neu erstellen
```

`.env` Inhalt — alle Werte müssen ausgefüllt werden:

```env
# ── Blockfrost ──────────────────────────────────────────────────────
BLOCKFROST_API_KEY=preprod...          # Von Schritt 4

# ── Cardano ─────────────────────────────────────────────────────────
CARDANO_NETWORK=preprod

# ── Admin Wallet ────────────────────────────────────────────────────
ADMIN_SEED_PHRASE=wort1 wort2 wort3 ... wort24   # 24-Wörter Seed Phrase
ADMIN_ADDRESS=addr_test1...                       # Wallet-Adresse
ADMIN_WALLET_PKH=561fe5dc...                      # Payment Key Hash (Hex)

# ── Datenbank ───────────────────────────────────────────────────────
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/talentchain"

# ── Auth ────────────────────────────────────────────────────────────
JWT_SECRET=ein_langes_zufaelliges_geheimnis_hier_einsetzen

# ── Server ──────────────────────────────────────────────────────────
PORT=3001
FRONTEND_URL=http://localhost:3000

# ── Admin Seed (für seed-admin.ts Skript) ───────────────────────────
SEED_ADMIN_EMAIL=admin@talentchain.ch
SEED_ADMIN_PASSWORD=sicherespasswort
SEED_ADMIN_WALLET=addr_test1...        # Gleiche Adresse wie ADMIN_ADDRESS
```

>**Wichtig:** Die `.env` Datei niemals in Git committen. Sie enthält die Seed Phrase — wer die Seed Phrase kennt, kontrolliert das Admin-Wallet.

---

### 6. Datenbank einrichten

PostgreSQL muss laufen. Datenbank erstellen und Schema migrieren:

```bash
# Datenbank erstellen (falls nicht vorhanden)
createdb talentchain

# Schema migrieren
cd backend
npx prisma migrate deploy

# Prisma Client generieren
npx prisma generate
```

Datenbank prüfen (optional):
```bash
npx prisma studio
# Öffnet Browser-UI auf http://localhost:5555
```

---

### 7. Admin-Account erstellen

Das Seed-Skript erstellt den ersten Admin-User in der Datenbank. Die Werte kommen aus der `.env` (`SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, `SEED_ADMIN_WALLET`).

```bash
cd backend
npx ts-node scripts/seed-admin.ts
```

Erwartete Ausgabe:
```
TalentChain — Admin Seed Script
─────────────────────────────────
✓ Neuer Admin erstellt: admin@talentchain.ch

  Email:    admin@talentchain.ch
  Passwort: sicherespasswort
  Wallet:   addr_test1qptplew...

→ Einloggen auf http://localhost:3000/login
```

---

### 8. Smart Contracts deployen

Die kompilierten Contracts liegen in `contracts/plutus.json`. Vor dem ersten Start prüfen ob die Datei vorhanden ist:

```bash
ls contracts/plutus.json
```

Falls die Contracts neu kompiliert werden müssen (erfordert [Aiken](https://aiken-lang.org/installation-instructions)):

```bash
cd contracts
aiken build
# Generiert plutus.json
```

Contract-Adressen prüfen (nach dem Backend-Start):
```bash
curl http://localhost:3001/api/admin/referral-script-address \
  -H "Authorization: Bearer <admin-token>"
```

---

### 9. Backend starten

```bash
cd backend
npm run dev
```

Backend läuft auf: `http://localhost:3001`

Health-Check:
```bash
curl http://localhost:3001/health
# {"status":"ok","network":"preprod"}
```

---

### 10. Frontend starten

```bash
cd frontend
npm run dev
```

Frontend läuft auf: `http://localhost:3000`

---

## Wallet für Browser einrichten

Für das **Frontend** (Wallet verbinden auf der Landing Page) braucht jeder User eine Browser-Wallet auf dem Preprod Testnet.

1. **Eternl** installieren: https://eternl.io
2. Eternl öffnen → neues Wallet erstellen oder bestehende Seed Phrase importieren
3. Netzwerk wechseln: Einstellungen → **"Preprod Testnet"**
4. tADA holen: https://docs.cardano.org/cardano-testnets/tools/faucet
5. Auf `http://localhost:3000` → **"Wallet verbinden"** klicken

Unterstützte Wallets:

| Wallet | Download |
|---|---|
| Eternl (empfohlen) | https://eternl.io |
| Nami | https://namiwallet.io |
| Lace | https://www.lace.io |

---

## Ersten L1 Ambassador erstellen

Damit das Referral-System funktioniert, braucht es mindestens einen **L1 Ambassador** — die erste Person in der Einladungskette.

1. Als Admin einloggen: `http://localhost:3000/login`
2. Dashboard → **"User Verwaltung"**
3. Gewünschten User suchen → **"L1 machen"** klicken
4. Das Backend erstellt automatisch:
   - On-Chain UTxO mit `inviter = None` (= Root)
   - DB-Eintrag als L1_AMBASSADOR
   - Einzigartigen Invite-Code (Format: `TC-XXXXXX`)
5. Der L1 Ambassador kann seinen Invite-Code teilen → neue User registrieren sich damit

---

## Umgebungsvariablen Referenz

| Variable | Pflicht | Beschreibung |
|---|---|---|
| `BLOCKFROST_API_KEY` | ja | API Key von blockfrost.io (Preprod) |
| `CARDANO_NETWORK` | ja | Immer `preprod` |
| `ADMIN_SEED_PHRASE` | ja | 24-Wörter Seed Phrase des Admin-Wallets |
| `ADMIN_ADDRESS` | ja | Bech32-Adresse des Admin-Wallets (`addr_test1...`) |
| `ADMIN_WALLET_PKH` | ja | Payment Key Hash (Hex) des Admin-Wallets |
| `DATABASE_URL` | ja | PostgreSQL Connection String |
| `JWT_SECRET` | ja | Geheimer Schlüssel für JWT Token (beliebig langer String) |
| `PORT` | ja | Backend Port (Standard: `3001`) |
| `FRONTEND_URL` | ja | URL des Frontends (Standard: `http://localhost:3000`) |
| `SEED_ADMIN_EMAIL` | nur Seed | E-Mail für seed-admin.ts Skript |
| `SEED_ADMIN_PASSWORD` | nur Seed | Passwort für seed-admin.ts Skript |
| `SEED_ADMIN_WALLET` | nur Seed | Wallet-Adresse für seed-admin.ts Skript |

---

## Technologie-Stack

| Schicht | Technologie | Warum |
|---|---|---|
| Smart Contracts | Aiken → Plutus V3 | Einzige produktionsreife Cardano-Sprache |
| Off-Chain SDK | Lucid Evolution | Battle-tested, Plutus V3, grosse Community |
| TX-Signing | CSL (Emurgo) | Direkte Kontrolle für Zahlungen |
| Provider | Blockfrost | Kein eigener Node nötig |
| Backend | Node.js + TypeScript | Selbe Sprache wie Frontend |
| Datenbank | PostgreSQL + Prisma | Typsichere Queries, relationale Daten |
| Auth | JWT + bcrypt | Stateless, sicher |
| Frontend | Next.js 14 + React | Industriestandard |
| Wallet | CIP-30 (Eternl/Nami/Lace) | Cardano Browser-Standard |
| Testnet | Cardano Preprod | Offizielle Testumgebung |

---

## Architektur

```
┌─────────────────────────────────────────────────────────┐
│  Frontend  (Next.js 14)                                 │
│  CIP-30 Wallet Connect  ·  Dashboard  ·  Reward History │
└────────────────────────┬────────────────────────────────┘
                         │ REST API (JWT)
┌────────────────────────▼────────────────────────────────┐
│  Backend  (Node.js + Express + TypeScript)              │
│  Auth  ·  Match-Events  ·  Rewards  ·  Admin            │
│                                                         │
│  ┌──────────────────┐    ┌──────────────────────────┐   │
│  │  PostgreSQL       │    │  Chain Layer             │   │
│  │  Users            │    │  Lucid Evolution         │   │
│  │  ReferralRelation │    │  CSL Signing             │   │
│  │  MatchEvents      │    │  Blockfrost Provider     │   │
│  └──────────────────┘    └────────────┬─────────────┘   │
└───────────────────────────────────────┼─────────────────┘
                                        │ Cardano TX
┌───────────────────────────────────────▼─────────────────┐
│  Cardano Preprod Testnet                                │
│                                                         │
│  identity_minting_policy  →  Identity NFTs              │
│  referral_registry        →  Referral UTxOs (Datum)     │
│  reward_distributor       →  Reward Verifikation        │
└─────────────────────────────────────────────────────────┘
```

**On-Chain** (Blockchain): Identity NFTs, Referral-Beziehungen als UTxOs, Reward-Transaktionen

**Off-Chain** (Backend + DB): User-Daten, Matching-Logik, Reward-Berechnung, Ketten-Traversal

---

## Häufige Fehler

**`ADMIN_SEED_PHRASE nicht in .env gesetzt`**
→ `.env` Datei fehlt oder Seed Phrase nicht eingetragen. Schritt 5 wiederholen.

**`Keine UTxOs gefunden`**
→ Das Admin-Wallet hat kein tADA. Faucet nutzen: https://docs.cardano.org/cardano-testnets/tools/faucet

**`TX nach 120s noch nicht bestätigt`**
→ Preprod Testnet kann langsam sein. Warten und erneut versuchen. TX-Hash auf https://preprod.cardanoscan.io prüfen.

**`identity_minting_policy nicht gefunden`**
→ `contracts/plutus.json` fehlt oder ist leer. Contracts neu bauen: `cd contracts && aiken build`

**`Prisma: Table does not exist`**
→ Migration nicht ausgeführt. `npx prisma migrate deploy` im `backend/` Ordner ausführen.

**`HTTP 400: Wallet hat bereits einen Identity NFT`**
→ Diese Wallet ist bereits registriert. Andere Wallet-Adresse für den Test verwenden.

**`Blockfrost: 403 Forbidden`**
→ API Key falsch oder falsches Netzwerk. Key muss für **Preprod** sein, nicht Mainnet.

---

## Nützliche Links

| Ressource | URL |
|---|---|
| Preprod Explorer | https://preprod.cardanoscan.io |
| Preprod Faucet | https://docs.cardano.org/cardano-testnets/tools/faucet |
| Blockfrost Dashboard | https://blockfrost.io/dashboard |
| Eternl Wallet | https://eternl.io |
| Aiken Docs | https://aiken-lang.org |
| Lucid Evolution | https://github.com/Anastasia-Labs/lucid-evolution |

---

*TalentChain v1.0 · Cardano Preprod Testnet · Mai 2026*
