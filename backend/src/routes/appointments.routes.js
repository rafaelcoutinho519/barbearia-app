import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

function toMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function toHHMM(mins) {
  const h = Math.floor(mins / 60)
    .toString()
    .padStart(2, '0');
  const m = (mins % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

// Retorna os horários fixos permitidos de acordo com o dia da semana
function getFixedSlotsForDate(dateString) {
  // Converte a data YYYY-MM-DD para verificar o dia da semana
  const weekday = new Date(`${dateString}T12:00:00`).getDay(); // 0 = Domingo, 1 = Segunda, ..., 6 = Sábado

  // Domingo (0): Fechado
  if (weekday === 0) {
    return [];
  }

  // Segunda-feira (1): Apenas à tarde
  if (weekday === 1) {
    return ['13:00', '13:40', '14:20', '15:00', '15:40'];
  }

  // Terça a Sábado (2 a 6)
  return [
    '08:00', '08:40', '09:20', 
    '10:40', '11:20', '12:00', '12:40', 
    '13:20', '14:00', '14:40', '15:20', 
    '16:00', '16:40', '17:20'
  ];
}

// Retorna horários livres para um barbeiro, data e serviço específicos
router.get('/available', (req, res) => {
  const { barberId, date, serviceId } = req.query;
  if (!barberId || !date || !serviceId) {
    return res.status(400).json({ error: 'barberId, date e serviceId são obrigatórios.' });
  }

  const service = db.prepare('SELECT * FROM services WHERE id = ?').get(serviceId);
  if (!service) return res.status(404).json({ error: 'Serviço não encontrado.' });

  // Pega a lista de horários fixos permitidos para aquele dia da semana
  const baseSlots = getFixedSlotsForDate(date);

  if (baseSlots.length === 0) {
    return res.json({ slots: [], duration_minutes: service.duration_minutes });
  }

  // Busca agendamentos ativos já existentes para o mesmo dia e barbeiro
  const existing = db
    .prepare(
      `SELECT start_time, end_time FROM appointments
       WHERE barber_id = ? AND date = ? AND status != 'cancelado'`
    )
    .all(barberId, date);

  const duration = service.duration_minutes;

  // Filtra removendo os horários que entram em conflito com agendamentos existentes
  const availableSlots = baseSlots.filter((slotTime) => {
    const start = toMinutes(slotTime);
    const end = start + duration;

    const overlaps = existing.some((appt) => {
      const apptStart = toMinutes(appt.start_time);
      const apptEnd = toMinutes(appt.end_time);
      return start < apptEnd && end > apptStart;
    });

    return !overlaps;
  });

  res.json({ slots: availableSlots, duration_minutes: duration });
});

// Cliente autenticado cria um agendamento
router.post('/', requireAuth, requireRole('client'), (req, res) => {
  const { barberId, serviceId, date, startTime } = req.body;
  if (!barberId || !serviceId || !date || !startTime) {
    return res.status(400).json({ error: 'Dados incompletos para o agendamento.' });
  }

  const service = db.prepare('SELECT * FROM services WHERE id = ?').get(serviceId);
  if (!service) return res.status(404).json({ error: 'Serviço não encontrado.' });

  const barber = db.prepare(`SELECT * FROM users WHERE id = ? AND role IN ('barber','admin')`).get(barberId);
  if (!barber) return res.status(404).json({ error: 'Barbeiro não encontrado.' });

  // Valida se o horário escolhido faz parte das opções válidas para o dia
  const validSlots = getFixedSlotsForDate(date);
  if (!validSlots.includes(startTime)) {
    return res.status(400).json({ error: 'Horário selecionado não é válido para este dia.' });
  }

  const startMin = toMinutes(startTime);
  const endMin = startMin + service.duration_minutes;

  const conflict = db
    .prepare(
      `SELECT id FROM appointments WHERE barber_id = ? AND date = ? AND status != 'cancelado'
       AND NOT (end_time <= ? OR start_time >= ?)`
    )
    .get(barberId, date, startTime, toHHMM(endMin));
  if (conflict) {
    return res.status(409).json({ error: 'Este horário acabou de ser reservado. Escolha outro.' });
  }

  const info = db
    .prepare(
      `INSERT INTO appointments (client_id, barber_id, service_id, date, start_time, end_time, status)
       VALUES (?, ?, ?, ?, ?, ?, 'agendado')`
    )
    .run(req.user.id, barberId, serviceId, date, startTime, toHHMM(endMin));

  const appointment = getFullAppointment(info.lastInsertRowid);
  res.status(201).json({ appointment });
});

// Cliente vê os próprios agendamentos
router.get('/me', requireAuth, requireRole('client'), (req, res) => {
  const rows = db
    .prepare(
      `SELECT a.*, s.name AS service_name, s.price, b.name AS barber_name
       FROM appointments a
       JOIN services s ON s.id = a.service_id
       JOIN users b ON b.id = a.barber_id
       WHERE a.client_id = ?
       ORDER BY a.date DESC, a.start_time DESC`
    )
    .all(req.user.id);
  res.json({ appointments: rows });
});

// Cliente cancela o próprio agendamento
router.delete('/:id', requireAuth, requireRole('client'), (req, res) => {
  const { id } = req.params;
  const appt = db.prepare('SELECT * FROM appointments WHERE id = ?').get(id);
  if (!appt || appt.client_id !== req.user.id) {
    return res.status(404).json({ error: 'Agendamento não encontrado.' });
  }
  db.prepare(`UPDATE appointments SET status = 'cancelado' WHERE id = ?`).run(id);
  res.json({ success: true });
});

// Barbeiro/admin vê a agenda de um dia (ou todos os dias futuros se sem data)
router.get('/agenda', requireAuth, requireRole('barber', 'admin'), (req, res) => {
  const { date } = req.query;
  let rows;
  if (date) {
    rows = db
      .prepare(
        `SELECT a.*, s.name AS service_name, s.price, c.name AS client_name, c.phone AS client_phone
         FROM appointments a
         JOIN services s ON s.id = a.service_id
         JOIN users c ON c.id = a.client_id
         WHERE a.barber_id = ? AND a.date = ?
         ORDER BY a.start_time`
      )
      .all(req.user.id, date);
  } else {
    rows = db
      .prepare(
        `SELECT a.*, s.name AS service_name, s.price, c.name AS client_name, c.phone AS client_phone
         FROM appointments a
         JOIN services s ON s.id = a.service_id
         JOIN users c ON c.id = a.client_id
         WHERE a.barber_id = ? AND a.date >= date('now')
         ORDER BY a.date, a.start_time`
      )
      .all(req.user.id);
  }
  res.json({ appointments: rows });
});

// Barbeiro atualiza status (concluído/cancelado)
router.put('/:id/status', requireAuth, requireRole('barber', 'admin'), (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  if (!['agendado', 'concluido', 'cancelado'].includes(status)) {
    return res.status(400).json({ error: 'Status inválido.' });
  }
  const appt = db.prepare('SELECT * FROM appointments WHERE id = ?').get(id);
  if (!appt || appt.barber_id !== req.user.id) {
    return res.status(404).json({ error: 'Agendamento não encontrado.' });
  }
  db.prepare('UPDATE appointments SET status = ? WHERE id = ?').run(status, id);
  res.json({ success: true });
});

function getFullAppointment(id) {
  return db
    .prepare(
      `SELECT a.*, s.name AS service_name, s.price, b.name AS barber_name
       FROM appointments a
       JOIN services s ON s.id = a.service_id
       JOIN users b ON b.id = a.barber_id
       WHERE a.id = ?`
    )
    .get(id);
}

export default router;
