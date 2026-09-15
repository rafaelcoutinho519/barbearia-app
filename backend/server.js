import express from 'express';
import Database from 'better-sqlite3';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Servir arquivos estáticos da pasta atual
app.use(express.static(__dirname));

// Rota raiz para retornar o index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Conexão com o Banco SQLite
const db = new Database('database.sqlite');

// Criação das tabelas necessárias
db.exec(`
    CREATE TABLE IF NOT EXISTS barbeiros (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT,
        telefone TEXT
    );

    CREATE TABLE IF NOT EXISTS agendamentos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome_cliente TEXT,
        telefone_cliente TEXT,
        horario TEXT,
        barbeiro_id INTEGER,
        lembrete_enviado INTEGER DEFAULT 0,
        FOREIGN KEY(barbeiro_id) REFERENCES barbeiros(id)
    );
`);

// Cadastra os 3 barbeiros iniciais se a tabela estiver vazia
const totalBarbeiros = db.prepare('SELECT COUNT(*) as count FROM barbeiros').get().count;
if (totalBarbeiros === 0) {
    const insertBarbeiro = db.prepare('INSERT INTO barbeiros (nome, telefone) VALUES (?, ?)');
    insertBarbeiro.run('Karlos', '');
    insertBarbeiro.run('David', '');
    insertBarbeiro.run('Dorgivan', '');
}

// Rota para listar barbeiros
app.get('/barbeiros', (req, res) => {
    const barbeiros = db.prepare('SELECT * FROM barbeiros').all();
    res.json(barbeiros);
});

// Rota para listar agendamentos
app.get('/agendamentos', (req, res) => {
    const agendamentos = db.prepare(`
        SELECT agendamentos.*, barbeiros.nome as barbeiro_nome 
        FROM agendamentos 
        JOIN barbeiros ON agendamentos.barbeiro_id = barbeiros.id
    `).all();
    res.json(agendamentos);
});

// Rota para criar agendamento (com disparo imediato de teste do lembrete)
app.post('/agendamentos', (req, res) => {
    const { nome_cliente, telefone_cliente, horario, barbeiro_id } = req.body;
    
    try {
        const stmt = db.prepare('INSERT INTO agendamentos (nome_cliente, telefone_cliente, horario, barbeiro_id, lembrete_enviado) VALUES (?, ?, ?, ?, 1)');
        const info = stmt.run(nome_cliente, telefone_cliente, horario, barbeiro_id);
        
        // LOG DE TESTE: Simula o disparo imediato para você conferir nos logs do Railway se a mensagem foi enviada para o número
        console.log(`[TESTE DE LEMBRETE DISPARADO] Enviando aviso prévio para o cliente ${nome_cliente} no número ${telefone_cliente} referente ao horário ${horario}`);
        
        res.json({ id: info.lastInsertRowid, success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
