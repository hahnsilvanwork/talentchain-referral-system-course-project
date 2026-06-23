# TalentChain

**Decentralized Recruiting Platform on the Cardano Blockchain**

TalentChain connects real recruiting events (job changes, contract signings) with smart contracts. Rewards are distributed automatically and tamper-proof to all members of the invitation chain.

**Core Principle: Compute Off-Chain — Verify On-Chain.**

> This project runs on the **Cardano Preprod Testnet**. No real money is involved.

---

## Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Project Structure](#project-structure)
- [Setup — Step by Step](#setup--step-by-step)
  - [1. Clone the Repository](#1-clone-the-repository)
  - [2. Install Dependencies](#2-install-dependencies)
  - [3. Set Up the Cardano Wallet](#3-set-up-the-cardano-wallet)
  - [4. Get a Blockfrost API Key](#4-get-a-blockfrost-api-key)
  - [5. Configure Environment Variables](#5-configure-environment-variables)
  - [6. Set Up the Database](#6-set-up-the-database)
  - [7. Create the Admin Account](#7-create-the-admin-account)
  - [8. Deploy Smart Contracts](#8-deploy-smart-contracts)
  - [9. Start the Backend](#9-start-the-backend)
  - [10. Start the Frontend](#10-start-the-frontend)
- [Set Up a Browser Wallet](#set-up-a-browser-wallet)
- [Create the First L1 Ambassador](#create-the-first-l1-ambassador)
- [Environment Variables Reference](#environment-variables-reference)
- [Technology Stack](#technology-stack)
- [Architecture](#architecture)
- [Common Errors](#common-errors)

---

## Overview

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 + React + Framer Motion |
| Backend | Node.js + Express + TypeScript |
| Database | PostgreSQL + Prisma |
| Blockchain | Cardano Preprod Testnet |
| Smart Contracts | Aiken → Plutus V3 |
| Off-Chain SDK | Lucid Evolution |
| TX Signing | Cardano Serialization Library (CSL) |
| Provider | Blockfrost (no own node required) |
| Auth | JWT + bcrypt |

---

## Prerequisites

The following tools must be installed:

| Tool | Version | Download |
|---|---|---|
| Node.js | ≥ 18 | https://nodejs.org |
| npm | ≥ 9 | comes with Node.js |
| PostgreSQL | ≥ 14 | https://www.postgresql.org/download |
| Git | current | https://git-scm.com |

Also required:

- **Blockfrost Account** (free) → https://blockfrost.io
- **Eternl Wallet** Browser Extension (Chrome/Brave) → https://eternl.io
- **tADA** (Test-ADA) for the admin wallet → Cardano Preprod Faucet

---

## Project Structure

```
talentchain/
├── backend/
│   ├── api/
│   │   ├── middleware/
│   │   │   └── auth.ts          # JWT + Admin Middleware
│   │   └── routes/
│   │       ├── auth.ts          # Register / Login
│   │       ├── admin.ts         # User management, L1, Blacklist
│   │       ├── match.ts         # Match events
│   │       ├── rewards.ts       # Reward distribution
│   │       └── referral.ts      # Referral chain
│   ├── chain/
│   │   ├── blockfrost.ts        # Blockfrost Provider
│   │   ├── cardano-tx.ts        # TX construction via CSL
│   │   ├── chain-utils.ts       # Invite codes, cascade removal
│   │   ├── datum-decoder.ts     # CBOR datum decoding
│   │   ├── mint-nft.ts          # Identity NFT minting (Lucid)
│   │   ├── referral-chain.ts    # On-chain traversal, UTxO creation
│   │   ├── referral-traversal.ts # Reward calculation
│   │   ├── registration-bonus.ts # Registration bonus (CHF 60)
│   │   ├── send-rewards.ts      # Send reward TX
│   │   ├── tx-signer.ts         # CSL signing helper
│   │   └── wallet.ts            # Admin wallet from seed phrase
│   ├── prisma/
│   │   ├── schema.prisma        # Database schema
│   │   └── client.ts            # Prisma client
│   ├── scripts/
│   │   ├── seed-admin.ts        # Create admin account
│   │   └── assign-invite-codes.ts # Migration: assign invite codes
│   └── server.ts                # Express app entry point
├── contracts/
│   └── plutus.json              # Compiled Aiken smart contracts
├── frontend/
│   ├── app/
│   │   ├── dashboard/           # Dashboard pages
│   │   ├── login/               # Login page
│   │   └── page.tsx             # Landing page
│   ├── components/
│   │   ├── dashboard/           # Dashboard components
│   │   └── ui/                  # Reusable UI components
│   └── lib/
│       ├── api.ts               # API client
│       └── scenarios.ts         # Scenarios & fee calculation
└── README.md
```

---

## Setup — Step by Step

### 1. Clone the Repository

```bash
git clone <repository-url>
cd talentchain
```

---

### 2. Install Dependencies

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

### 3. Set Up the Cardano Wallet

The backend requires an **admin wallet** with a seed phrase. This wallet signs all blockchain transactions (NFT minting, referral UTxOs, reward payments).

#### Option A — Create a New Wallet in Eternl (recommended)

1. Install the Eternl browser extension: https://eternl.io
2. Open Eternl → **"Add Wallet"** → **"Create new wallet"**
3. Safely record the seed phrase (24 words) — this goes into your `.env`
4. In the wallet: click the network icon (top right) → select **"Preprod"**
5. Copy your wallet address (starts with `addr_test1...`)

#### Get tADA (Test-ADA for transaction fees)

The admin wallet needs tADA to pay for fees. At least **10 tADA** is recommended.

1. Open the Cardano Preprod Faucet: https://docs.cardano.org/cardano-testnets/tools/faucet
2. Select network **"Preprod"**
3. Paste your wallet address → click **"Request funds"**
4. The tADA will appear in your wallet after about 1–2 minutes

#### Determine the Payment Key Hash (PKH)

The PKH is required for the smart contracts. Run this after completing steps 5–6:

```bash
cd backend
npx ts-node chain/get-pkh.ts
```

Or via the API while the backend is running:
```bash
curl -X POST http://localhost:3001/api/admin/pkh \
  -H "Content-Type: application/json" \
  -d '{"address": "addr_test1..."}'
```

---

### 4. Get a Blockfrost API Key

Blockfrost replaces the need for your own Cardano node and is free to use.

1. Create an account: https://blockfrost.io
2. Dashboard → **"+ Add new project"**
3. Name: `TalentChain`, Network: **`Cardano Preprod`** → **"Save"**
4. Copy the generated API key (starts with `preprod...`)

---

### 5. Configure Environment Variables

Create a `.env` file in the `backend/` folder:

```bash
cd backend
cp .env.example .env   # if it exists, otherwise create a new one
```

`.env` contents — all values must be filled in:

```env
# ── Blockfrost ──────────────────────────────────────────────────────
BLOCKFROST_API_KEY=preprod...          # From step 4

# ── Cardano ─────────────────────────────────────────────────────────
CARDANO_NETWORK=preprod

# ── Admin Wallet ────────────────────────────────────────────────────
ADMIN_SEED_PHRASE=word1 word2 word3 ... word24   # 24-word seed phrase
ADMIN_ADDRESS=addr_test1...                       # Wallet address
ADMIN_WALLET_PKH=561fe5dc...                      # Payment Key Hash (hex)

# ── Database ────────────────────────────────────────────────────────
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/talentchain"

# ── Auth ────────────────────────────────────────────────────────────
JWT_SECRET=enter_a_long_random_secret_here

# ── Server ──────────────────────────────────────────────────────────
PORT=3001
FRONTEND_URL=http://localhost:3000

# ── Admin Seed (for seed-admin.ts script) ───────────────────────────
SEED_ADMIN_EMAIL=admin@talentchain.ch
SEED_ADMIN_PASSWORD=securepassword
SEED_ADMIN_WALLET=addr_test1...        # Same address as ADMIN_ADDRESS
```

> **Important:** Never commit the `.env` file to Git. It contains the seed phrase — anyone who knows the seed phrase controls the admin wallet.

---

### 6. Set Up the Database

PostgreSQL must be running. Create the database and run migrations:

```bash
# Create database (if it doesn't exist)
createdb talentchain

# Run schema migration
cd backend
npx prisma migrate deploy

# Generate Prisma client
npx prisma generate
```

Verify the database (optional):
```bash
npx prisma studio
# Opens browser UI at http://localhost:5555
```

---

### 7. Create the Admin Account

The seed script creates the first admin user in the database. Values are taken from your `.env` (`SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, `SEED_ADMIN_WALLET`).

```bash
cd backend
npx ts-node scripts/seed-admin.ts
```

Expected output:
```
TalentChain — Admin Seed Script
─────────────────────────────────
✓ New admin created: admin@talentchain.ch

  Email:    admin@talentchain.ch
  Password: securepassword
  Wallet:   addr_test1qptplew...

→ Log in at http://localhost:3000/login
```

---

### 8. Deploy Smart Contracts

The compiled contracts are located in `contracts/plutus.json`. Before the first start, verify the file exists:

```bash
ls contracts/plutus.json
```

If the contracts need to be recompiled (requires [Aiken](https://aiken-lang.org/installation-instructions)):

```bash
cd contracts
aiken build
# Generates plutus.json
```

Check contract addresses (after the backend has started):
```bash
curl http://localhost:3001/api/admin/referral-script-address \
  -H "Authorization: Bearer <admin-token>"
```

---

### 9. Start the Backend

```bash
cd backend
npm run dev
```

Backend runs at: `http://localhost:3001`

Health check:
```bash
curl http://localhost:3001/health
# {"status":"ok","network":"preprod"}
```

---

### 10. Start the Frontend

```bash
cd frontend
npm run dev
```

Frontend runs at: `http://localhost:3000`

---

## Set Up a Browser Wallet

For the **frontend** (connecting a wallet on the landing page), each user needs a browser wallet on the Preprod Testnet.

1. Install **Eternl**: https://eternl.io
2. Open Eternl → create a new wallet or import an existing seed phrase
3. Switch network: Settings → **"Preprod Testnet"**
4. Get tADA: https://docs.cardano.org/cardano-testnets/tools/faucet
5. Go to `http://localhost:3000` → click **"Connect Wallet"**

Supported wallets:

| Wallet | Download |
|---|---|
| Eternl (recommended) | https://eternl.io |
| Nami | https://namiwallet.io |
| Lace | https://www.lace.io |

---

## Create the First L1 Ambassador

For the referral system to work, at least one **L1 Ambassador** is needed — the first person in the invitation chain.

1. Log in as admin: `http://localhost:3000/login`
2. Dashboard → **"User Management"**
3. Find the desired user → click **"Make L1"**
4. The backend automatically creates:
   - An on-chain UTxO with `inviter = None` (= Root)
   - A DB entry as `L1_AMBASSADOR`
   - A unique invite code (format: `TC-XXXXXX`)
5. The L1 Ambassador can share their invite code → new users register with it

---

## Environment Variables Reference

| Variable | Required | Description |
|---|---|---|
| `BLOCKFROST_API_KEY` | yes | API key from blockfrost.io (Preprod) |
| `CARDANO_NETWORK` | yes | Always `preprod` |
| `ADMIN_SEED_PHRASE` | yes | 24-word seed phrase of the admin wallet |
| `ADMIN_ADDRESS` | yes | Bech32 address of the admin wallet (`addr_test1...`) |
| `ADMIN_WALLET_PKH` | yes | Payment Key Hash (hex) of the admin wallet |
| `DATABASE_URL` | yes | PostgreSQL connection string |
| `JWT_SECRET` | yes | Secret key for JWT tokens (any long string) |
| `PORT` | yes | Backend port (default: `3001`) |
| `FRONTEND_URL` | yes | Frontend URL (default: `http://localhost:3000`) |
| `SEED_ADMIN_EMAIL` | seed only | Email for the seed-admin.ts script |
| `SEED_ADMIN_PASSWORD` | seed only | Password for the seed-admin.ts script |
| `SEED_ADMIN_WALLET` | seed only | Wallet address for the seed-admin.ts script |

---

## Technology Stack

| Layer | Technology | Why |
|---|---|---|
| Smart Contracts | Aiken → Plutus V3 | The only production-ready Cardano language |
| Off-Chain SDK | Lucid Evolution | Battle-tested, Plutus V3, large community |
| TX Signing | CSL (Emurgo) | Direct control for payments |
| Provider | Blockfrost | No own node required |
| Backend | Node.js + TypeScript | Same language as frontend |
| Database | PostgreSQL + Prisma | Type-safe queries, relational data |
| Auth | JWT + bcrypt | Stateless, secure |
| Frontend | Next.js 14 + React | Industry standard |
| Wallet | CIP-30 (Eternl/Nami/Lace) | Cardano browser standard |
| Testnet | Cardano Preprod | Official test environment |

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Frontend  (Next.js 14)                                 │
│  CIP-30 Wallet Connect  ·  Dashboard  ·  Reward History │
└────────────────────────┬────────────────────────────────┘
                         │ REST API (JWT)
┌────────────────────────▼────────────────────────────────┐
│  Backend  (Node.js + Express + TypeScript)              │
│  Auth  ·  Match Events  ·  Rewards  ·  Admin            │
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
│  reward_distributor       →  Reward Verification        │
└─────────────────────────────────────────────────────────┘
```

**On-Chain** (Blockchain): Identity NFTs, referral relationships as UTxOs, reward transactions

**Off-Chain** (Backend + DB): User data, matching logic, reward calculation, chain traversal

---

## Common Errors

**`ADMIN_SEED_PHRASE not set in .env`**
→ The `.env` file is missing or the seed phrase hasn't been entered. Repeat step 5.

**`No UTxOs found`**
→ The admin wallet has no tADA. Use the faucet: https://docs.cardano.org/cardano-testnets/tools/faucet

**`TX not confirmed after 120s`**
→ The Preprod Testnet can be slow. Wait and try again. Check the TX hash at https://preprod.cardanoscan.io.

**`identity_minting_policy not found`**
→ `contracts/plutus.json` is missing or empty. Rebuild contracts: `cd contracts && aiken build`

**`Prisma: Table does not exist`**
→ Migration not executed. Run `npx prisma migrate deploy` in the `backend/` folder.

**`HTTP 400: Wallet already has an Identity NFT`**
→ This wallet is already registered. Use a different wallet address for testing.

**`Blockfrost: 403 Forbidden`**
→ API key is wrong or using the wrong network. The key must be for **Preprod**, not Mainnet.

---

## Useful Links

| Resource | URL |
|---|---|
| Preprod Explorer | https://preprod.cardanoscan.io |
| Preprod Faucet | https://docs.cardano.org/cardano-testnets/tools/faucet |
| Blockfrost Dashboard | https://blockfrost.io/dashboard |
| Eternl Wallet | https://eternl.io |
| Aiken Docs | https://aiken-lang.org |
| Lucid Evolution | https://github.com/Anastasia-Labs/lucid-evolution |

---

*TalentChain v1.0 · Cardano Preprod Testnet · May 2026*
