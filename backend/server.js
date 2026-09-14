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

// Rota para salvar um novo agendamento vindo do frontend
app.post('/api/agendamentos', (req, res) => {
    try {
        const { cliente, telefone, barbeiro, servico, data, horario } = req.body;
        const stmt = db.prepare(`
            INSERT INTO agendamentos (cliente, telefone, barbeiro, servico, data, horario, lembrete_enviado)
            VALUES (?, ?, ?, ?, ?, ?, 0)
        `);
        const info = stmt.run(cliente, telefone, barbeiro, servico, data, horario);
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
// ROTINA AUTOMÁTICA DE LEMBRETES (24H no Ar)
// ==========================================
setInterval(() => {
    try {
        const agora = new Date();
        
        // Adiciona 1 hora na data/hora atual para buscar compromissos que acontecem daqui a 1 hora
        const daquiUmaHora = new Date(agora.getTime() + 60 * 60 * 1000);

        const ano = daquiUmaHora.getFullYear();
        const mes = String(daquiUmaHora.getMonth() + 1).padStart(2, '0');
        const dia = String(daquiUmaHora.getDate()).padStart(2, '0');
        const hora = String(daquiUmaHora.getHours()).padStart(2, '0');
        const minuto = String(daquiUmaHora.getMinutes()).padStart(2, '0');

        const dataAlvo = `${ano}-${mes}-${dia}`; // Formato YYYY-MM-DD
        const horarioAlvo = `${hora}:${minuto}`; // Formato HH:MM

        // Busca agendamentos na mesma data e minuto exato cujo lembrete ainda não foi enviado
        const stmt = db.prepare(`
            SELECT * FROM agendamentos 
            WHERE data = ? AND horario = ? AND lembrete_enviado = 0
        `);
        const agendamentosParaAvisar = stmt.all(dataAlvo, horarioAlvo);

        for (const ag of agendamentosParaAvisar) {
            console.log(`[AUTOMAÇÃO] Disparando lembrete para ${ag.cliente} (${ag.telefone}) - Horário: ${ag.horario}`);

            // AQUI VOCÊ INTEGRA O DISPARO DA SUA API DE WHATSAPP (Ex: Evolution API, WPPConnect, etc.)
            // Exemplo de payload ou chamada fetch para a sua API de WhatsApp:
            // enviarMensagemWhatsApp(ag.telefone, `Olá ${ag.cliente}, lembrete do seu corte hoje às ${ag.horario} com ${ag.barbeiro}!`);

            // Marca como enviado para não disparar novamente
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
