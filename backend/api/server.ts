import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import authRoutes from "./routes/auth";
import matchRoutes from "./routes/match";
import rewardRoutes from "./routes/rewards";
import adminRoutes from "./routes/admin";
import referralRoutes from "./routes/referral";
import { authMiddleware, adminMiddleware } from "./middleware/auth";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", network: process.env.CARDANO_NETWORK });
});

// Public routes — kein Token nötig
app.use("/api/auth", authRoutes);

// User routes — Token nötig
app.use("/api/match", authMiddleware, matchRoutes);
app.use("/api/rewards", authMiddleware, rewardRoutes);
app.use("/api/referral", authMiddleware, referralRoutes);

// Admin routes — Token + ADMIN Rolle nötig
app.use("/api/admin", authMiddleware, adminMiddleware, adminRoutes);

app.listen(PORT, () => {
  console.log(`TalentChain Backend läuft auf Port ${PORT}`);
});

export default app;