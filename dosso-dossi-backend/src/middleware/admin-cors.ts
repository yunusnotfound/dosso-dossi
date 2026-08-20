import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env.js';

/// Yalnızca panel origin'lerine açılan dar CORS. Mobil uygulama tarayıcı
/// olmadığı için CORS'a ihtiyaç duymaz; bu yüzden kapsam /admin ile sınırlı.
/// Allowlist dışındaki origin'e CORS başlığı hiç yazılmaz — tarayıcı engeller.
export function adminCors(req: Request, res: Response, next: NextFunction): void {
  const origin = req.headers.origin;
  if (origin && env.ADMIN_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    // Allowlist'e göre değiştiği için ara katman önbellekleri şaşmasın.
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Max-Age', '600');
  }
  if (req.method === 'OPTIONS') {
    // Preflight: allowlist dışıysa da 204 döneriz ama izin başlığı yoktur.
    res.status(204).end();
    return;
  }
  next();
}
