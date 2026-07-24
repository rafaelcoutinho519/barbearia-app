import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db.js';
import { generateToken, requireAuth } from '../middleware/auth.js';

const router = Router();

// Cadastro público — cria clientes apenas com Nome e Telefone
router.post('/register', (req, res) => {
  try {
    const { name, phone } = req.body;

    if (!name || !phone) {
      return res.status(400).json({ error: 'Nome e telefone são obrigatórios.' });
    }

    // Verifica se o telefone já está cadastrado
    const existing = db.prepare('SELECT id FROM users WHERE phone = ?').get(phone);
    if (existing) {
      return res.status(409).json({ error: 'Já existe uma conta cadastrada com este telefone.' });
    }

    // Gera dados fictícios para satisfazer a regra NOT NULL do banco de dados
    const cleanPhone = phone.replace(/\D/g, ''); // Apenas números
    const fakeEmail = `cli_${cleanPhone}_${Date.now()}@barbearia.local`;
    const fakePassword = `pass_${cleanPhone}`;
    const hash = bcrypt.hashSync(fakePassword, 10);

    const info = db
      .prepare('INSERT INTO users (name, email, phone, password_hash, role) VALUES (?, ?, ?, ?, ?)')
      .run(name, fakeEmail, phone, hash, 'client');

    const user = db.prepare('SELECT id, name, email, phone, role FROM users WHERE id = ?').get(info.lastInsertRowid);
    const token = generateToken(user);
    
    res.status(201).json({ user, token });
  } catch (error) {
    console.error('Erro no cadastro:', error);
    res.status(500).json({ error: 'Erro interno ao cadastrar usuário.' });
  }
});

// Login do cliente — autentica apenas pelo número de telefone
router.post('/login', (req, res) => {
  try {
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
  } catch (error) {
    console.error('Erro no login:', error);
    res.status(500).json({ error: 'Erro interno ao realizar login.' });
  }
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
  const hash = bcrypt.hashSync(password || '123456', 10);
  const info = db
    .prepare('INSERT INTO users (name, email, phone, password_hash, role) VALUES (?, ?, ?, ?, ?)')
    .run(name, email || '', phone || '', hash, 'barber');
  const user = db.prepare('SELECT id, name, email, phone, role FROM users WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ user });
});

export default router;
