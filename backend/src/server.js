import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import './db.js'; // inicializa e faz seed do banco
import authRoutes from './routes/auth.routes.js';
import serviceRoutes from './routes/services.routes.js';
import barberRoutes from './routes/barbers.routes.js';
import appointmentRoutes from './routes/appointments.routes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/barbers', barberRoutes);
app.use('/api/appointments', appointmentRoutes);

app.get('/api/health', (req, res) => res.json({ ok: true }));

// Serve o frontend estático (pasta ../../frontend)
const frontendPath = path.join(__dirname, '..', 'frontend');
app.use(express.static(frontendPath));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(frontendPath, 'index.html'));
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Servidor da barbearia rodando em http://localhost:${PORT}`);
});
