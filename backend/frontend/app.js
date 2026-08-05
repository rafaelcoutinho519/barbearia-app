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
  if (!res.ok) {
    console.error("Erro da API Detalhado:", data);
    throw new Error(data.error || data.message || 'Erro inesperado. Tente novamente.');
  }
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

// ---------- Conheça Nossos Profissionais (Com Galeria Interativa e Modal) ----------
function renderProfessionals() {
  appEl.innerHTML = `
    <section class="hero" style="padding: 40px 20px;">
      <h1>NOSSOS PROFISSIONAIS</h1>
      <p>Profissionais qualificados focados em entregar o melhor estilo e atendimento.</p>
    </section>

    <div class="card" style="max-width: 800px; margin: 0 auto; padding: 30px;">
      <div style="display: flex; gap: 24px; flex-wrap: wrap; align-items: center;">
        <div style="flex: 1; min-width: 250px; text-align: center;">
          <div style="width: 150px; height: 150px; border-radius: 50%; overflow: hidden; margin: 0 auto 16px; border: 3px solid #c59b27; box-shadow: 0 4px 10px rgba(0,0,0,0.3);">
            <img src="01.jpeg" alt="Júnior Soares" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.src='https://via.placeholder.com/150?text=JS'" />
          </div>
          <h2 style="margin-bottom: 4px;">Júnior Soares</h2>
          <p class="text-muted" style="margin-bottom: 16px;">Barbeiro Master & Fundador</p>
          
          <div style="display: flex; gap: 12px; justify-content: center;">
            <a href="https://www.instagram.com/juniores_silva?igsh=ajJ4cW1mNWQ2NnBr" target="_blank" class="btn small" style="background: #E1306C; color: #fff; text-decoration: none;">Instagram</a>
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
      
      <div class="grid cols-3" style="gap: 16px;">
        <!-- Corte Degradê -->
        <div class="gallery-item" data-title="Corte Degradê" data-desc="É o estilo de cabelo masculino mais pedido nas barbearias atualmente, caracterizado por uma transição suave de comprimento onde o cabelo começa bem curto ou raspado na base e vai aumentando de tamanho até o topo." style="background: #222; border-radius: 8px; overflow: hidden; border: 1px solid #333; text-align: center; cursor: pointer; transition: transform 0.3s ease, border-color 0.3s ease;">
          <div style="height: 160px; overflow: hidden;">
            <img src="2 degrade.jpeg" alt="Corte Degradê" style="width: 100%; height: 100%; object-fit: cover; transition: transform 0.4s ease;" class="gallery-img" onerror="this.style.display='none'" />
          </div>
          <div style="padding: 12px; font-weight: 500; font-size: 14px; color: #fff;">Corte Degradê</div>
        </div>

        <!-- Corte Americano -->
        <div class="gallery-item" data-title="Corte Americano" data-desc="Sua principal característica é a preservação do volume do topo do cabelo enquanto o degradê é feito de forma concentrada apenas nas costeletas e na nuca." style="background: #222; border-radius: 8px; overflow: hidden; border: 1px solid #333; text-align: center; cursor: pointer; transition: transform 0.3s ease, border-color 0.3s ease;">
          <div style="height: 160px; overflow: hidden;">
            <img src="americano.jpeg" alt="Corte Americano" style="width: 100%; height: 100%; object-fit: cover; transition: transform 0.4s ease;" class="gallery-img" onerror="this.style.display='none'" />
          </div>
          <div style="padding: 12px; font-weight: 500; font-size: 14px; color: #fff;">Corte Americano</div>
        </div>

        <!-- Social Moderno -->
        <div class="gallery-item" data-title="Social Moderno" data-desc="O estilo social moderno reinterpreta a alfaiataria clássica trazendo mais leveza, conforto e personalidade para o visual masculino." style="background: #222; border-radius: 8px; overflow: hidden; border: 1px solid #333; text-align: center; cursor: pointer; transition: transform 0.3s ease, border-color 0.3s ease;">
          <div style="height: 160px; overflow: hidden;">
            <img src="social.jpeg" alt="Social Moderno" style="width: 100%; height: 100%; object-fit: cover; transition: transform 0.4s ease;" class="gallery-img" onerror="this.style.display='none'" />
          </div>
          <div style="padding: 12px; font-weight: 500; font-size: 14px; color: #fff;">Social Moderno</div>
        </div>
      </div>
    </div>
  `;

  const items = document.querySelectorAll('.gallery-item');
  items.forEach(item => {
    const title = item.dataset.title;
    const desc = item.dataset.desc;
    const img = item.querySelector('.gallery-img');
    const imgSrc = img ? img.src : '';

    item.onclick = () => {
      abrirDetalhesCorte(title, desc, imgSrc);
    };
  });
}

