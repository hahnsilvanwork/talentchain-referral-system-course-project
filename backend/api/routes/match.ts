import { Router, Request, Response } from "express";
import prisma from "../../prisma/client";
import { calculateFees, calculateRewards } from "../../chain/referral-traversal";

const router = Router();

// POST /api/match/calculate
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

// POST /api/match/create
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

    res.json({ matchEvent, fees, message: "Match-Event erstellt" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server Fehler" });
  }
});

// GET /api/match/events
router.get("/events", async (req: Request, res: Response) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    let userId: string | null = null;
    let userRole: string = "USER";

    if (token) {
      try {
        const jwt = await import("jsonwebtoken");
        const decoded = jwt.default.verify(
          token,
          process.env.JWT_SECRET || "secret"
        ) as { userId: string; role: string };
        userId = decoded.userId;
        userRole = decoded.role;
      } catch {}
    }

    const events = await prisma.matchEvent.findMany({
      where: userRole === "ADMIN" ? {} : { talentId: userId || "" },
      include: { talent: { select: { email: true, walletAddress: true } } },
      orderBy: { createdAt: "desc" },
    });

    res.json(events);
  } catch (error) {
    res.status(500).json({ error: "Server Fehler" });
  }
});

// POST /api/match/cancel/:id
router.post("/cancel/:id", async (req: Request, res: Response) => {
  try {
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