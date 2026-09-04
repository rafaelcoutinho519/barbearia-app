import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import Database from 'better-sqlite3';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Inicialização simples do banco de dados SQLite para os agendamentos/usuários
const db = new Database('barbearia.db');

app.get('/', (req, res) => {
    res.json({ message: 'API da Brooklyn Barbearia funcionando com sucesso!' });
});

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
