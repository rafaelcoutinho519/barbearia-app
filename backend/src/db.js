import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '..', 'barbearia.db');

export const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    phone TEXT,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('client','barber','admin')) DEFAULT 'client',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS services (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    price REAL NOT NULL,
    duration_minutes INTEGER NOT NULL,
    active INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS appointments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL REFERENCES users(id),
    barber_id INTEGER NOT NULL REFERENCES users(id),
    service_id INTEGER NOT NULL REFERENCES services(id),
    date TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'agendado' CHECK (status IN ('agendado','concluido','cancelado')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// Seed inicial: um usuário barbeiro/admin e os serviços atualizados
const userCount = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
if (userCount === 0) {
  const adminName = process.env.ADMIN_NAME || 'Administrador';
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@barbearia.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
  const hash = bcrypt.hashSync(adminPassword, 10);

  db.prepare(
    `INSERT INTO users (name, email, phone, password_hash, role) VALUES (?, ?, ?, ?, 'admin')`
  ).run(adminName, adminEmail, '', hash);

  const insertService = db.prepare(
    `INSERT INTO services (name, description, price, duration_minutes) VALUES (?, ?, ?, ?)`
  );

  // Novos serviços e valores cadastrados
  insertService.run('Corte', 'Corte tradicional na tesoura ou máquina', 25, 35);
  insertService.run('Barba', 'Modelagem e acabamento de barba com navalha', 10, 15);
  insertService.run('Corte + Barba', 'Combo completo de corte e barba', 35, 40);
  insertService.run('Sobrancelha', 'Design de sobrancelha na navalha', 5, 10);
  insertService.run('Pezinho do Cabelo', 'Acabamento do pezinho do cabelo', 5, 10);
  insertService.run('Progressiva', 'Alisamento e tratamento capilar', 50, 40);
  insertService.run('Progressiva + Corte', 'Combo de alisamento com corte', 80, 80);

  console.log(`Usuário admin/barbeiro criado: ${adminEmail} / senha: ${adminPassword}`);
}
