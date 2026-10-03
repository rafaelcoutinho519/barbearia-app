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

app.set('trust proxy', 1); // Railway fica na frente do servidor; necessário para enxergar o IP real
app.use(cors());
app.use(express.json());

// Servir arquivos estáticos da pasta public e backend
// Bloqueia arquivos sensíveis: antes, /server.js e /database.sqlite podiam ser baixados por qualquer pessoa
// porque a pasta backend inteira é servida como estática.
app.use((req, res, next) => {
    if (/(^|\/)\.|\.(sqlite|sqlite3|sqlite-wal|sqlite-shm|db|env)$|\/(server\.js|package(-lock)?\.json)$/i.test(req.path)) {
        return res.status(404).end();
    }
    next();
});

app.use(express.static(path.join(__dirname, '../public')));
app.use(express.static(__dirname));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Rota oficial para o Painel dos Barbeiros
app.get('/painel', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/painel.html'));
});

// Em produção (Railway), aponte DB_PATH para um Volume (ex.: /data/database.sqlite) para o banco não ser apagado a cada deploy.
const DB_PATH = process.env.DB_PATH || 'database.sqlite';
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('busy_timeout = 5000');
console.log('[BANCO] Usando arquivo:', path.resolve(DB_PATH));

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

// ===== TRAVA CONTRA HORÁRIO DUPLICADO (feita pelo próprio banco) =====
// Só pode existir UM agendamento 'ativo' por barbeiro + data + horário. Cancelados não contam.
let indiceUnicoOk = false;
function garantirIndiceUnico() {
    if (indiceUnicoOk) return true;
    try {
        db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS ux_agendamento_ativo
                 ON agendamentos (barbeiro_id, data, horario) WHERE status = 'ativo'`);
        indiceUnicoOk = true;
        console.log('[BANCO] Trava de horário duplicado ATIVA.');
        return true;
    } catch (err) {
        // Já existem horários duplicados gravados: o índice só entra depois que os extras forem cancelados no painel.
        const dup = db.prepare(`
            SELECT a.id, b.nome AS barbeiro, a.data, a.horario, a.nome_cliente, a.telefone_cliente
            FROM agendamentos a JOIN barbeiros b ON b.id = a.barbeiro_id
            WHERE a.status = 'ativo' AND (a.barbeiro_id, a.data, a.horario) IN (
                SELECT barbeiro_id, data, horario FROM agendamentos
                WHERE status = 'ativo' GROUP BY barbeiro_id, data, horario HAVING COUNT(*) > 1)
            ORDER BY a.data, a.horario, a.id
        `).all();
        console.warn('[BANCO] ATENÇÃO: existem agendamentos duplicados. Cancele os extras no painel. A trava ativa sozinha depois disso.');
        console.table(dup);
        return false;
    }
}
garantirIndiceUnico();

// ===== Horários válidos (mesmas regras do site) =====
const HORARIOS_BLOQUEADOS = {
    Karlos: ['13:00', '13:40'],
    Dorgivan: ['12:20', '13:00'],
    David: ['12:20', '13:00', '13:40']
};

function gerarHorarios(diaSemana, nomeBarbeiro) {
    let fim; // em minutos desde 00:00
    if (nomeBarbeiro === 'Dorgivan') fim = diaSemana === 6 ? 19 * 60 + 40 : 19 * 60;
    else if (nomeBarbeiro === 'David') fim = 19 * 60 + 40;
    else if (nomeBarbeiro === 'Karlos') fim = 19 * 60; // Karlos: último horário 19:00, todos os dias
    else fim = (diaSemana >= 1 && diaSemana <= 4) ? 19 * 60 + 30 : 20 * 60;

    const bloqueados = HORARIOS_BLOQUEADOS[nomeBarbeiro] || [];
    const lista = [];
    for (let m = 9 * 60; m <= fim; m += 40) {
        const hh = String(Math.floor(m / 60)).padStart(2, '0');
        const mm = String(m % 60).padStart(2, '0');
        const h = `${hh}:${mm}`;
        if (!bloqueados.includes(h)) lista.push(h);
    }
    return lista;
}

function horarioPermitido(nomeBarbeiro, dataISO, horario) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dataISO);
    if (!m) return false;
    const diaSemana = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).getUTCDay();
    if (diaSemana === 0) return false; // domingo fechado
    return gerarHorarios(diaSemana, nomeBarbeiro).includes(horario);
}

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

// Os PINs dos barbeiros vêm das variáveis de ambiente do Railway (PIN_KARLOS, PIN_DORGIVAN, PIN_DAVID).
// Nada de PIN fica escrito no código nem no GitHub. A cada inicialização, o hash no banco é sincronizado com a variável,
// então para trocar um PIN basta mudar a variável no Railway.
const todosBarbeiros = db.prepare('SELECT id, nome, pin_hash FROM barbeiros').all();
for (const b of todosBarbeiros) {
    const pin = process.env['PIN_' + String(b.nome).toUpperCase()];
    if (!pin) {
        console.warn(`[AVISO] Variável PIN_${String(b.nome).toUpperCase()} não definida: ${b.nome} ${b.pin_hash ? 'continua com o PIN já salvo' : 'NÃO conseguirá entrar no painel'}.`);
        continue;
    }
    if (!b.pin_hash || !bcrypt.compareSync(String(pin), b.pin_hash)) {
        db.prepare('UPDATE barbeiros SET pin_hash = ? WHERE id = ?').run(bcrypt.hashSync(String(pin), 10), b.id);
        console.log(`[PIN] PIN de ${b.nome} atualizado a partir das variáveis de ambiente.`);
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
// Limite de tentativas: 5 erros por IP + barbeiro a cada 15 minutos (PIN de 4 dígitos seria fácil de adivinhar sem isso)
const tentativasLogin = new Map();
const MAX_TENTATIVAS = 5;
const JANELA_MS = 15 * 60 * 1000;

app.post('/login', (req, res) => {
    const { barbeiro, pin } = req.body;

    if (!barbeiro || !pin) {
        return res.status(400).json({ error: 'Informe o barbeiro e o PIN.' });
    }

    const chave = req.ip + '|' + String(barbeiro);
    const agora = Date.now();
    const reg = tentativasLogin.get(chave);
    if (reg && agora - reg.inicio > JANELA_MS) tentativasLogin.delete(chave);
    const atual = tentativasLogin.get(chave);
    if (atual && atual.erros >= MAX_TENTATIVAS) {
        return res.status(429).json({ error: 'Muitas tentativas incorretas. Aguarde 15 minutos e tente novamente.' });
    }

    const row = db.prepare('SELECT * FROM barbeiros WHERE nome = ?').get(barbeiro);
    if (!row || !row.pin_hash || !bcrypt.compareSync(String(pin), row.pin_hash)) {
        const r = tentativasLogin.get(chave) || { erros: 0, inicio: agora };
        r.erros++;
        tentativasLogin.set(chave, r);
        return res.status(401).json({ error: 'PIN incorreto.' });
    }
    tentativasLogin.delete(chave);

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

// Gravação atômica: verifica e insere dentro de UMA transação com trava de escrita,
// e o índice único do banco é a segunda barreira. Dois clientes nunca conseguem o mesmo horário.
const inserirAgendamento = db.transaction((d) => {
    const existente = db.prepare(`
        SELECT id FROM agendamentos
        WHERE barbeiro_id = ? AND data = ? AND horario = ? AND status = 'ativo'
    `).get(d.barbeiro_id, d.data, d.horario);
    if (existente) return { conflito: true };

    const info = db.prepare(`
        INSERT INTO agendamentos (nome_cliente, telefone_cliente, data, horario, servico, barbeiro_id, status)
        VALUES (?, ?, ?, ?, ?, ?, 'ativo')
    `).run(d.nome_cliente, d.telefone_cliente, d.data, d.horario, d.servico, d.barbeiro_id);
    return { id: info.lastInsertRowid };
});

app.post('/agendamentos', (req, res) => {
    const { nome_cliente, telefone_cliente, data, horario, servico, barbeiro_id } = req.body;

    if (!nome_cliente || !telefone_cliente || !data || !horario || !barbeiro_id) {
        return res.status(400).json({ error: 'Preencha todos os campos do agendamento.' });
    }

    const barbeiroIdNum = Number(barbeiro_id);
    const barbeiro = Number.isInteger(barbeiroIdNum)
        ? db.prepare('SELECT id, nome FROM barbeiros WHERE id = ?').get(barbeiroIdNum)
        : null;
    if (!barbeiro) {
        return res.status(400).json({ error: 'Profissional inválido.' });
    }

    const dataPadronizada = normalizarData(String(data));
    const horarioLimpo = String(horario).trim();

    if (!horarioPermitido(barbeiro.nome, dataPadronizada, horarioLimpo)) {
        return res.status(400).json({ error: 'Este horário não está disponível para este profissional.' });
    }

    try {
        const resultado = inserirAgendamento.immediate({
            nome_cliente: String(nome_cliente).trim().slice(0, 100),
            telefone_cliente: String(telefone_cliente).trim().slice(0, 30),
            data: dataPadronizada,
            horario: horarioLimpo,
            servico: String(servico || 'Corte').slice(0, 100),
            barbeiro_id: barbeiro.id
        });

        if (resultado.conflito) {
            return res.status(409).json({ error: 'Este horário acabou de ser reservado por outra pessoa. Escolha outro horário.' });
        }
        res.json({ id: resultado.id, success: true });
    } catch (error) {
        if (error && String(error.code).startsWith('SQLITE_CONSTRAINT')) {
            return res.status(409).json({ error: 'Este horário acabou de ser reservado por outra pessoa. Escolha outro horário.' });
        }
        console.error('Erro ao criar agendamento:', error);
        res.status(500).json({ error: 'Erro ao criar o agendamento. Tente novamente.' });
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
        garantirIndiceUnico(); // se ainda faltava a trava por causa de duplicados, ativa assim que sumirem
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
