import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

const db = new Database('barbearia.db');

db.exec(`
    CREATE TABLE IF NOT EXISTS agendamentos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cliente TEXT NOT NULL,
        telefone TEXT NOT NULL,
        barbeiro TEXT NOT NULL,
        servico TEXT NOT NULL,
        data TEXT NOT NULL,
        horario TEXT NOT NULL,
        lembrete_enviado INTEGER DEFAULT 0,
        status TEXT DEFAULT 'Ativo'
    )
`);

async function enviarMensagemWhatsApp(telefone, mensagem) {
    console.log(`[WHATSAPP] Enviando para ${telefone}:\n${mensagem}`);
}

app.post('/api/agendamentos', async (req, res) => {
    try {
        const { cliente, telefone, barbeiro, servico, data, horario } = req.body;
        const stmt = db.prepare(`
            INSERT INTO agendamentos (cliente, telefone, barbeiro, servico, data, horario, lembrete_enviado, status)
            VALUES (?, ?, ?, ?, ?, ?, 0, 'Ativo')
        `);
        const info = stmt.run(cliente, telefone, barbeiro, servico, data, horario);
        res.json({ success: true, id: info.lastInsertRowid });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/status', (req, res) => {
    res.json({ message: 'API funcionando!' });
});

// ==========================================
// ROTA DE TESTE COM INJEÇÃO AUTOMÁTICA
// ==========================================
app.get('/api/testar-antecendencia', async (req, res) => {
    try {
        let agendamentos = db.prepare(`SELECT * FROM agendamentos WHERE status = 'Ativo'`).all();

        // Se não houver nenhum agendamento, cria um de teste na hora para disparar
        if (agendamentos.length === 0) {
            db.prepare(`
                INSERT INTO agendamentos (cliente, telefone, barbeiro, servico, data, horario, lembrete_enviado, status)
                VALUES (?, ?, ?, ?, ?, ?, 0, 'Ativo')
            `).run('Roberto Marinho', '5511999999999', 'Karlos', 'Corte e Barba', '2026-09-14', '20:00');

            agendamentos = db.prepare(`SELECT * FROM agendamentos WHERE status = 'Ativo'`).all();
        }

        const disparados = [];
        for (const ag of agendamentos) {
            const mensagemCliente = `Olá ${ag.cliente}! Passando para lembrar que seu corte de *${ag.servico}* na Brooklyn Barbearia é hoje às *${ag.horario}* (daqui a 1 hora).\n\nConfirma presença? Responda SIM ou NÃO.`;
            
            await enviarMensagemWhatsApp(ag.telefone, mensagemCliente);
            db.prepare(`UPDATE agendamentos SET lembrete_enviado = 1 WHERE id = ?`).run(ag.id);
            disparados.push(ag);
        }

        res.json({ success: true, totalDisparados: disparados.length, disparados });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
