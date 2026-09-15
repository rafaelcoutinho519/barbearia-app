import express from 'express';
import Database from 'better-sqlite3';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

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
        FOREIGN KEY(barbeiro_id) REFERENCES barbeiros(id)
    );
`);

// Cadastra os 3 barbeiros iniciais se a tabela estiver vazia
const totalBarbeiros = db.prepare('SELECT COUNT(*) as total FROM barbeiros').get().total;
if (totalBarbeiros === 0) {
    const insertBarbeiro = db.prepare('INSERT INTO barbeiros (nome, telefone) VALUES (?, ?)');
    insertBarbeiro.run('Karlos', '5581999999991'); // Substitua pelo número real com DDD
    insertBarbeiro.run('David', '5581999999992');  // Substitua pelo número real com DDD
    insertBarbeiro.run('Dorgivan', '5581999999993'); // Substitua pelo número real com DDD
}

// Rota para cadastrar agendamento e já retornar o link pronto do WhatsApp do barbeiro
app.post('/api/agendamentos', (req, res) => {
    try {
        const { nome_cliente, telefone_cliente, horario, barbeiro_id } = req.body;
        
        // Salva no banco
        const stmt = db.prepare('INSERT INTO agendamentos (nome_cliente, telefone_cliente, horario, barbeiro_id) VALUES (?, ?, ?, ?)');
        const info = stmt.run(nome_cliente, telefone_cliente, horario, barbeiro_id);

        // Busca o telefone do barbeiro escolhido
        const barbeiro = db.prepare('SELECT * FROM barbeiros WHERE id = ?').get(barbeiro_id);

        // Monta a mensagem automática para o barbeiro receber ou para o cliente
        const mensagem = `Olá ${barbeiro.nome}, novo agendamento de ${nome_cliente} para o horário ${horario}.`;
        const linkWhatsApp = `https://api.whatsapp.com/send?phone=${barbeiro.telefone}&text=${encodeURIComponent(mensagem)}`;

        res.json({ 
            sucesso: true, 
            id: info.lastInsertRowid, 
            linkWhatsApp: linkWhatsApp,
            mensagem: 'Agendamento realizado com sucesso!' 
        });
    } catch (erro) {
        res.status(500).json({ sucesso: false, erro: erro.message });
    }
});

// Rota para listar os barbeiros (para preencher o select no seu front-end)
app.get('/api/barbeiros', (req, res) => {
    const barbeiros = db.prepare('SELECT * FROM barbeiros').all();
    res.json(barbeiros);
});

app.get('/', (req, res) => {
    res.send('API da Barbearia rodando perfeitamente!');
});

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
