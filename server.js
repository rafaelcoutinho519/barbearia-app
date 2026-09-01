const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const session = require('express-session');
const bcrypt = require('bcrypt');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuração de Middlewares
app.use(cors({
    origin: true,
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
    secret: process.env.SESSION_SECRET || 'segredo_barbearia_secure_2026',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }
}));

// Banco de Dados SQLite (Persistente no Railway se usar volume ou local)
const dbFile = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbFile, (err) => {
    if (err) {
        console.error('Erro ao abrir o banco de dados', err.message);
    } else {
        console.log('Conectado ao banco de dados SQLite.');
        initDatabase();
    }
});

function initDatabase() {
    db.serialize(() => {
        // Tabela de Usuários / Clientes / Barbeiros
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            phone TEXT,
            role TEXT DEFAULT 'client'
        )`);

        // Tabela de Barbeiros da Equipe
        db.run(`CREATE TABLE IF NOT EXISTS barbers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            specialty TEXT,
            active INTEGER DEFAULT 1
        )`);

        // Tabela de Serviços
        db.run(`CREATE TABLE IF NOT EXISTS services (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT,
            price REAL NOT NULL,
            duration INTEGER NOT NULL
        )`);

        // Tabela de Agendamentos
        db.run(`CREATE TABLE IF NOT EXISTS appointments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            barber_id INTEGER,
            service_id INTEGER,
            date TEXT NOT NULL,
            time TEXT NOT NULL,
            status TEXT DEFAULT 'Agendado',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id),
            FOREIGN KEY(barber_id) REFERENCES barbers(id),
            FOREIGN KEY(service_id) REFERENCES services(id)
        )`, () => {
            seedInitialData();
        });
    });
}

function seedInitialData() {
    // Inserir Barbeiros corretos se a tabela estiver vazia
    db.get("SELECT COUNT(*) as count FROM barbers", (err, row) => {
        if (row.count === 0) {
            const defaultBarbers = [
                ['Karlos', 'Especialista em Degradê e Barba clásica'],
                ['David', 'Especialista em Cortes Modernos e Americano'],
                ['Dorgivan', 'Especialista em Social Moderno e Tesoura']
            ];
            const stmt = db.prepare("INSERT INTO barbers (name, specialty) VALUES (?, ?)");
            defaultBarbers.forEach(b => stmt.run(b[0], b[1]));
            stmt.finalize();
            console.log("Barbeiros padrão inseridos com sucesso.");
        }
    });

    // Inserir Serviços padrão se a tabela estiver vazia
    db.get("SELECT COUNT(*) as count FROM services", (err, row) => {
        if (row.count === 0) {
            const defaultServices = [
                ['Corte de Cabelo', 'Corte moderno ou clássico (Degradê, Americano, Social)', 35.00, 30],
                ['Barba', 'Modelagem de barba com toalha quente e navalha', 25.00, 25],
                ['Corte + Barba', 'Combo completo com atendimento especializado', 55.00, 50],
                ['Pézinho / Acabamento', 'Manutenção rápida dos pezinhos e peito do pé', 15.00, 15]
            ];
            const stmt = db.prepare("INSERT INTO services (name, description, price, duration) VALUES (?, ?, ?, ?)");
            defaultServices.forEach(s => stmt.run(s[0], s[1], s[2], s[3]));
            stmt.finalize();
            console.log("Serviços padrão inseridos com sucesso.");
        }
    });
}

// --- ROTAS DA API ---

// Listar Barbeiros
app.get('/api/barbers', (req, res) => {
    db.all("SELECT * FROM barbers WHERE active = 1", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Listar Serviços
app.get('/api/services', (req, res) => {
    db.all("SELECT * FROM services", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Criar Agendamento
app.post('/api/appointments', (req, res) => {
    const { barber_id, service_id, date, time, client_name, client_phone } = req.body;
    
    // Validação básica
    if (!barber_id || !service_id || !date || !time) {
        return res.status(400).json({ error: 'Preencha todos os campos obrigatórios para o agendamento.' });
    }

    let userId = req.session.userId || null;

    const insertAppointment = (uId) => {
        const query = `INSERT INTO appointments (user_id, barber_id, service_id, date, time, status) VALUES (?, ?, ?, ?, ?, 'Agendado')`;
        db.run(query, [uId, barber_id, service_id, date, time], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, appointmentId: this.lastID, message: 'Agendamento realizado com sucesso!' });
        });
    };

    if (!userId && client_email) {
        // Se houver dados de cliente avulso, podemos criar ou buscar
        insertAppointment(null);
    } else {
        insertAppointment(userId);
    }
});

// Rota padrão para carregar o frontend
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
