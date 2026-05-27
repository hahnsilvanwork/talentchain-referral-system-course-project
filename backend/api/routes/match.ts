import { Router, Request, Response } from "express";
import prisma from "../../prisma/client";
import { calculateFees, calculateRewards } from "../../chain/referral-traversal";
import { AuthRequest } from "../middleware/auth";

const router = Router();

// POST /api/match/calculate — alle eingeloggten User
router.post("/calculate", async (req: Request, res: Response) => {
  try {
    const { talentId, annualSalary, scenario } = req.body;

    if (!talentId || !annualSalary || !scenario) {
      res.status(400).json({ error: "talentId, annualSalary, scenario erforderlich" });
      return;
    }

    const talent = await prisma.user.findUnique({ where: { id: talentId } });
    if (!talent) {
      res.status(404).json({ error: "Talent nicht gefunden" });
      return;
    }

    const fees = calculateFees(annualSalary, scenario);
    const mockChain = [{ walletPkh: talent.walletPkh, inviterPkh: null, layer: 0 }];
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

// POST /api/match/create — nur ADMIN
router.post("/create", async (req: AuthRequest, res: Response) => {
  try {
    // Rollenprüfung — nur ADMIN darf Events erstellen
    if (req.userRole !== "ADMIN") {
      res.status(403).json({ error: "Nur Admins können Match-Events erstellen" });
      return;
    }

    const { talentId, annualSalary, scenario } = req.body;

    if (!talentId || !annualSalary || !scenario) {
      res.status(400).json({ error: "talentId, annualSalary, scenario erforderlich" });
      return;
    }

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

    res.json({ matchEvent, fees, message: "Match-Event erstellt" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server Fehler" });
  }
});

// GET /api/match/events — alle eingeloggten User (gefiltert nach Rolle)
router.get("/events", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId || "";
    const userRole = req.userRole || "USER";

    const events = await prisma.matchEvent.findMany({
      where: userRole === "ADMIN" ? {} : { talentId: userId },
      include: { talent: { select: { email: true, walletAddress: true } } },
      orderBy: { createdAt: "desc" },
    });

    res.json(events);
  } catch (error) {
    res.status(500).json({ error: "Server Fehler" });
  }
});

// POST /api/match/cancel/:id — nur ADMIN
router.post("/cancel/:id", async (req: AuthRequest, res: Response) => {
  try {
    if (req.userRole !== "ADMIN") {
      res.status(403).json({ error: "Nur Admins können Events stornieren" });
      return;
    }

    const id = req.params["id"] as string;
    const event = await prisma.matchEvent.findUnique({ where: { id } });

    if (!event) {
      res.status(404).json({ error: "Match-Event nicht gefunden" });
      return;
    }
    if (event.status !== "PENDING") {
      res.status(400).json({ error: "Nur PENDING Events können storniert werden" });
      return;
    }

    await prisma.matchEvent.update({
      where: { id },
      data: { status: "CANCELLED" },
    });

    res.json({ success: true, message: "Match-Event storniert" });
  } catch (error) {
    res.status(500).json({ error: "Server Fehler" });
  }
});

export default router;