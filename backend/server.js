import express from 'express';
import Database from 'better-sqlite3';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Em produção, defina JWT_SECRET nas variáveis de ambiente do Railway.
// O valor abaixo só existe para não quebrar o ambiente local caso a env não esteja setada.
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-troque-isso-em-producao';
if (!process.env.JWT_SECRET) {
    console.warn('[AVISO] JWT_SECRET não definido nas variáveis de ambiente. Defina um valor forte em produção (Railway > Variables).');
}

app.use(cors());
app.use(express.json());

// Servir arquivos estáticos da pasta public e backend
app.use(express.static(path.join(__dirname, '../public')));
app.use(express.static(__dirname));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Rota oficial para o Painel dos Barbeiros
app.get('/painel', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/painel.html'));
});

const db = new Database('database.sqlite');

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
        data TEXT,
        horario TEXT,
        servico TEXT,
        barbeiro_id INTEGER,
        status TEXT DEFAULT 'ativo',
        FOREIGN KEY(barbeiro_id) REFERENCES barbeiros(id)
    );
`);

// Adiciona a coluna pin_hash se ainda não existir (migração segura, não quebra bancos já em produção)
const colunasBarbeiros = db.prepare("PRAGMA table_info(barbeiros)").all().map(c => c.name);
if (!colunasBarbeiros.includes('pin_hash')) {
    db.exec('ALTER TABLE barbeiros ADD COLUMN pin_hash TEXT');
}

const totalBarbeiros = db.prepare('SELECT COUNT(*) as count FROM barbeiros').get().count;
if (totalBarbeiros === 0) {
    const insertBarbeiro = db.prepare('INSERT INTO barbeiros (nome, telefone) VALUES (?, ?)');
    insertBarbeiro.run('Karlos', '');
    insertBarbeiro.run('David', '');
    insertBarbeiro.run('Dorgivan', '');
}

// PINs padrão só são usados para preencher o hash de barbeiros que ainda não têm um definido
// (ex.: primeira execução após esta atualização). A partir daqui, o que importa é o pin_hash no banco.
// Unifiquei o PIN do David, que estava diferente entre o index.html (9012) e o painel.html (9876) — fica 9876.
const pinsPadrao = { Karlos: '1234', Dorgivan: '5678', David: '9876' };
const barbeirosSemHash = db.prepare('SELECT id, nome FROM barbeiros WHERE pin_hash IS NULL').all();
for (const b of barbeirosSemHash) {
    const pin = pinsPadrao[b.nome];
    if (pin) {
        const hash = bcrypt.hashSync(pin, 10);
        db.prepare('UPDATE barbeiros SET pin_hash = ? WHERE id = ?').run(hash, b.id);
    }
}

// Função auxiliar para normalizar a data para o formato YYYY-MM-DD
function normalizarData(dataStr) {
    if (!dataStr) return '';
    if (dataStr.includes('/')) {
        const partes = dataStr.split('/');
        if (partes.length === 3) {
            return `${partes[2]}-${partes[1]}-${partes[0]}`;
        }
    }
    return dataStr;
}

function normalizarTelefone(tel) {
    return (tel || '').replace(/\D/g, '');
}

// Middleware que exige um token de barbeiro válido (Authorization: Bearer <token>)
function autenticarBarbeiro(req, res, next) {
    const authHeader = req.headers['authorization'] || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
        return res.status(401).json({ error: 'Não autenticado. Faça login no painel.' });
    }

    try {
        const payload = jwt.verify(token, JWT_SECRET);
        req.barbeiro = payload; // { id, nome }
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Sessão inválida ou expirada. Faça login novamente.' });
    }
}

app.get('/barbeiros', (req, res) => {
    const barbeiros = db.prepare('SELECT id, nome, telefone FROM barbeiros').all();
    res.json(barbeiros);
});

// Login do barbeiro: recebe { barbeiro, pin } e devolve um token JWT
app.post('/login', (req, res) => {
    const { barbeiro, pin } = req.body;

    if (!barbeiro || !pin) {
        return res.status(400).json({ error: 'Informe o barbeiro e o PIN.' });
    }

    const row = db.prepare('SELECT * FROM barbeiros WHERE nome = ?').get(barbeiro);
    if (!row || !row.pin_hash || !bcrypt.compareSync(String(pin), row.pin_hash)) {
        return res.status(401).json({ error: 'PIN incorreto.' });
    }

    const token = jwt.sign({ id: row.id, nome: row.nome }, JWT_SECRET, { expiresIn: '12h' });
    res.json({ token, barbeiro: row.nome });
});

// Rota pública e segura para o widget de agendamento: só devolve os horários já ocupados,
// nunca nome/telefone de clientes.
app.get('/disponibilidade', (req, res) => {
    const { barbeiro, data } = req.query;

    if (!barbeiro || !data) {
        return res.status(400).json({ error: 'Informe barbeiro e data.' });
    }

    const bObj = db.prepare('SELECT id FROM barbeiros WHERE nome = ? OR id = ?').get(barbeiro, barbeiro);
    if (!bObj) {
        return res.json([]);
    }

    const dataNormalizada = normalizarData(data);
    const linhas = db.prepare(`
        SELECT horario FROM agendamentos
        WHERE barbeiro_id = ? AND data = ? AND status = 'ativo'
    `).all(bObj.id, dataNormalizada);

    res.json(linhas.map(l => l.horario));
});

// Rota pública e escopada: um cliente só enxerga os PRÓPRIOS agendamentos, filtrados no servidor
// pelo telefone informado — nunca a lista completa de todos os clientes.
app.get('/agendamentos/cliente', (req, res) => {
    const { telefone } = req.query;

    if (!telefone) {
        return res.status(400).json({ error: 'Informe o telefone.' });
    }

    const telLimpo = normalizarTelefone(telefone);

    const todos = db.prepare(`
        SELECT agendamentos.*, barbeiros.nome as barbeiro_nome
        FROM agendamentos
        JOIN barbeiros ON agendamentos.barbeiro_id = barbeiros.id
        WHERE agendamentos.status = 'ativo'
    `).all();

    const doCliente = todos.filter(a => normalizarTelefone(a.telefone_cliente) === telLimpo);
    res.json(doCliente);
});

// Rota completa (nome, telefone, tudo) — agora exige login do barbeiro.
// Antes ficava aberta e qualquer pessoa podia abrir essa URL no navegador e ver os dados de todos os clientes.
app.get('/agendamentos', autenticarBarbeiro, (req, res) => {
    const { barbeiro, data } = req.query;

    let query = `
        SELECT agendamentos.*, barbeiros.nome as barbeiro_nome 
        FROM agendamentos 
        JOIN barbeiros ON agendamentos.barbeiro_id = barbeiros.id
        WHERE agendamentos.status = 'ativo'
    `;

    const params = [];

    if (barbeiro) {
        const bObj = db.prepare('SELECT id FROM barbeiros WHERE nome = ? OR id = ?').get(barbeiro, barbeiro);
        if (bObj) {
            query += ` AND agendamentos.barbeiro_id = ?`;
            params.push(bObj.id);
        } else {
            query += ` AND 1 = 0`;
        }
    }

    if (data) {
        const dataNormalizada = normalizarData(data);
        query += ` AND agendamentos.data = ?`;
        params.push(dataNormalizada);
    }

    const agendamentos = db.prepare(query).all(...params);
    res.json(agendamentos);
});

app.post('/agendamentos', (req, res) => {
    const { nome_cliente, telefone_cliente, data, horario, servico, barbeiro_id } = req.body;

    if (!nome_cliente || !telefone_cliente || !data || !horario || !barbeiro_id) {
        return res.status(400).json({ error: 'Preencha todos os campos do agendamento.' });
    }

    const dataPadronizada = normalizarData(data);

    try {
        const existente = db.prepare(`
            SELECT * FROM agendamentos 
            WHERE barbeiro_id = ? AND data = ? AND horario = ? AND status = 'ativo'
        `).get(barbeiro_id, dataPadronizada, horario);

        if (existente) {
            return res.status(400).json({ error: 'Este horário já está ocupado.' });
        }

        const stmt = db.prepare('INSERT INTO agendamentos (nome_cliente, telefone_cliente, data, horario, servico, barbeiro_id, status) VALUES (?, ?, ?, ?, ?, ?, ?)');
        const info = stmt.run(nome_cliente, telefone_cliente, dataPadronizada, horario, servico || 'Corte', barbeiro_id, 'ativo');
        
        res.json({ id: info.lastInsertRowid, success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Cancelamento: permitido para (a) o barbeiro autenticado (qualquer agendamento dele), ou
// (b) o próprio cliente, enviando o telefone usado no agendamento (?telefone=...).
// Antes, qualquer pessoa na internet podia cancelar qualquer agendamento só sabendo o id.
app.delete('/agendamentos/:id', (req, res) => {
    const { id } = req.params;
    const { telefone } = req.query;

    const agendamento = db.prepare('SELECT * FROM agendamentos WHERE id = ?').get(id);
    if (!agendamento) {
        return res.status(404).json({ error: 'Agendamento não encontrado.' });
    }

    const authHeader = req.headers['authorization'] || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    let autorizado = false;

    if (token) {
        try {
            const payload = jwt.verify(token, JWT_SECRET);
            if (payload.id === agendamento.barbeiro_id) {
                autorizado = true;
            }
        } catch (err) {
            // token inválido: cai para checar o telefone abaixo
        }
    }

    if (!autorizado && telefone && normalizarTelefone(telefone) === normalizarTelefone(agendamento.telefone_cliente)) {
        autorizado = true;
    }

    if (!autorizado) {
        return res.status(403).json({ error: 'Você não tem permissão para cancelar este agendamento.' });
    }

    try {
        db.prepare("UPDATE agendamentos SET status = 'cancelado' WHERE id = ?").run(id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
