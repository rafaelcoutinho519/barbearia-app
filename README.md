# Barbearia Navalha de Ouro — Site de Agendamento

Site completo para barbearia com cadastro de clientes, login, agendamento de
horários e um painel para o barbeiro gerenciar a agenda e os serviços/preços.

## Stack usada

- **Backend:** Node.js + Express + SQLite (`better-sqlite3`), autenticação com
  JWT e senhas com hash (`bcryptjs`).
- **Frontend:** HTML + CSS + JavaScript puro (sem build), servido como
  arquivos estáticos pelo próprio backend. Não precisa de Vite/React/etc.
- **Banco de dados:** SQLite (arquivo local `backend/barbearia.db`, criado
  automaticamente). Fácil de trocar por PostgreSQL/MySQL depois, se quiser
  crescer o projeto.

## Estrutura de pastas

```
barbearia-app/
├── backend/
│   ├── src/
│   │   ├── server.js          # servidor Express (API + arquivos estáticos)
│   │   ├── db.js              # conexão e schema do SQLite + dados iniciais
│   │   ├── middleware/auth.js # JWT e checagem de papel (client/barber/admin)
│   │   └── routes/            # rotas da API (auth, services, barbers, appointments)
│   ├── package.json
│   └── .env.example
└── frontend/
    ├── index.html
    ├── style.css
    └── app.js                 # SPA (single-page app) em JS puro
```

## Como rodar localmente

Pré-requisitos: [Node.js](https://nodejs.org) versão 18 ou superior.

```bash
cd barbearia-app/backend
cp .env.example .env       # ajuste os valores se quiser
npm install
npm run dev                # ou "npm start"
```

Abra **http://localhost:3001** no navegador. O backend já serve o frontend
automaticamente — não precisa rodar dois servidores.

Na primeira execução, o sistema cria automaticamente uma conta de
administrador/barbeiro com os dados definidos no `.env`
(`ADMIN_EMAIL` / `ADMIN_PASSWORD`, padrão `admin@barbearia.com` / `admin123`).
Use essa conta para entrar no **Painel do barbeiro**, cadastrar outros
barbeiros pela API e gerenciar serviços.

## Contas e papéis (roles)

- **client**: qualquer visitante pode se cadastrar pelo site ("Criar conta").
  Consegue agendar horários e ver/cancelar os próprios agendamentos.
- **barber**: acessa o painel de agenda e de serviços. Só é criado por um
  admin (não existe cadastro público de barbeiro, por segurança).
- **admin**: mesmo acesso de barbeiro, além de poder cadastrar novos
  barbeiros via `POST /api/auth/barbers` (rota autenticada).

### Como cadastrar um novo barbeiro

Depois de logado como admin, pegue o token retornado no login e chame:

```bash
curl -X POST http://localhost:3001/api/auth/barbers \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_TOKEN_AQUI" \
  -d '{"name":"João Barbeiro","email":"joao@barbearia.com","password":"senha123"}'
```

## Principais funcionalidades

- Cadastro e login de clientes (com JWT).
- Listagem pública dos serviços e preços na home.
- Fluxo de agendamento: escolher serviço → barbeiro → data → horário
  disponível (o sistema calcula os horários livres automaticamente,
  considerando o horário de funcionamento e a duração de cada serviço).
- Área do cliente: ver e cancelar os próprios agendamentos.
- Painel do barbeiro: ver agenda por dia, marcar atendimento como
  concluído ou cancelado.
- Painel do barbeiro: cadastrar, editar preço/duração e desativar
  serviços.

## Horário de funcionamento

Por padrão o sistema considera atendimento das **09:00 às 19:00**, de
segunda a sábado (domingo fechado). Para mudar, edite as constantes
`OPEN_HOUR`, `CLOSE_HOUR` e `CLOSED_WEEKDAY` em
`backend/src/routes/appointments.routes.js`.

## Colocando no ar (deploy)

Como é um app Node.js simples com banco em arquivo (SQLite), funciona bem em
qualquer serviço que rode Node, por exemplo:

- **Railway** ou **Render**: conecte o repositório, defina o comando de
  start (`npm start` dentro de `backend`) e as variáveis de ambiente do
  `.env`.
- **VPS própria**: suba os arquivos, rode `npm install && npm start` com um
  gerenciador de processos como `pm2`.

Para produção, é recomendado:
1. Trocar `JWT_SECRET` por um valor forte e único.
2. Trocar a senha padrão do admin.
3. Se o tráfego crescer muito, migrar de SQLite para PostgreSQL (a estrutura
   de rotas já separa bem a lógica do banco em `db.js`, facilitando a troca).

## Próximos passos sugeridos

- Pagamento online (ex: integração com Mercado Pago/Stripe).
- Notificações por e-mail/WhatsApp confirmando ou lembrando o agendamento.
- Upload de foto de perfil/portfólio de cada barbeiro.
- Horários de funcionamento configuráveis por barbeiro.
