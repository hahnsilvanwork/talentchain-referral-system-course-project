import { Router, Request, Response } from "express";
import prisma from "../../prisma/client";
import { calculateFees, calculateRewards } from "../../chain/referral-traversal";

const router = Router();

// POST /api/match/calculate — Vorschau berechnen ohne zu deployen
router.post("/calculate", async (req: Request, res: Response) => {
  try {
    const { talentId, annualSalary, scenario } = req.body;

    if (!talentId || !annualSalary || !scenario) {
      res.status(400).json({ error: "talentId, annualSalary, scenario erforderlich" });
      return;
    }

    // User prüfen
    const talent = await prisma.user.findUnique({ where: { id: talentId } });
    if (!talent) {
      res.status(404).json({ error: "Talent nicht gefunden" });
      return;
    }

    // Gebühren berechnen
    const fees = calculateFees(annualSalary, scenario);

    // Mock Referral-Kette (3 Layer) — später durch echte Chain-Traversal ersetzen
    const mockChain = [
      { walletPkh: talent.walletPkh, inviterPkh: null, layer: 0 },
    ];

    const rewards = calculateRewards(fees.referrerPool, mockChain);

    res.json({
      talent: { id: talent.id, walletPkh: talent.walletPkh },
      fees,
      rewards,
      summary: {
        totalFee: fees.totalFee,
        referrerPool: fees.referrerPool,
        platformAmount: fees.platformAmount,
        institutionAmount: fees.institutionAmount,
        talentAmount: fees.talentAmount,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server Fehler" });
  }
});

// POST /api/match/create — Match-Event erstellen
router.post("/create", async (req: Request, res: Response) => {
  try {
    const { talentId, annualSalary, scenario } = req.body;

    const talent = await prisma.user.findUnique({ where: { id: talentId } });
    if (!talent) {
      res.status(404).json({ error: "Talent nicht gefunden" });
      return;
    }

    const fees = calculateFees(annualSalary, scenario);

    const matchEvent = await prisma.matchEvent.create({
      data: {
        talentId,
        annualSalary,
        scenario,
        totalFee: fees.totalFee,
        referrerPool: fees.referrerPool,
        institutionAmount: fees.institutionAmount,
        talentAmount: fees.talentAmount,
        platformAmount: fees.platformAmount,
        status: "PENDING",
      },
    });

    res.json({
      matchEvent,
      fees,
      message: "Match-Event erstellt — bereit für Reward-Verteilung",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server Fehler" });
  }
});

// GET /api/match/events — Alle Match-Events abrufen
router.get("/events", async (_req: Request, res: Response) => {
  try {
    const events = await prisma.matchEvent.findMany({
      include: { talent: { select: { email: true, walletAddress: true } } },
      orderBy: { createdAt: "desc" },
    });
    res.json(events);
  } catch (error) {
    res.status(500).json({ error: "Server Fehler" });
  }
});

export default router;