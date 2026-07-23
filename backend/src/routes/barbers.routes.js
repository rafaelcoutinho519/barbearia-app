import { Router } from 'express';
import { db } from '../db.js';

const router = Router();

// Público: lista de barbeiros disponíveis para agendamento
router.get('/', (req, res) => {
  const barbers = db
    .prepare(`SELECT id, name, email, phone FROM users WHERE role IN ('barber','admin') ORDER BY name`)
    .all();
  res.json({ barbers });
});

export default router;
