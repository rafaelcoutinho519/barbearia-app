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

const totalBarbeiros = db.prepare('SELECT COUNT(*) as count FROM barbeiros').get().count;
if (totalBarbeiros === 0) {
    const insertBarbeiro = db.prepare('INSERT INTO barbeiros (nome, telefone) VALUES (?, ?)');
    insertBarbeiro.run('Karlos', '');
    insertBarbeiro.run('David', '');
    insertBarbeiro.run('Dorgivan', '');
}

// Função auxiliar para normalizar a data para o formato YYYY-MM-DD
function normalizarData(dataStr) {
    if (!dataStr) return '';
    // Se vier no formato DD/MM/YYYY
    if (dataStr.includes('/')) {
        const partes = dataStr.split('/');
        if (partes.length === 3) {
            return `${partes[2]}-${partes[1]}-${partes[0]}`;
        }
    }
    return dataStr; // Retorna como está se já for YYYY-MM-DD
}

app.get('/barbeiros', (req, res) => {
    const barbeiros = db.prepare('SELECT * FROM barbeiros').all();
    res.json(barbeiros);
});

app.get('/agendamentos', (req, res) => {
    const { barbeiro, data } = req.query;
    
    let query = `
        SELECT agendamentos.*, barbeiros.nome as barbeiro_nome 
        FROM agendamentos 
        JOIN barbeiros ON agendamentos.barbeiro_id = barbeiros.id
        WHERE agendamentos.status = 'ativo'
    `;
    
    const params = [];

    if (barbeiro) {
        query += ` AND (barbeiros.nome = ? OR barbeiros.id = ?)`;
        params.push(barbeiro, barbeiro);
    }

    if (data) {
        const dataIso = normalizarData(data);
        // Cria variações para garantir que encontre independente de como foi salvo no banco
        const partesIso = dataIso.split('-');
        let dataBr = data;
        if (partesIso.length === 3) {
            dataBr = `${partesIso[2]}-${partesIso[1]}-${partesIso[0]}`; // DD-MM-YYYY ou similar
        }

        query += ` AND (agendamentos.data = ? OR agendamentos.data = ? OR agendamentos.data = ?)`;
        params.push(data, dataIso, dataBr);
    }

    const agendamentos = db.prepare(query).all(...params);
    res.json(agendamentos);
});

app.post('/agendamentos', (req, res) => {
    const { nome_cliente, telefone_cliente, data, horario, servico, barbeiro_id } = req.body;
    
    // Normaliza a data antes de salvar no banco para manter o padrão YYYY-MM-DD
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

app.delete('/agendamentos/:id', (req, res) => {
    const { id } = req.params;
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
