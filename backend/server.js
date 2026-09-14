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

// Criar tabela de agendamentos e coluna de controle de lembrete (caso não exista)
db.exec(`
    CREATE TABLE IF NOT EXISTS agendamentos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cliente TEXT NOT NULL,
        telefone TEXT NOT NULL,
        barbeiro TEXT NOT NULL,
        servico TEXT NOT NULL,
        data TEXT NOT NULL,
        horario TEXT NOT NULL,
        lembrete_enviado INTEGER DEFAULT 0
    )
`);

// Função auxiliar para disparar a mensagem no WhatsApp (substitua pela sua URL/token caso use serviço externo, ou mantenha a lógica atual)
async function enviarMensagemWhatsApp(telefone, mensagem) {
    try {
        // Exemplo padrão de envio caso utilize Evolution API, Z-API ou similar configurado nas variáveis de ambiente (.env)
        // Se a sua API de WhatsApp estiver em outra rota ou serviço, ajuste aqui:
        console.log(`[WHATSAPP] Enviando para ${telefone}: ${mensagem}`);
        
        // Exemplo de requisição fetch para API de disparo (ajuste conforme o provedor que vocês usaram no projeto):
        /*
        await fetch(process.env.WHATSAPP_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.WHATSAPP_TOKEN}` },
            body: JSON.stringify({ phone: telefone, message: mensagem })
        });
        */
    } catch (error) {
        console.error('Erro ao enviar mensagem no WhatsApp:', error);
    }
}

// Rota para salvar um novo agendamento vindo do frontend
app.post('/api/agendamentos', async (req, res) => {
    try {
        const { cliente, telefone, barbeiro, servico, data, horario } = req.body;
        const stmt = db.prepare(`
            INSERT INTO agendamentos (cliente, telefone, barbeiro, servico, data, horario, lembrete_enviado)
            VALUES (?, ?, ?, ?, ?, ?, 0)
        `);
        const info = stmt.run(cliente, telefone, barbeiro, servico, data, horario);

        // Disparo imediato de novo agendamento (como já funcionava)
        const mensagemNovo = `NOVO AGENDAMENTO - BROOKLYN BARBEARIA\n\nCliente: ${cliente}\nTelefone: ${telefone}\nServiço: ${servico}\nData: ${data}\nHorário: ${horario}`;
        await enviarMensagemWhatsApp(telefone, mensagemNovo);

        res.json({ success: true, id: info.lastInsertRowid });
    } catch (error) {
        console.error('Erro ao salvar agendamento:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/status', (req, res) => {
    res.json({ message: 'API da Brooklyn Barbearia funcionando com sucesso!' });
});

// ==========================================
// ROTA DE TESTE: SIMULAR ANTECEDÊNCIA DE 1H
// ==========================================
app.get('/api/testar-antecendencia', async (req, res) => {
    try {
        // Busca agendamentos pendentes para testar o disparo simulando a antecedência
        const stmt = db.prepare(`
            SELECT * FROM agendamentos 
            WHERE lembrete_enviado = 0
        `);
        const agendamentosParaAvisar = stmt.all();

        const disparados = [];
        for (const ag of agendamentosParaAvisar) {
            console.log(`[TESTE ANTECEDÊNCIA 1H] Disparando lembrete para ${ag.cliente} (${ag.telefone}) - Agendado para: ${ag.data} às ${ag.horario}`);
            
            // Mensagem de lembrete de antecedência
            const mensagemLembrete = `Olá ${ag.cliente}! Passando para lembrar do seu horário de *${ag.servico}* hoje às *${ag.horario}* na Brooklyn Barbearia. Te esperamos lá!`;
            await enviarMensagemWhatsApp(ag.telefone, mensagemLembrete);

            // Marca como enviado
            db.prepare(`UPDATE agendamentos SET lembrete_enviado = 1 WHERE id = ?`).run(ag.id);
            disparados.push(ag);
        }

        res.json({ 
            success: true, 
            mensagem: 'Teste de antecedência de 1h executado e disparado!', 
            totalDisparados: disparados.length,
            disparados 
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ==========================================
// ROTINA AUTOMÁTICA DE LEMBRETES (24H no Ar)
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

        const stmt = db.prepare(`
            SELECT * FROM agendamentos 
            WHERE data = ? AND horario = ? AND lembrete_enviado = 0
        `);
        const agendamentosParaAvisar = stmt.all(dataAlvo, horarioAlvo);

        for (const ag of agendamentosParaAvisar) {
            console.log(`[AUTOMAÇÃO 1H] Disparando lembrete para ${ag.cliente} (${ag.telefone}) - Horário: ${ag.horario}`);

            const mensagemLembrete = `Olá ${ag.cliente}! Passando para lembrar do seu horário de *${ag.servico}* daqui a 1 hora (${ag.horario}) na Brooklyn Barbearia.`;
            await enviarMensagemWhatsApp(ag.telefone, mensagemLembrete);

            const updateStmt = db.prepare(`UPDATE agendamentos SET lembrete_enviado = 1 WHERE id = ?`);
            updateStmt.run(ag.id);
        }
    } catch (err) {
        console.error('Erro na rotina automática de lembretes:', err);
    }
}, 60 * 1000); // Roda a cada 1 minuto

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
