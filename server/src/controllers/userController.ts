import type { Request, Response } from 'express';
import db from '../database/db';

function getAnalysts(_req: Request, res: Response) {
  const analysts = db.prepare("SELECT id, name, email FROM users WHERE role = 'analyst' ORDER BY name").all();
  return res.json(analysts);
}

export { getAnalysts };