// ---------- Funções Globais do Modal ----------
function abrirDetalhesCorte(titulo, descricao, imagemSrc) {
  const modal = document.getElementById('cutModal');
  const titleEl = document.getElementById('modalTitle');
  const descEl = document.getElementById('modalDescription');
  const imgEl = document.getElementById('modalImage');

  if (titleEl) titleEl.innerText = titulo;
  if (descEl) descEl.innerText = descricao;
  if (imgEl) imgEl.src = imagemSrc;
  
  if (modal) modal.classList.add('active');
}

function fecharModalBtn() {
  const modal = document.getElementById('cutModal');
  if (modal) modal.classList.remove('active');
}

function fecharModal(event) {
  if (event.target.id === 'cutModal') {
    fecharModalBtn();
  }
}

// ---------- Login Inteligente (Auto-cadastro se o telefone não existir) ----------
function renderLogin() {
  appEl.innerHTML = `
    <div class="auth-wrap card">
      <h2>Entrar</h2>
      <p class="text-muted" style="margin-bottom: 16px; font-size: 14px;">Informe seu telefone. Se não tiver conta, criaremos uma automaticamente para você!</p>
      <form id="loginForm">
        <div>
          <label>Telefone</label>
          <input type="tel" name="phone" placeholder="(00) 00000-0000" required />
        </div>
        <p id="loginError" class="error-msg"></p>
        <button class="btn" type="submit">Entrar / Cadastrar</button>
      </form>
      <p class="auth-switch">Prefere cadastrar com nome? <a href="#register">Criar conta completa</a></p>
    </div>
  `;
  document.getElementById('loginForm').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const phone = fd.get('phone');
    
    try {
      const res = await api('/auth/login', {
        method: 'POST',
        body: { phone },
      });
      saveSession(res.user, res.token);
      toast(`Bem-vindo de volta, ${res.user.name.split(' ')[0]}!`);
      location.hash = res.user.role === 'client' ? '#dashboard' : '#barber';
      navigate();
    } catch (err) {
      try {
        const defaultName = "Cliente " + phone.slice(-4);
        const regRes = await api('/auth/register', {
          method: 'POST',
          body: { name: defaultName, phone },
        });
        saveSession(regRes.user, regRes.token);
        toast(`Conta criada com sucesso para ${phone}!`);
        location.hash = '#dashboard';
        navigate();
      } catch (regErr) {
        document.getElementById('loginError').textContent = regErr.message;
      }
    }
  };
}

