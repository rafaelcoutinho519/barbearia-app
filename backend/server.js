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

// Servir os arquivos estáticos diretamente da mesma pasta
app.use(express.static(__dirname));

// Inicialização do banco de dados SQLite
const db = new Database('barbearia.db');

// Criar tabela de agendamentos e colunas de controle caso não existam
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

// Função interna para enviar mensagens no WhatsApp
async function enviarMensagemWhatsApp(telefone, mensagem) {
    try {
        console.log(`[WHATSAPP] Enviando para ${telefone}:\n${mensagem}`);
    } catch (error) {
        console.error('Erro ao enviar mensagem no WhatsApp:', error);
    }
}

// Rota para salvar um novo agendamento vindo do frontend
app.post('/api/agendamentos', async (req, res) => {
    try {
        const { cliente, telefone, barbeiro, servico, data, horario } = req.body;
        const stmt = db.prepare(`
            INSERT INTO agendamentos (cliente, telefone, barbeiro, servico, data, horario, lembrete_enviado, status)
            VALUES (?, ?, ?, ?, ?, ?, 0, 'Ativo')
        `);
        const info = stmt.run(cliente, telefone, barbeiro, servico, data, horario);

        // Notifica sobre o novo agendamento
        const mensagemBarbeiro = `NOVO AGENDAMENTO - BROOKLYN BARBEARIA\n\nCliente: ${cliente}\nTelefone: ${telefone}\nServiço: ${servico}\nData: ${data}\nHorário: ${horario}`;
        await enviarMensagemWhatsApp(telefone, mensagemBarbeiro);

        res.json({ success: true, id: info.lastInsertRowid });
    } catch (error) {
        console.error('Erro ao salvar agendamento:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Rota para cancelar o agendamento (libera a vaga e avisa)
app.post('/api/cancelar-agendamento', async (req, res) => {
    try {
        const { id } = req.body;
        const agendamento = db.prepare(`SELECT * FROM agendamentos WHERE id = ?`).get(id);

        if (!agendamento) {
            return res.status(404).json({ success: false, error: 'Agendamento não encontrado.' });
        }

        db.prepare(`UPDATE agendamentos SET status = 'Cancelado' WHERE id = ?`).run(id);

        const msgCancelamento = `CANCELAMENTO DE HORÁRIO\n\nO cliente ${agendamento.cliente} cancelou o agendamento de ${agendamento.servico} marcado para ${agendamento.data} às ${agendamento.horario}. (Vaga liberada)`;
        await enviarMensagemWhatsApp(agendamento.telefone, msgCancelamento);

        res.json({ success: true, message: 'Agendamento cancelado e vaga liberada com sucesso.' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/status', (req, res) => {
    res.json({ message: 'API da Brooklyn Barbearia funcionando com sucesso!' });
});

// ==========================================
// ROTA PARA VER TODOS OS AGENDAMENTOS SALVOS
// ==========================================
app.get('/api/ver-agendamentos', (req, res) => {
    try {
        const todos = db.prepare(`SELECT * FROM agendamentos`).all();
        res.json({ success: true, total: todos.length, todos });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ==========================================
// ROTA DE TESTE MANUAL (DISPARA QUALQUER ATIVO)
// ==========================================
app.get('/api/testar-antecendencia', async (req, res) => {
    try {
        // Reseta o lembrete_enviado para 1 para forçar o teste imediato de qualquer ativo
        db.prepare(`UPDATE agendamentos SET lembrete_enviado = 0 WHERE status = 'Ativo'`).run();
        const agendamentosPendentes = db.prepare(`SELECT * FROM agendamentos WHERE status = 'Ativo'`).all();

        const disparados = [];
        for (const ag of agendamentosPendentes) {
            const mensagemCliente = `Olá ${ag.cliente}! Passando para lembrar que seu corte de *${ag.servico}* na Brooklyn Barbearia é hoje às *${ag.horario}* (daqui a 1 hora).\n\nVocê confirma presença ou deseja cancelar?\n\nResponda com SIM para confirmar ou NÃO para cancelar.`;
            
            await enviarMensagemWhatsApp(ag.telefone, mensagemCliente);

            db.prepare(`UPDATE agendamentos SET lembrete_enviado = 1 WHERE id = ?`).run(ag.id);
            disparados.push(ag);
        }

        res.json({ success: true, totalDisparados: disparados.length, disparados });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ==========================================
// ROTINA AUTOMÁTICA DE 1 HORA ANTES
// ==========================================
setInterval(async () => {
    try {
        const agora = new Date();
        const daquiUmaHora = new Date(agora.getTime() + 60 * 60 * 1000);

        const ano = daquiUmaHora.getFullYear();
        const mes = String(daquiUmaHora.getMonth() + 1).padStart(2, '0');
        const dia = String(daquiUmaHora.getDate()).padStart(2, '0');
        const hora = String(daquiUmaHora.getHours()).padStart(2, '0');
        const minuto = String(daquiUmaHora.getMinutes()).padStart(2, '0');

        const dataAlvo = `${ano}-${mes}-${dia}`;
        const horarioAlvo = `${hora}:${minuto}`;

        const agendamentosParaAvisar = db.prepare(`
            SELECT * FROM agendamentos 
            WHERE data = ? AND horario = ? AND lembrete_enviado = 0 AND status = 'Ativo'
        `).all(dataAlvo, horarioAlvo);

        for (const ag of agendamentosParaAvisar) {
            console.log(`[AUTOMAÇÃO 1H] Disparando aviso de antecedência para ${ag.cliente}`);

            const mensagemCliente = `Olá ${ag.cliente}! Seu horário de *${ag.servico}* na Brooklyn Barbearia é às *${ag.horario}* (daqui a 1 hora).\n\nConfirma a presença ou deseja cancelar?`;
            await enviarMensagemWhatsApp(ag.telefone, mensagemCliente);

            db.prepare(`UPDATE agendamentos SET lembrete_enviado = 1 WHERE id = ?`).run(ag.id);
        }
    } catch (err) {
        console.error('Erro na rotina automática:', err);
    }
}, 60 * 1000);

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
