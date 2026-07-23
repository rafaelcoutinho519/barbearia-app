import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

// Público: lista de serviços ativos (para a página de agendamento)
router.get('/', (req, res) => {
  const services = db.prepare('SELECT * FROM services WHERE active = 1 ORDER BY name').all();
  res.json({ services });
});

// Barbeiro/admin: lista completa, incluindo inativos
router.get('/all', requireAuth, requireRole('barber', 'admin'), (req, res) => {
  const services = db.prepare('SELECT * FROM services ORDER BY name').all();
  res.json({ services });
});

router.post('/', requireAuth, requireRole('barber', 'admin'), (req, res) => {
  const { name, description, price, duration_minutes } = req.body;
  if (!name || price == null || !duration_minutes) {
    return res.status(400).json({ error: 'Nome, preço e duração são obrigatórios.' });
  }
  const info = db
    .prepare('INSERT INTO services (name, description, price, duration_minutes) VALUES (?, ?, ?, ?)')
    .run(name, description || '', price, duration_minutes);
  const service = db.prepare('SELECT * FROM services WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ service });
});

router.put('/:id', requireAuth, requireRole('barber', 'admin'), (req, res) => {
  const { id } = req.params;
  const existing = db.prepare('SELECT * FROM services WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Serviço não encontrado.' });

  const {
    name = existing.name,
    description = existing.description,
    price = existing.price,
    duration_minutes = existing.duration_minutes,
    active = existing.active,
  } = req.body;

  db.prepare(
    'UPDATE services SET name = ?, description = ?, price = ?, duration_minutes = ?, active = ? WHERE id = ?'
  ).run(name, description, price, duration_minutes, active ? 1 : 0, id);

  const service = db.prepare('SELECT * FROM services WHERE id = ?').get(id);
  res.json({ service });
});

router.delete('/:id', requireAuth, requireRole('barber', 'admin'), (req, res) => {
  const { id } = req.params;
  // Em vez de apagar (poderia quebrar agendamentos antigos), apenas desativa
  const existing = db.prepare('SELECT * FROM services WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Serviço não encontrado.' });
  db.prepare('UPDATE services SET active = 0 WHERE id = ?').run(id);
  res.json({ success: true });
});

export default router;
