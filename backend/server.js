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

app.post('/api/agendamentos', async (req, res) => {
    try {
        const { cliente, telefone, barbeiro, servico, data, horario } = req.body;
        const stmt = db.prepare(`
            INSERT INTO agendamentos (cliente, telefone, barbeiro, servico, data, horario, lembrete_enviado, status)
            VALUES (?, ?, ?, ?, ?, ?, 0, 'Ativo')
        `);
        const info = stmt.run(cliente, telefone, barbeiro, servico, data, horario);
        
        // Gera o link do WhatsApp para o novo agendamento
        const textoMsg = `NOVO AGENDAMENTO - BROOKLYN BARBEARIA%0A%0ACliente: ${cliente}%0ATelefone: ${telefone}%0AServiço: ${servico}%0AData: ${data}%0AHorário: ${horario}`;
        const linkWhatsApp = `https://wa.me/?text=${textoMsg}`;

        res.json({ success: true, id: info.lastInsertRowid, linkWhatsApp });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/status', (req, res) => {
    res.json({ message: 'API funcionando!' });
});

// ==========================================
// ROTA DE TESTE MANUAL - GERA O LINK DE ANTECEDÊNCIA
// ==========================================
app.get('/api/testar-antecendencia', async (req, res) => {
    try {
        let agendamentos = db.prepare(`SELECT * FROM agendamentos WHERE status = 'Ativo'`).all();

        // Se não houver agendamentos, injeta um de teste com o número que você quiser testar
        if (agendamentos.length === 0) {
            db.prepare(`
                INSERT INTO agendamentos (cliente, telefone, barbeiro, servico, data, horario, lembrete_enviado, status)
                VALUES (?, ?, ?, ?, ?, ?, 0, 'Ativo')
            `).run('Roberto Marinho', '5587996342515', 'Karlos', 'Barba', '2026-09-14', '19:00');

            agendamentos = db.prepare(`SELECT * FROM agendamentos WHERE status = 'Ativo'`).all();
        }

        const resultados = [];
        for (const ag of agendamentos) {
            // Formata o texto da mensagem de 1h antes com as opções de confirmar ou cancelar
            const textoMensagem = `Olá ${ag.cliente}! Passando para lembrar que seu corte de *${ag.servico}* na Brooklyn Barbearia é hoje às *${ag.horario}* (daqui a 1 hora).%0A%0AVocê confirma presença ou deseja cancelar?%0A%0AResponda com SIM para confirmar ou NÃO para cancelar.`;
            
            // Limpa o telefone para garantir formato internacional (ex: DDI + DDD + Número)
            const telefoneLimpo = ag.telefone.replace(/\D/g, '');
            const linkWhatsApp = `https://wa.me/${telefoneLimpo}?text=${textoMensagem}`;

            db.prepare(`UPDATE agendamentos SET lembrete_enviado = 1 WHERE id = ?`).run(ag.id);
            
            resultados.push({
                cliente: ag.cliente,
                telefone: ag.telefone,
                linkWhatsApp: linkWhatsApp
            });
        }

        res.json({ success: true, totalDisparados: resultados.length, resultados });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
