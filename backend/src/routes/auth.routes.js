import { Router } from 'express';
import { db } from '../db.js';
import { generateToken, requireAuth } from '../middleware/auth.js';

const router = Router();

// Cadastro público — cria clientes apenas com Nome e Telefone
router.post('/register', (req, res) => {
  const { name, phone } = req.body;

  if (!name || !phone) {
    return res.status(400).json({ error: 'Nome e telefone são obrigatórios.' });
  }

  // Verifica se o telefone já está cadastrado
  const existing = db.prepare('SELECT id FROM users WHERE phone = ?').get(phone);
  if (existing) {
    return res.status(409).json({ error: 'Já existe uma conta cadastrada com este telefone.' });
  }

  // Insere o cliente na tabela (email e password_hash ficam como texto vazio ou nulo)
  const info = db
    .prepare('INSERT INTO users (name, email, phone, password_hash, role) VALUES (?, ?, ?, ?, ?)')
    .run(name, '', phone, '', 'client');

  const user = db.prepare('SELECT id, name, email, phone, role FROM users WHERE id = ?').get(info.lastInsertRowid);
  const token = generateToken(user);
  res.status(201).json({ user, token });
});

// Login do cliente — autentica apenas pelo número de telefone
router.post('/login', (req, res) => {
  const { phone } = req.body;

  if (!phone) {
    return res.status(400).json({ error: 'O número de telefone é obrigatório.' });
  }

  const user = db.prepare('SELECT id, name, email, phone, role FROM users WHERE phone = ?').get(phone);
  if (!user) {
    return res.status(404).json({ error: 'Telefone não cadastrado. Crie uma conta primeiro.' });
  }

  const safeUser = { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role };
  const token = generateToken(safeUser);
  res.json({ user: safeUser, token });
});

router.get('/me', requireAuth, (req, res) => {
  const user = db
    .prepare('SELECT id, name, email, phone, role FROM users WHERE id = ?')
    .get(req.user.id);
  res.json({ user });
});

// Um admin cria contas de barbeiro (mantido para gestão interna)
router.post('/barbers', requireAuth, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Apenas administradores podem cadastrar barbeiros.' });
  }
  const { name, email, phone, password } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Nome é obrigatório.' });
  }
  const info = db
    .prepare('INSERT INTO users (name, email, phone, password_hash, role) VALUES (?, ?, ?, ?, ?)')
    .run(name, email || '', phone || '', password || '', 'barber');
  const user = db.prepare('SELECT id, name, email, phone, role FROM users WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ user });
});

export default router;