// ---------- Cadastro Completo (Nome e Telefone) ----------
function renderRegister() {
  appEl.innerHTML = `
    <div class="auth-wrap card">
      <h2>Criar conta</h2>
      <p class="text-muted" style="margin-bottom: 16px; font-size: 14px;">Rápido e fácil, informe seu nome e telefone.</p>
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
    const name = fd.get('name');
    const phone = fd.get('phone');

    try {
      const { user, token } = await api('/auth/register', {
        method: 'POST',
        body: { name, phone },
      });
      saveSession(user, token);
      toast(`Conta criada com sucesso, ${user.name.split(' ')[0]}!`);
      location.hash = '#dashboard';
      navigate();
    } catch (err) {
      if (err.message && (err.message.toLowerCase().includes('já') || err.message.toLowerCase().includes('existe') || err.message.toLowerCase().includes('cadastrado'))) {
        try {
          const loginRes = await api('/auth/login', {
            method: 'POST',
            body: { phone },
          });
          saveSession(loginRes.user, loginRes.token);
          toast(`Telefone já cadastrado. Bem-vindo de volta, ${loginRes.user.name.split(' ')[0]}!`);
          location.hash = loginRes.user.role === 'client' ? '#dashboard' : '#barber';
          navigate();
          return;
        } catch (loginErr) {
          document.getElementById('registerError').textContent = err.message;
          return;
        }
      }
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
    
    const defaultDate = todayISO();
    state.booking = { serviceId: null, barberId: null, date: defaultDate, time: null };

    const availableDays = [];
    for (let i = 0; i < 14; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      const iso = d.toISOString().slice(0, 10);
      const weekDays = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];
      const weekDay = weekDays[d.getDay()];
      const dayNum = String(d.getDate()).padStart(2, '0');
      const monthNum = String(d.getMonth() + 1).padStart(2, '0');
      availableDays.push({ iso, weekDay: i === 0 ? 'HOJE' : weekDay, label: `${dayNum}/${monthNum}` });
    }

    content.innerHTML = `
      <div class="card" style="max-width: 700px; margin: 0 auto;">
        <h3 style="margin-bottom: 20px; color: #c59b27;">Novo Agendamento</h3>
        
        <div style="margin-bottom: 20px;">
          <label style="display:block; margin-bottom: 8px; font-weight: 500;">1. Escolha o serviço</label>
          <select id="serviceSelect" style="width: 100%; padding: 12px; background: #1a1a1a; border: 1px solid #333; color: #fff; border-radius: 8px;">
            <option value="">Selecione um serviço...</option>
            ${services.map(s => `<option value="${s.id}">${s.name} — ${formatPrice(s.price)} (${s.duration_minutes}min)</option>`).join('')}
          </select>
        </div>

        <div style="margin-bottom: 20px;">
          <label style="display:block; margin-bottom: 8px; font-weight: 500;">2. Escolha o profissional</label>
          <select id="barberSelect" style="width: 100%; padding: 12px; background: #1a1a1a; border: 1px solid #333; color: #fff; border-radius: 8px;">
            <option value="">Selecione um profissional...</option>
            ${barbers.map(b => `<option value="${b.id}">${b.name === 'Administrador' ? 'Júnior Soares' : b.name}</option>`).join('')}
          </select>
        </div>

        <div style="margin-bottom: 20px;">
          <label style="display:block; margin-bottom: 8px; font-weight: 500;">3. Escolha a data</label>
          <div id="dateCarousel" style="display: flex; gap: 10px; overflow-x: auto; padding-bottom: 8px; scrollbar-width: thin;">
            ${availableDays.map(d => `
              <button type="button" class="date-card ${d.iso === defaultDate ? 'selected' : ''}" data-date="${d.iso}" style="flex: 0 0 85px; padding: 12px 8px; background: ${d.iso === defaultDate ? '#c59b27' : '#1a1a1a'}; color: ${d.iso === defaultDate ? '#1a1a1a' : '#fff'}; border: 1px solid ${d.iso === defaultDate ? '#c59b27' : '#333'}; border-radius: 8px; cursor: pointer; text-align: center; transition: all 0.2s;">
                <div style="font-size: 11px; text-transform: uppercase; font-weight: 600; opacity: 0.8;">${d.weekDay}</div>
                <div style="font-size: 15px; font-weight: bold; margin-top: 4px;">${d.label}</div>
              </button>
            `).join('')}
          </div>
        </div>

        <div style="margin-bottom: 24px;">
          <label style="display:block; margin-bottom: 8px; font-weight: 500;">4. Escolha o horário</label>
          <div id="slotsWrap" class="slots" style="display: flex; flex-wrap: wrap; gap: 8px;"><span class="text-muted">Selecione serviço, barbeiro e data.</span></div>
        </div>

        <div class="flex-between" style="align-items: center; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 20px;">
          <p id="bookError" class="error-msg" style="color: #ff5252; margin: 0;"></p>
          <button id="confirmBtn" class="btn" disabled style="padding: 12px 24px;">Confirmar agendamento</button>
        </div>
      </div>
    `;

    const serviceSelect = document.getElementById('serviceSelect');
    const barberSelect = document.getElementById('barberSelect');
    const dateCarousel = document.getElementById('dateCarousel');
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
        wrap.innerHTML = slots.map(s => `<button type="button" class="slot-btn" data-slot="${s}" style="padding: 10px 16px; background: #1a1a1a; border: 1px solid #333; color: #fff; border-radius: 6px; cursor: pointer;">${s}</button>`).join('');
        
        wrap.querySelectorAll('.slot-btn').forEach(btn => {
          btn.onclick = () => {
            wrap.querySelectorAll('.slot-btn').forEach(b => {
              b.style.background = '#1a1a1a';
              b.style.borderColor = '#333';
              b.style.color = '#fff';
              b.classList.remove('selected');
            });
            btn.style.background = '#c59b27';
            btn.style.borderColor = '#c59b27';
            btn.style.color = '#1a1a1a';
            btn.classList.add('selected');
            state.booking.time = btn.dataset.slot;
            confirmBtn.disabled = false;
          };
        });
      } catch (err) {
        wrap.innerHTML = `<span class="error-msg">${err.message}</span>`;
      }
    }

    dateCarousel.querySelectorAll('.date-card').forEach(btn => {
      btn.onclick = () => {
        dateCarousel.querySelectorAll('.date-card').forEach(b => {
          b.style.background = '#1a1a1a';
          b.style.color = '#fff';
          b.style.borderColor = '#333';
          b.classList.remove('selected');
        });
        btn.style.background = '#c59b27';
        btn.style.color = '#1a1a1a';
        btn.style.borderColor = '#c59b27';
        btn.classList.add('selected');
        
        state.booking.date = btn.dataset.date;
        refreshSlots();
      };
    });

    serviceSelect.onchange = () => { state.booking.serviceId = serviceSelect.value || null; refreshSlots(); };
    barberSelect.onchange = () => { state.booking.barberId = barberSelect.value || null; refreshSlots(); };

    confirmBtn.onclick = async () => {
      const { serviceId, barberId, date, time } = state.booking;
      document.getElementById('bookError').textContent = '';
      try {
        const sId = Number(serviceId);
        const bId = Number(barberId);

        await api('/appointments', {
          method: 'POST',
          auth: true,
          body: { 
            serviceId: sId, 
            service_id: sId,
            barberId: bId, 
            barber_id: bId,
            date, 
            startTime: time,
            start_time: time,
            time: time
          },
        });

        toast('Horário agendado com sucesso!');

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
  content.innerHTML = '<p class="text-muted" style="text-align: center; padding: 40px;">Carregando seus agendamentos...</p>';
  try {
    const { appointments } = await api('/appointments/me', { auth: true });
    if (!appointments.length) {
      content.innerHTML = `
        <div class="card" style="max-width: 700px; margin: 0 auto; text-align: center; padding: 40px;">
          <h3 style="color: #c59b27; margin-bottom: 12px;">Nenhum agendamento encontrado</h3>
          <p class="text-muted" style="margin-bottom: 20px;">Você ainda não marcou nenhum horário conosco.</p>
          <button class="btn" onclick="document.querySelector('.tab[data-tab=\\'book\\']').click()">Fazer agendamento</button>
        </div>
      `;
      return;
    }

    content.innerHTML = `
      <div style="max-width: 700px; margin: 0 auto; display: flex; flex-direction: column; gap: 16px;">
        <h3 style="color: #c59b27; margin-bottom: 4px;">Meus Agendamentos</h3>
        ${appointments.map(a => {
          const isPending = a.status === 'agendado';
          const badgeColor = a.status === 'concluido' ? '#25D366' : (isPending ? '#c59b27' : '#ff5252');
          
          return `
            <div class="card" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px; background: #1a1a1a; border: 1px solid #333; padding: 20px; border-radius: 12px;">
              <div style="display: flex; gap: 16px; align-items: center;">
                <div style="background: rgba(197,155,39,0.1); border: 1px solid #c59b27; border-radius: 8px; padding: 10px 14px; text-align: center; min-width: 70px;">
                  <div style="font-size: 12px; color: #c59b27; font-weight: bold; text-transform: uppercase;">${a.start_time}</div>
                  <div style="font-size: 14px; color: #fff; margin-top: 2px; font-weight: 600;">${formatDate(a.date).slice(0, 5)}</div>
                </div>
                <div>
                  <h4 style="margin: 0 0 4px 0; font-size: 16px; color: #fff;">${a.service_name}</h4>
                  <p class="text-muted" style="margin: 0; font-size: 13px;">Profissional: <strong style="color: #ddd;">${a.barber_name === 'Administrador' ? 'Júnior Soares' : a.barber_name}</strong></p>
                  <p class="text-muted" style="margin: 2px 0 0 0; font-size: 13px;">Valor: <strong style="color: #c59b27;">${formatPrice(a.price)}</strong></p>
                </div>
              </div>

              <div style="display: flex; align-items: center; gap: 12px; margin-left: auto;">
                <span class="badge ${a.status}" style="background: ${badgeColor}22; color: ${badgeColor}; border: 1px solid ${badgeColor}; padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: 600; text-transform: uppercase;">
                  ${a.status}
                </span>
                ${isPending ? `<button class="btn small danger" data-cancel="${a.id}" style="background: transparent; border: 1px solid #ff5252; color: #ff5252; padding: 6px 12px; border-radius: 6px; cursor: pointer; transition: all 0.2s;">Cancelar</button>` : ''}
              </div>
            </div>
          `;
        }).join('')}
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
    try {
      const { services } = await api('/services');
      if (!services.length) {
        wrap.innerHTML = '<p class="empty-state">Nenhum serviço cadastrado.</p>';
        return;
      }
      wrap.innerHTML = `
        <h3>Serviços cadastrados</h3>
        <table>
          <thead><tr><th>Nome</th><th>Preço</th><th>Duração</th><th></th></tr></thead>
          <tbody>
            ${services.map(s => `
              <tr>
                <td><strong>${s.name}</strong><br><span class="text-muted" style="font-size:12px">${s.description || ''}</span></td>
                <td>${formatPrice(s.price)}</td>
                <td>${s.duration_minutes} min</td>
                <td><button class="btn small danger" data-del="${s.id}">Excluir</button></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
      wrap.querySelectorAll('[data-del]').forEach(btn => {
        btn.onclick = async () => {
          if (!confirm('Deseja excluir este serviço?')) return;
          try {
            await api(`/services/${btn.dataset.del}`, { method: 'DELETE', auth: true });
            toast('Serviço excluído.');
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

navigate();
