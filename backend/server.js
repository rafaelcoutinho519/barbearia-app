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

app.get('/api/status', (req, res) => {
    res.json({ message: 'API da Brooklyn Barbearia funcionando com sucesso!' });
});

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
