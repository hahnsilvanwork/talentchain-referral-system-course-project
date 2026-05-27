import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface AuthRequest extends Request {
  userId?: string;
  userRole?: string;
}

/**
 * Prüft ob ein gültiger JWT-Token im Authorization Header vorhanden ist.
 * Setzt req.userId und req.userRole für nachfolgende Handler.
 */
export function authMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  const token = req.headers.authorization?.replace("Bearer ", "");

  if (!token) {
    res.status(401).json({ error: "Kein Token" });
    return;
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "secret") as {
      userId: string;
      role: string;
    };
    req.userId = decoded.userId;
    req.userRole = decoded.role;
    next();
  } catch {
    res.status(401).json({ error: "Ungültiger Token" });
  }
}

/**
 * Prüft ob der eingeloggte User die ADMIN-Rolle hat.
 * Muss NACH authMiddleware eingesetzt werden.
 */
export function adminMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  if (req.userRole !== "ADMIN") {
    res.status(403).json({ error: "Keine Admin-Berechtigung" });
    return;
  }
  next();
}