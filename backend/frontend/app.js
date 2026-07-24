// ---------- Estado global ----------
const state = {
  token: localStorage.getItem('token') || null,
  user: JSON.parse(localStorage.getItem('user') || 'null'),
  booking: { serviceId: null, barberId: null, date: null, time: null },
};

const appEl = document.getElementById('app');
const navEl = document.getElementById('nav');
document.getElementById('year').textContent = new Date().getFullYear();

// ---------- Helpers de API ----------
async function api(path, { method = 'GET', body, auth = false } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth && state.token) headers.Authorization = `Bearer ${state.token}`;
  const res = await fetch(`/api${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Erro inesperado. Tente novamente.');
  return data;
}

function toast(message, isError = false) {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.className = `toast ${isError ? 'error' : ''}`;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.add('hidden'), 3500);
}

function saveSession(user, token) {
  state.user = user;
  state.token = token;
  localStorage.setItem('user', JSON.stringify(user));
  localStorage.setItem('token', token);
}
function clearSession() {
  state.user = null;
  state.token = null;
  localStorage.removeItem('user');
  localStorage.removeItem('token');
}

function formatPrice(v) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function formatDate(d) {
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

// ---------- Roteamento ----------
const routes = {
  home: renderHome,
  login: renderLogin,
  register: renderRegister,
  dashboard: renderClientDashboard,
  barber: renderBarberDashboard,
};

function navigate() {
  let hash = (location.hash || '#home').slice(1);
  if (!routes[hash]) hash = 'home';

  // Protege rotas
  if (hash === 'dashboard' && (!state.user || state.user.role !== 'client')) hash = 'login';
  if (hash === 'barber' && (!state.user || !['barber', 'admin'].includes(state.user.role))) hash = 'login';

  renderNav(hash);
  routes[hash]();
  window.scrollTo(0, 0);
}
window.addEventListener('hashchange', navigate);

function renderNav(active) {
  const links = [];
  links.push(`<a href="#home" class="${active === 'home' ? 'active' : ''}">Início</a>`);

  if (state.user && state.user.role === 'client') {
    links.push(`<a href="#dashboard" class="${active === 'dashboard' ? 'active' : ''}">Meus agendamentos</a>`);
  }
  if (state.user && ['barber', 'admin'].includes(state.user.role)) {
    links.push(`<a href="#barber" class="${active === 'barber' ? 'active' : ''}">Painel do barbeiro</a>`);
  }

  if (state.user) {
    links.push(`<span class="text-muted" style="padding:8px 6px;font-size:14px;">Olá, ${state.user.name.split(' ')[0]}</span>`);
    links.push(`<button id="logoutBtn">Sair</button>`);
  } else {
    links.push(`<a href="#login" class="${active === 'login' ? 'active' : ''}">Entrar</a>`);
    links.push(`<a href="#register" class="btn small">Criar conta</a>`);
  }

  navEl.innerHTML = links.join('');
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) logoutBtn.onclick = () => {
    clearSession();
    location.hash = '#home';
    toast('Você saiu da sua conta.');
  };
}

// ---------- Home ----------
async function renderHome() {
  appEl.innerHTML = `
    <section class="hero">
      <h1>SHOWROOM BARBEARIA</h1>
      <p>Cortes precisos, barba na navalha e um atendimento à altura. Agende seu horário em menos de um minuto.</p>
      <a href="#${state.user && state.user.role === 'client' ? 'dashboard' : (state.user ? 'barber' : 'register')}" class="btn">Agendar horário</a>
    </section>
    <h2 class="section-title">Nossos serviços</h2>
    <div id="servicesList" class="grid cols-3"><p class="text-muted">Carregando...</p></div>
  `;
  try {
    const { services } = await api('/services');
    const list = document.getElementById('servicesList');
    if (!services.length) {
      list.innerHTML = '<p class="empty-state">Nenhum serviço cadastrado no momento.</p>';
      return;
    }
    list.innerHTML = services.map(s => `
      <div class="card service-card" style="cursor: pointer;" onclick="location.hash = '${state.user && state.user.role === 'client' ? 'dashboard' : 'login'}'">
        <h3>${s.name}</h3>
        <p class="text-muted" style="min-height:36px">${s.description || ''}</p>
        <div class="price">${formatPrice(s.price)}</div>
        <div class="meta">${s.duration_minutes} min</div>
      </div>
    `).join('');
  } catch (err) {
    document.getElementById('servicesList').innerHTML = `<p class="error-msg">${err.message}</p>`;
  }
}

// ---------- Login ----------
function renderLogin() {
  appEl.innerHTML = `
    <div class="auth-wrap card">
      <h2>Entrar</h2>
      <form id="loginForm">
        <div>
          <label>E-mail</label>
          <input type="email" name="email" required />
        </div>
        <div>
          <label>Senha</label>
          <input type="password" name="password" required />
        </div>
        <p id="loginError" class="error-msg"></p>
        <button class="btn" type="submit">Entrar</button>
      </form>
      <p class="auth-switch">Ainda não tem conta? <a href="#register">Cadastre-se</a></p>
    </div>
  `;
  document.getElementById('loginForm').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      const { user, token } = await api('/auth/login', {
        method: 'POST',
        body: { email: fd.get('email'), password: fd.get('password') },
      });
      saveSession(user, token);
      toast(`Bem-vindo, ${user.name.split(' ')[0]}!`);
      location.hash = user.role === 'client' ? '#dashboard' : '#barber';
      navigate();
    } catch (err) {
      document.getElementById('loginError').textContent = err.message;
    }
  };
}

// ---------- Cadastro (cliente) ----------
function renderRegister() {
  appEl.innerHTML = `
    <div class="auth-wrap card">
      <h2>Criar conta</h2>
      <form id="registerForm">
        <div>
          <label>Nome completo</label>
          <input type="text" name="name" required />
        </div>
        <div>
          <label>E-mail</label>
          <input type="email" name="email" required />
        </div>
        <div>
          <label>Telefone</label>
          <input type="tel" name="phone" placeholder="(00) 00000-0000" />
        </div>
        <div>
          <label>Senha (mín. 6 caracteres)</label>
          <input type="password" name="password" minlength="6" required />
        </div>
        <p id="registerError" class="error-msg"></p>
        <button class="btn" type="submit">Criar conta</button>
      </form>
      <p class="auth-switch">Já tem conta? <a href="#login">Entrar</a></p>
    </div>
  `;
  document.getElementById('registerForm').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      const { user, token } = await api('/auth/register', {
        method: 'POST',
        body: {
          name: fd.get('name'),
          email: fd.get('email'),
          phone: fd.get('phone'),
          password: fd.get('password'),
        },
      });
      saveSession(user, token);
      toast(`Conta criada com sucesso, ${user.name.split(' ')[0]}!`);
      location.hash = '#dashboard';
      navigate();
    } catch (err) {
      document.getElementById('registerError').textContent = err.message;
    }
  };
}

// ---------- Painel do cliente ----------
async function renderClientDashboard() {
  appEl.innerHTML = `
    <div class="tabs">
      <div class="tab active" data-tab="book">Agendar horário</div>
      <div class="tab" data-tab="mine">Meus agendamentos</div>
    </div>
    <div id="tabContent"></div>
  `;
  const tabs = appEl.querySelectorAll('.tab');
  tabs.forEach(t => t.onclick = () => {
    tabs.forEach(x => x.classList.remove('active'));
    t.classList.add('active');
    if (t.dataset.tab === 'book') renderBookingFlow();
    else renderMyAppointments();
  });
  renderBookingFlow();
}

async function renderBookingFlow() {
  const content = document.getElementById('tabContent');
  content.innerHTML = `<p class="text-muted">Carregando serviços e barbeiros...</p>`;
  try {
    const [{ services }, { barbers }] = await Promise.all([api('/services'), api('/barbers')]);
    state.booking = { serviceId: null, barberId: null, date: todayISO(), time: null };

    content.innerHTML = `
      <div class="card">
        <label>1. Escolha o serviço</label>
        <select id="serviceSelect">
          <option value="">Selecione...</option>
          ${services.map(s => `<option value="${s.id}">${s.name} — ${formatPrice(s.price)} (${s.duration_minutes}min)</option>`).join('')}
        </select>

        <div class="mt-16">
          <label>2. Escolha o barbeiro</label>
          <select id="barberSelect">
            <option value="">Selecione...</option>
            ${barbers.map(b => `<option value="${b.id}">${b.name === 'Administrador' ? 'Júnior Soares' : b.name}</option>`).join('')}
          </select>
        </div>

        <div class="mt-16">
          <label>3. Escolha a data</label>
          <div id="dateSelector" class="date-selector"></div>
        </div>

        <div class="mt-16">
          <label>4. Escolha o horário</label>
          <div id="slotsWrap" class="slots"><span class="text-muted">Selecione serviço, barbeiro e data.</span></div>
        </div>

        <div class="mt-24 flex-between">
          <p id="bookError" class="error-msg"></p>
          <button id="confirmBtn" class="btn" disabled>Confirmar agendamento</button>
        </div>
      </div>
    `;

    const serviceSelect = document.getElementById('serviceSelect');
    const barberSelect = document.getElementById('barberSelect');
    const confirmBtn = document.getElementById('confirmBtn');

    async function refreshSlots() {
      const { serviceId, barberId, date } = state.booking;
      const wrap = document.getElementById('slotsWrap');
      confirmBtn.disabled = true;
      state.booking.time = null;
      if (!serviceId || !barberId || !date) {
        wrap.innerHTML = '<span class="text-muted">Selecione serviço, barbeiro e data.</span>';
        return;
      }
      wrap.innerHTML = '<span class="text-muted">Carregando horários...</span>';
      try {
        const { slots } = await api(`/appointments/available?barberId=${barberId}&date=${date}&serviceId=${serviceId}`);
        if (!slots.length) {
          wrap.innerHTML = '<span class="text-muted">Nenhum horário disponível nesta data.</span>';
          return;
        }
        wrap.innerHTML = slots.map(s => `<button type="button" class="slot-btn" data-slot="${s}">${s}</button>`).join('');
        wrap.querySelectorAll('.slot-btn').forEach(btn => {
          btn.onclick = () => {
            wrap.querySelectorAll('.slot-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            state.booking.time = btn.dataset.slot;
            confirmBtn.disabled = false;
          };
        });
      } catch (err) {
        wrap.innerHTML = `<span class="error-msg">${err.message}</span>`;
      }
    }

    // Função interna para construir os cards de data modernos
    function setupDateSelector() {
      const container = document.getElementById('dateSelector');
      if (!container) return;

      container.innerHTML = '';
      const daysOfWeek = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
      const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
      const today = new Date();

      let firstValidDateSet = false;

      for (let i = 0; i < 14; i++) {
        const d = new Date();
        d.setDate(today.getDate() + i);

        const year = d.getFullYear();
        const monthStr = String(d.getMonth() + 1).padStart(2, '0');
        const dayStr = String(d.getDate()).padStart(2, '0');
        const fullDate = `${year}-${monthStr}-${dayStr}`;

        const dayOfWeek = d.getDay();
        const isSunday = dayOfWeek === 0;

        const card = document.createElement('div');
        card.className = `date-card ${isSunday ? 'disabled' : ''}`;
        card.dataset.date = fullDate;

        let dayLabel = daysOfWeek[dayOfWeek];
        if (i === 0) dayLabel = 'Hoje';
        if (i === 1) dayLabel = 'Amanhã';

        card.innerHTML = `
          <span class="day-name">${dayLabel}</span>
          <span class="day-number">${d.getDate()}</span>
          <span class="month-name">${months[d.getMonth()]}</span>
        `;

        if (!isSunday) {
          card.onclick = () => {
            container.querySelectorAll('.date-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            state.booking.date = fullDate;
            refreshSlots();
          };

          // Seleciona automaticamente o primeiro dia funcional (hoje ou amanhã, se hoje for domingo)
          if (!firstValidDateSet) {
            card.classList.add('selected');
            state.booking.date = fullDate;
            firstValidDateSet = true;
          }
        }

        container.appendChild(card);
      }
    }

    setupDateSelector();

    serviceSelect.onchange = () => { state.booking.serviceId = serviceSelect.value || null; refreshSlots(); };
    barberSelect.onchange = () => { state.booking.barberId = barberSelect.value || null; refreshSlots(); };

    confirmBtn.onclick = async () => {
      const { serviceId, barberId, date, time } = state.booking;
      document.getElementById('bookError').textContent = '';
      try {
        await api('/appointments', {
          method: 'POST',
          auth: true,
          body: { serviceId, barberId, date, startTime: time },
        });
        toast('Horário agendado com sucesso!');
        document.querySelector('.tab[data-tab="mine"]').click();
      } catch (err) {
        document.getElementById('bookError').textContent = err.message;
      }
    };
  } catch (err) {
    content.innerHTML = `<p class="error-msg">${err.message}</p>`;
  }
}

async function renderMyAppointments() {
  const content = document.getElementById('tabContent');
  content.innerHTML = '<p class="text-muted">Carregando...</p>';
  try {
    const { appointments } = await api('/appointments/me', { auth: true });
    if (!appointments.length) {
      content.innerHTML = '<div class="empty-state">Você ainda não tem agendamentos.</div>';
      return;
    }
    content.innerHTML = `
      <div class="card">
        <table>
          <thead><tr><th>Data</th><th>Horário</th><th>Serviço</th><th>Barbeiro</th><th>Valor</th><th>Status</th><th></th></tr></thead>
          <tbody>
            ${appointments.map(a => `
              <tr>
                <td>${formatDate(a.date)}</td>
                <td>${a.start_time}</td>
                <td>${a.service_name}</td>
                <td>${a.barber_name === 'Administrador' ? 'Júnior Soares' : a.barber_name}</td>
                <td>${formatPrice(a.price)}</td>
                <td><span class="badge ${a.status}">${a.status}</span></td>
                <td>${a.status === 'agendado' ? `<button class="btn small danger" data-cancel="${a.id}">Cancelar</button>` : ''}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
    content.querySelectorAll('[data-cancel]').forEach(btn => {
      btn.onclick = async () => {
        if (!confirm('Cancelar este agendamento?')) return;
        try {
          await api(`/appointments/${btn.dataset.cancel}`, { method: 'DELETE', auth: true });
          toast('Agendamento cancelado.');
          renderMyAppointments();
        } catch (err) {
          toast(err.message, true);
        }
      };
    });
  } catch (err) {
    content.innerHTML = `<p class="error-msg">${err.message}</p>`;
  }
}

// ---------- Painel do barbeiro ----------
async function renderBarberDashboard() {
  appEl.innerHTML = `
    <div class="tabs">
      <div class="tab active" data-tab="agenda">Agenda</div>
      <div class="tab" data-tab="services">Serviços e preços</div>
    </div>
    <div id="tabContent"></div>
  `;
  const tabs = appEl.querySelectorAll('.tab');
  tabs.forEach(t => t.onclick = () => {
    tabs.forEach(x => x.classList.remove('active'));
    t.classList.add('active');
    if (t.dataset.tab === 'agenda') renderAgenda();
    else renderServicesAdmin();
  });
  renderAgenda();
}

async function renderAgenda() {
  const content = document.getElementById('tabContent');
  content.innerHTML = `
    <div class="card">
      <div class="flex-between">
        <label style="margin:0">Data</label>
        <input type="date" id="agendaDate" value="${todayISO()}" style="max-width:200px" />
      </div>
      <div id="agendaList" class="mt-16"><p class="text-muted">Carregando...</p></div>
    </div>
  `;
  const dateInput = document.getElementById('agendaDate');
  async function load() {
    const list = document.getElementById('agendaList');
    list.innerHTML = '<p class="text-muted">Carregando...</p>';
    try {
      const { appointments } = await api(`/appointments/agenda?date=${dateInput.value}`, { auth: true });
      if (!appointments.length) {
        list.innerHTML = '<div class="empty-state">Nenhum agendamento para esta data.</div>';
        return;
      }
      list.innerHTML = `
        <table>
          <thead><tr><th>Horário</th><th>Cliente</th><th>Telefone</th><th>Serviço</th><th>Valor</th><th>Status</th><th></th></tr></thead>
          <tbody>
            ${appointments.map(a => `
              <tr>
                <td>${a.start_time} - ${a.end_time}</td>
                <td>${a.client_name}</td>
                <td>${a.client_phone || '-'}</td>
                <td>${a.service_name}</td>
                <td>${formatPrice(a.price)}</td>
                <td><span class="badge ${a.status}">${a.status}</span></td>
                <td>
                  ${a.status === 'agendado' ? `
                    <button class="btn small" data-status="concluido" data-id="${a.id}">Concluir</button>
                    <button class="btn small danger" data-status="cancelado" data-id="${a.id}">Cancelar</button>
                  ` : ''}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
      list.querySelectorAll('[data-status]').forEach(btn => {
        btn.onclick = async () => {
          try {
            await api(`/appointments/${btn.dataset.id}/status`, {
              method: 'PUT', auth: true, body: { status: btn.dataset.status },
            });
            toast('Status atualizado.');
            load();
          } catch (err) {
            toast(err.message, true);
          }
        };
      });
    } catch (err) {
      list.innerHTML = `<p class="error-msg">${err.message}</p>`;
    }
  }
  dateInput.onchange = load;
  load();
}

async function renderServicesAdmin() {
  const content = document.getElementById('tabContent');
  content.innerHTML = `
    <div class="card">
      <h3>Novo serviço</h3>
      <form id="newServiceForm" class="grid cols-2">
        <div><label>Nome</label><input name="name" required /></div>
        <div><label>Preço (R$)</label><input name="price" type="number" step="0.01" min="0" required /></div>
        <div><label>Duração (minutos)</label><input name="duration_minutes" type="number" min="5" step="5" required /></div>
        <div><label>Descrição</label><input name="description" /></div>
        <div style="grid-column:1/-1"><button class="btn" type="submit">Adicionar serviço</button></div>
      </form>
    </div>
    <div id="servicesTableWrap" class="card mt-24"><p class="text-muted">Carregando...</p></div>
  `;

  document.getElementById('newServiceForm').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await api('/services', {
        method: 'POST', auth: true,
        body: {
          name: fd.get('name'),
          description: fd.get('description'),
          price: parseFloat(fd.get('price')),
          duration_minutes: parseInt(fd.get('duration_minutes'), 10),
        },
      });
      toast('Serviço adicionado.');
      e.target.reset();
      loadServicesTable();
    } catch (err) {
      toast(err.message, true);
    }
  };

  async function loadServicesTable() {
    const wrap = document.getElementById('servicesTableWrap');
    wrap.innerHTML = '<p class="text-muted">Carregando...</p>';
    try {
      const { services } = await api('/services/all', { auth: true });
      wrap.innerHTML = `
        <h3>Todos os serviços</h3>
        <table>
          <thead><tr><th>Nome</th><th>Preço</th><th>Duração</th><th>Ativo</th><th></th></tr></thead>
          <tbody>
            ${services.map(s => `
              <tr>
                <td>${s.name}</td>
                <td>${formatPrice(s.price)}</td>
                <td>${s.duration_minutes} min</td>
                <td>${s.active ? 'Sim' : 'Não'}</td>
                <td>${s.active ? `<button class="btn small danger" data-deactivate="${s.id}">Desativar</button>` : ''}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
      wrap.querySelectorAll('[data-deactivate]').forEach(btn => {
        btn.onclick = async () => {
          if (!confirm('Desativar este serviço? Ele deixará de aparecer para os clientes.')) return;
          try {
            await api(`/services/${btn.dataset.deactivate}`, { method: 'DELETE', auth: true });
            toast('Serviço desativado.');
            loadServicesTable();
          } catch (err) {
            toast(err.message, true);
          }
        };
      });
    } catch (err) {
      wrap.innerHTML = `<p class="error-msg">${err.message}</p>`;
    }
  }
  loadServicesTable();
}

// ---------- Início ----------
navigate();
