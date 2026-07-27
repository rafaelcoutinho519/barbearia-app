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
  profissionais: renderProfessionals,
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
  links.push(`<a href="#profissionais" class="${active === 'profissionais' ? 'active' : ''}">Profissionais</a>`);

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

// ---------- Conheça Nossos Profissionais ----------
function renderProfessionals() {
  appEl.innerHTML = `
    <section class="hero" style="padding: 40px 20px;">
      <h1>NOSSOS PROFISSIONAIS</h1>
      <p>Profissionais qualificados focados em entregar o melhor estilo e atendimento.</p>
    </section>

    <div class="card" style="max-width: 800px; margin: 0 auto; padding: 30px;">
      <div style="display: flex; gap: 24px; flex-wrap: wrap; align-items: center;">
        <div style="flex: 1; min-width: 250px; text-align: center;">
          <div style="width: 150px; height: 150px; border-radius: 50%; background: #c59b27; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center; font-size: 48px; color: #1a1a1a; font-weight: bold;">
            JS
          </div>
          <h2 style="margin-bottom: 4px;">Júnior Soares</h2>
          <p class="text-muted" style="margin-bottom: 16px;">Barbeiro Master & Fundador</p>
          
          <div style="display: flex; gap: 12px; justify-content: center;">
            <a href="https://instagram.com/SEU_INSTAGRAM" target="_blank" class="btn small" style="background: #E1306C; color: #fff; text-decoration: none;">Instagram</a>
            <a href="https://wa.me/5587996289373" target="_blank" class="btn small" style="background: #25D366; color: #fff; text-decoration: none;">WhatsApp</a>
          </div>
        </div>

        <div style="flex: 2; min-width: 280px;">
          <h3>Sobre o profissional</h3>
          <p class="text-muted" style="margin-top: 8px; line-height: 1.6;">
            Especialista em cortes modernos, clássicos, barba na navalha e visagismo. Anos de experiência dedicados a elevar o padrão do atendimento e garantir a satisfação de cada cliente que passa pela cadeira.
          </p>
          <div class="mt-16">
            <a href="#${state.user && state.user.role === 'client' ? 'dashboard' : 'register'}" class="btn">Agendar com Júnior</a>
          </div>
        </div>
      </div>

      <h3 style="margin-top: 40px; margin-bottom: 16px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 24px;">Galeria de Trabalhos</h3>
      <div class="grid cols-3" style="gap: 12px;">
        <div style="background: #222; height: 160px; border-radius: 8px; display: flex; align-items: center; justify-content: center;" class="text-muted">Corte Degradê</div>
        <div style="background: #222; height: 160px; border-radius: 8px; display: flex; align-items: center; justify-content: center;" class="text-muted">Barba Navalhada</div>
        <div style="background: #222; height: 160px; border-radius: 8px; display: flex; align-items: center; justify-content: center;" class="text-muted">Social Moderno</div>
      </div>
    </div>
  `;
}

// ---------- Login (Apenas Telefone) ----------
function renderLogin() {
  appEl.innerHTML = `
    <div class="auth-wrap card">
      <h2>Entrar</h2>
      <p class="text-muted" style="margin-bottom: 16px; font-size: 14px;">Informe seu telefone para acessar seus agendamentos.</p>
      <form id="loginForm">
        <div>
          <label>Telefone</label>
          <input type="tel" name="phone" placeholder="(00) 00000-0000" required />
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
        body: { phone: fd.get('phone') },
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

// ---------- Cadastro Simples (Nome e Telefone) ----------
function renderRegister() {
  appEl.innerHTML = `
    <div class="auth-wrap card">
      <h2>Criar conta</h2>
      <p class="text-muted" style="margin-bottom: 16px; font-size: 14px;">Rápido e fácil, apenas nome e telefone para marcar.</p>
      <form id="registerForm">
        <div>
          <label>Nome completo</label>
          <input type="text" name="name" required />
        </div>
        <div>
          <label>Telefone</label>
          <input type="tel" name="phone" placeholder="(00) 00000-0000" required />
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
          phone: fd.get('phone'),
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
          <input type="date" id="dateInput" min="${todayISO()}" value="${todayISO()}" />
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
    const dateInput = document.getElementById('dateInput');
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

    serviceSelect.onchange = () => { state.booking.serviceId = serviceSelect.value || null; refreshSlots(); };
    barberSelect.onchange = () => { state.booking.barberId = barberSelect.value || null; refreshSlots(); };
    dateInput.onchange = () => { state.booking.date = dateInput.value; refreshSlots(); };

    confirmBtn.onclick = async () => {
      const { serviceId, barberId, date, time } = state.booking;
      document.getElementById('bookError').textContent = '';
      try {
        const responseData = await api('/appointments', {
          method: 'POST',
          auth: true,
          body: { 
            serviceId: Number(serviceId), 
            barberId: Number(barberId), 
            date, 
            startTime: time,
            start_time: time
          },
        });

        toast('Horário agendado com sucesso!');

        // Dispara mensagem automática para o WhatsApp do Barbeiro na confirmação
        const barberPhone = '5587996289373';
        const selectedServiceOpt = serviceSelect.options[serviceSelect.selectedIndex].text.split('—')[0].trim();
        const clientName = state.user ? state.user.name : 'Cliente';

        let confirmMsg = `✨ *NOVO AGENDAMENTO*%0A%0A` +
                         `*Cliente:* ${clientName}%0A` +
                         `*Serviço:* ${selectedServiceOpt}%0A` +
                         `*Data:* ${formatDate(date)} às ${time}`;

        window.open(`https://wa.me/${barberPhone}?text=${confirmMsg}`, '_blank');

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
        if (!confirm('Deseja realmente cancelar este agendamento?')) return;
        
        const apptId = parseInt(btn.dataset.cancel, 10);
        const appt = appointments.find(a => a.id === apptId);

        try {
          await api(`/appointments/${apptId}`, { method: 'DELETE', auth: true });
          toast('Agendamento cancelado.');

          // Dispara mensagem automática para o WhatsApp do Barbeiro no cancelamento
          const barberPhone = '5587996289373';
          let cancelMsg = `⚠️ *CANCELAMENTO DE AGENDAMENTO*%0A%0A` +
                          `O cliente *${state.user ? state.user.name : 'Cliente'}* cancelou um horário.`;

          if (appt) {
            cancelMsg += `%0A%0A` +
                       `*Serviço:* ${appt.service_name}%0A` +
                       `*Data:* ${formatDate(appt.date)} às ${appt.start_time}`;
          }

          window.open(`https://wa.me/${barberPhone}?text=${cancelMsg}`, '_blank');

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
