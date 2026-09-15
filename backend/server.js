import express from 'express';
import Database from 'better-sqlite3';
import cors from 'cors';
import { Client, LocalAuth } from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Conexão com o Banco SQLite
const db = new Database('database.sqlite');

// Criação da tabela de agendamentos caso não exista
db.exec(`
    CREATE TABLE IF NOT EXISTS agendamentos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome_cliente TEXT,
        telefone TEXT,
        horario TEXT,
        status_aviso INTEGER DEFAULT 0
    )
`);

// ==========================================
// CONFIGURAÇÃO DO WHATSAPP (whatsapp-web.js)
// ==========================================
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox'] // Essencial para rodar em servidores em nuvem
    }
});

client.on('qr', (qr) => {
    console.log('==================================================');
    console.log('ESCANEIE ESTE QR CODE NO TERMINAL DO SEU SERVIDOR:');
    console.log('==================================================');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('[WHATSAPP] Conectado e pronto para disparar os lembretes!');
});

client.initialize();

// Função de disparo
async function dispararLembrete(telefone, nome, horario) {
    const numeroFormatado = `55${telefone.replace(/\D/g, '')}@c.us`;
    const mensagem = `Olá ${nome}, passando para lembrar do seu agendamento na barbearia hoje às ${horario}. Te aguardamos lá!`;

    try {
        await client.sendMessage(numeroFormatado, mensagem);
        console.log(`[SUCESSO] Lembrete enviado para ${nome} (${telefone})`);
        return true;
    } catch (erro) {
        console.error('[ERRO] Falha ao enviar WhatsApp:', erro);
        return false;
    }
}

// ==========================================
// ROTINA AUTOMÁTICA (CRON A CADA 1 MINUTO)
// ==========================================
setInterval(async () => {
    try {
        // Procura agendamentos marcados para exatamente daqui a 1 hora que ainda não receberam aviso
        const agendamentos = db.prepare(`
            SELECT * FROM agendamentos 
            WHERE strftime('%Y-%m-%d %H:%M', datetime('now', 'localtime', '+1 hour')) = strftime('%Y-%m-%d %H:%M', horario)
            AND status_aviso = 0
        `).all();

        for (const ag of agendamentos) {
            await dispararLembrete(ag.telefone, ag.nome_cliente, ag.horario);
            
            // Marca como enviado para não repetir
            db.prepare('UPDATE agendamentos SET status_aviso = 1 WHERE id = ?').run(ag.id);
        }
    } catch (e) {
        console.log('Erro na verificação automática dos agendamentos:', e);
    }
}, 60000);

// ==========================================
// ROTAS DA API
// ==========================================

// Rota para cadastrar um novo agendamento (exemplo)
app.post('/api/agendamentos', (req, res) => {
    try {
        const { nome_cliente, telefone, horario } = req.body;
        
        const stmt = db.prepare('INSERT INTO agendamentos (nome_cliente, telefone, horario) VALUES (?, ?, ?)');
        const info = stmt.run(nome_cliente, telefone, horario);

        res.json({ sucesso: true, id: info.lastInsertRowid, mensagem: 'Agendamento criado com sucesso!' });
    } catch (erro) {
        res.status(500).json({ sucesso: false, erro: erro.message });
    }
});

// Rota para listar agendamentos
app.get('/api/agendamentos', (req, res) => {
    try {
        const agendamentos = db.prepare('SELECT * FROM agendamentos').all();
        res.json(agendamentos);
    } catch (erro) {
        res.status(500).json({ sucesso: false, erro: erro.message });
    }
});

app.get('/', (req, res) => {
    res.send('API da Barbearia rodando com automação do WhatsApp!');
});

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
