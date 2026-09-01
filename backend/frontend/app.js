// ---------- Estado global ----------
const state = {
  token: localStorage.getItem('token') || null,
  user: JSON.parse(localStorage.getItem('user') || 'null'),
  booking: { serviceId: null, barberId: null, date: null, time: null },
};

const appEl = document.getElementById('app');
const navEl = document.getElementById('nav');
const yearEl = document.getElementById('year');
if (yearEl) yearEl.textContent = new Date().getFullYear();

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
  if (!el) return;
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
  if (!d) return '';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

// ---------- Catálogo Padrão de Cortes (Para os 3 Barbeiros) ----------
const catalogCuts = [
  {
    title: "Corte Degradê",
    desc: "É o estilo de cabelo masculino mais pedido nas barbearias atualmente, caracterizado por uma transição suave de comprimento onde o cabelo começa bem curto ou raspado na base e vai aumentando de tamanho até o topo.",
    img: "2 degrade.jpeg"
  },
  {
    title: "Corte Americano",
    desc: "Sua principal característica é a preservação do volume do topo do cabelo enquanto o degradê é feito de forma concentrada apenas nas costeletas e na nuca.",
    img: "americano.jpeg"
  },
  {
    title: "Social Moderno",
    desc: "O estilo social moderno reinterpreta a alfaiataria clássica trazendo mais leveza, conforto e personalidade para o visual masculino.",
    img: "social.jpeg"
  }
];

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
    links.push(`<button id="logoutBtn" class="btn small" style="background:#333; color:#fff;">Sair</button>`);
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
    <section class="hero" style="text-align: center; padding: 60px 20px;">
      <div style="max-width: 140px; margin: 0 auto 20px;">
        <img src="logo.png" alt="Brooklyn Barbearia Logo" style="width: 100%; height: auto; filter: drop-shadow(0 4px 12px rgba(197,155,39,0.3));" />
      </div>
      <h1 style="color: #c59b27; letter-spacing: 2px; margin-bottom: 12px;">BROOKLYN BARBEARIA</h1>
      <p style="max-width: 600px; margin: 0 auto 24px; color: #aaa; line-height: 1.6;">Cortes precisos, barba na navalha e um atendimento à altura. Escolha seu profissional favorito e agende seu horário em menos de um minuto.</p>
      <a href="#${state.user && state.user.role === 'client' ? 'dashboard' : (state.user ? 'barber' : 'register')}" class="btn" style="background: #c59b27; color: #1a1a1a; font-weight: bold; padding: 12px 30px; border-radius: 8px; text-decoration: none; display: inline-block;">Agendar horário</a>
    </section>
    
    <h2 class="section-title" style="text-align: center; margin: 40px 0 20px; color: #fff;">Nossos serviços</h2>
    <div id="servicesList" class="grid cols-3" style="max-width: 1000px; margin: 0 auto; padding: 0 20px; gap: 20px;"><p class="text-muted" style="text-align:center; grid-column: span 3;">Carregando...</p></div>
  `;
  try {
    const { services } = await api('/services');
    const list = document.getElementById('servicesList');
    if (!services.length) {
      list.innerHTML = '<p class="empty-state" style="grid-column: span 3; text-align:center;">Nenhum serviço cadastrado no momento.</p>';
      return;
    }
    list.innerHTML = services.map(s => `
      <div class="card service-card" style="cursor: pointer; background: #1a1a1a; border: 1px solid #333; padding: 24px; border-radius: 12px; transition: transform 0.2s, border-color 0.2s;" onclick="location.hash = '${state.user && state.user.role === 'client' ? 'dashboard' : 'login'}'">
        <h3 style="color: #fff; margin-bottom: 8px;">${s.name}</h3>
        <p class="text-muted" style="min-height:36px; font-size: 14px; color: #888; margin-bottom: 16px;">${s.description || ''}</p>
        <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 12px;">
          <div class="price" style="color: #c59b27; font-weight: bold; font-size: 16px;">${formatPrice(s.price)}</div>
          <div class="meta" style="font-size: 13px; color: #666;">⏱ ${s.duration_minutes} min</div>
        </div>
      </div>
    `).join('');
  } catch (err) {
    document.getElementById('servicesList').innerHTML = `<p class="error-msg" style="text-align:center; grid-column: span 3; color: #ff5252;">${err.message}</p>`;
  }
}

// ---------- Conheça Nossos 3 Profissionais (Com Galeria Interativa Padrão) ----------
function renderProfessionals() {
  const barbersData = [
    {
      id: 1,
      name: "Júnior Soares",
      role: "Barbeiro Master & Fundador",
      photo: "01.jpeg",
      insta: "https://www.instagram.com/juniores_silva?igsh=ajJ4cW1mNWQ2NnBr",
      whatsapp: "https://wa.me/5587996289373",
      bio: "Especialista em cortes modernos, clássicos, barba na navalha e visagismo. Anos de experiência dedicados a elevar o padrão do atendimento e garantir a satisfação de cada cliente."
    },
    {
      id: 2,
      name: "Carlos Silva",
      role: "Barbeiro Estilista",
      photo: "01.jpeg", // Placeholder provisório até enviar foto real
      insta: "#",
      whatsapp: "#",
      bio: "Focado em degradês perfeitos, texturização e acabamento impecável na navalha. Atendimento dinâmico e focado nas tendências atuais."
    },
    {
      id: 3,
      name: "Lucas Mendes",
      role: "Barbeiro & Visagista",
      photo: "01.jpeg", // Placeholder provisório até enviar foto real
      insta: "#",
      whatsapp: "#",
      bio: "Especialista em alinhamento de barba, tratamentos capilares e cortes clássicos executados com precisão cirúrgica."
    }
  ];

  appEl.innerHTML = `
    <section class="hero" style="text-align: center; padding: 40px 20px;">
      <h1 style="color: #c59b27; letter-spacing: 1px;">NOSSOS PROFISSIONAIS</h1>
      <p style="color: #aaa; max-width: 600px; margin: 8px auto 0;">Conheça nossa equipe de especialistas. Escolha seu barbeiro e confira o catálogo de cortes padrão disponível para todos eles.</p>
    </section>

    <div style="max-width: 900px; margin: 0 auto; padding: 0 20px; display: flex; flex-direction: column; gap: 40px;">
      ${barbersData.map(b => `
        <div class="card" style="background: #1a1a1a; border: 1px solid #333; border-radius: 12px; padding: 30px;">
          <div style="display: flex; gap: 24px; flex-wrap: wrap; align-items: center;">
            <div style="flex: 1; min-width: 220px; text-align: center;">
              <div style="width: 140px; height: 140px; border-radius: 50%; overflow: hidden; margin: 0 auto 16px; border: 3px solid #c59b27; box-shadow: 0 4px 10px rgba(0,0,0,0.3);">
                <img src="${b.photo}" alt="${b.name}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.src='https://via.placeholder.com/150?text=Barber'" />
              </div>
              <h2 style="margin-bottom: 4px; color: #fff; font-size: 20px;">${b.name}</h2>
              <p class="text-muted" style="margin-bottom: 16px; color: #c59b27; font-size: 13px; font-weight: 500;">${b.role}</p>
              
              <div style="display: flex; gap: 8px; justify-content: center;">
                <a href="${b.insta}" target="_blank" class="btn small" style="background: #E1306C; color: #fff; text-decoration: none; padding: 6px 12px; border-radius: 6px; font-size: 12px;">Instagram</a>
                <a href="${b.whatsapp}" target="_blank" class="btn small" style="background: #25D366; color: #fff; text-decoration: none; padding: 6px 12px; border-radius: 6px; font-size: 12px;">WhatsApp</a>
              </div>
            </div>

            <div style="flex: 2; min-width: 280px;">
              <h3 style="color: #fff; font-size: 16px; margin-bottom: 8px;">Sobre o profissional</h3>
              <p class="text-muted" style="color: #999; line-height: 1.6; font-size: 14px;">${b.bio}</p>
              <div style="margin-top: 20px;">
                <a href="#${state.user && state.user.role === 'client' ? 'dashboard' : 'register'}" class="btn" style="background: #c59b27; color: #1a1a1a; padding: 10px 20px; border-radius: 6px; font-weight: bold; text-decoration: none; display: inline-block;">Agendar com ${b.name.split(' ')[0]}</a>
              </div>
            </div>
          </div>

          <h4 style="margin-top: 30px; margin-bottom: 16px; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 20px; color: #fff; font-size: 15px;">Modelos de Corte Disponíveis</h4>
          
          <div class="grid cols-3" style="gap: 16px;">
            ${catalogCuts.map(cut => `
              <div class="gallery-item" data-title="${cut.title}" data-desc="${cut.desc}" style="background: #111; border-radius: 8px; overflow: hidden; border: 1px solid #282828; text-align: center; cursor: pointer; transition: transform 0.3s ease, border-color 0.3s ease;">
                <div style="height: 140px; overflow: hidden;">
                  <img src="${cut.img}" alt="${cut.title}" style="width: 100%; height: 100%; object-fit: cover; transition: transform 0.4s ease;" class="gallery-img" onerror="this.style.display='none'" />
                </div>
                <div style="padding: 10px; font-weight: 500; font-size: 13px; color: #fff;">${cut.title}</div>
              </div>
            `).join('')}
          </div>
        </div>
      `).join('')}
    </div>
  `;

  // Listener para abrir o modal de detalhes de cada corte em qualquer card de barbeiro
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
    <div class="auth-wrap card" style="background: #1a1a1a; border: 1px solid #333; max-width: 400px; margin: 40px auto; padding: 30px; border-radius: 12px;">
      <h2 style="color: #fff; margin-bottom: 8px;">Entrar</h2>
      <p class="text-muted" style="margin-bottom: 20px; font-size: 13px; color: #888;">Informe seu telefone. Se não tiver conta, criaremos uma automaticamente para você!</p>
      <form id="loginForm">
        <div style="margin-bottom: 16px;">
          <label style="display: block; margin-bottom: 6px; font-size: 13px; color: #ccc;">Telefone</label>
          <input type="tel" name="phone" placeholder="(00) 00000-0000" required style="width: 100%; padding: 10px; background: #111; border: 1px solid #333; color: #fff; border-radius: 6px;" />
        </div>
        <p id="loginError" class="error-msg" style="color: #ff5252; font-size: 13px; margin-bottom: 12px;"></p>
        <button class="btn" type="submit" style="width: 100%; background: #c59b27; color: #1a1a1a; font-weight: bold; padding: 12px; border-radius: 6px; border: none; cursor: pointer;">Entrar / Cadastrar</button>
      </form>
      <p class="auth-switch" style="text-align: center; margin-top: 16px; font-size: 13px; color: #888;">Prefere cadastrar com nome? <a href="#register" style="color: #c59b27; text-decoration: none;">Criar conta completa</a></p>
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
    <div class="auth-wrap card" style="background: #1a1a1a; border: 1px solid #333; max-width: 400px; margin: 40px auto; padding: 30px; border-radius: 12px;">
      <h2 style="color: #fff; margin-bottom: 8px;">Criar conta</h2>
      <p class="text-muted" style="margin-bottom: 20px; font-size: 13px; color: #888;">Rápido e fácil, informe seu nome e telefone.</p>
      <form id="registerForm">
        <div style="margin-bottom: 16px;">
          <label style="display: block; margin-bottom: 6px; font-size: 13px; color: #ccc;">Nome completo</label>
          <input type="text" name="name" required style="width: 100%; padding: 10px; background: #111; border: 1px solid #333; color: #fff; border-radius: 6px;" />
        </div>
        <div style="margin-bottom: 16px;">
          <label style="display: block; margin-bottom: 6px; font-size: 13px; color: #ccc;">Telefone</label>
          <input type="tel" name="phone" placeholder="(00) 00000-0000" required style="width: 100%; padding: 10px; background: #111; border: 1px solid #333; color: #fff; border-radius: 6px;" />
        </div>
        <p id="registerError" class="error-msg" style="color: #ff5252; font-size: 13px; margin-bottom: 12px;"></p>
        <button class="btn" type="submit" style="width: 100%; background: #c59b27; color: #1a1a1a; font-weight: bold; padding: 12px; border-radius: 6px; border: none; cursor: pointer;">Criar conta</button>
      </form>
      <p class="auth-switch" style="text-align: center; margin-top: 16px; font-size: 13px; color: #888;">Já tem conta? <a href="#login" style="color: #c59b27; text-decoration: none;">Entrar</a></p>
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
    <div class="tabs" style="display: flex; justify-content: center; gap: 10px; margin-bottom: 20px;">
      <div class="tab active" data-tab="book" style="padding: 10px 20px; cursor: pointer; border-bottom: 2px solid #c59b27; font-weight: bold; color: #c59b27;">Agendar horário</div>
      <div class="tab" data-tab="mine" style="padding: 10px 20px; cursor: pointer; color: #888;">Meus agendamentos</div>
    </div>
    <div id="tabContent"></div>
  `;
  const tabs = appEl.querySelectorAll('.tab');
  tabs.forEach(t => t.onclick = () => {
    tabs.forEach(x => {
      x.classList.remove('active');
      x.style.color = '#888';
      x.style.borderBottom = 'none';
    });
    t.classList.add('active');
    t.style.color = '#c59b27';
    t.style.borderBottom = '2px solid #c59b27';
    if (t.dataset.tab === 'book') renderBookingFlow();
    else renderMyAppointments();
  });
  renderBookingFlow();
}

async function renderBookingFlow() {
  const content = document.getElementById('tabContent');
  content.innerHTML = `<p class="text-muted" style="text-align:center; padding: 40px;">Carregando serviços e barbeiros...</p>`;
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
      <div class="card" style="max-width: 700px; margin: 0 auto; background: #1a1a1a; border: 1px solid #333; padding: 30px; border-radius: 12px;">
        <h3 style="margin-bottom: 20px; color: #c59b27;">Novo Agendamento</h3>
        
        <div style="margin-bottom: 20px;">
          <label style="display:block; margin-bottom: 8px; font-weight: 500; font-size: 14px; color: #ccc;">1. Escolha o serviço</label>
          <select id="serviceSelect" style="width: 100%; padding: 12px; background: #111; border: 1px solid #333; color: #fff; border-radius: 8px;">
            <option value="">Selecione um serviço...</option>
            ${services.map(s => `<option value="${s.id}">${s.name} — ${formatPrice(s.price)} (${s.duration_minutes}min)</option>`).join('')}
          </select>
        </div>

        <div style="margin-bottom: 20px;">
          <label style="display:block; margin-bottom: 8px; font-weight: 500; font-size: 14px; color: #ccc;">2. Escolha o profissional (3 Barbeiros Disponíveis)</label>
          <select id="barberSelect" style="width: 100%; padding: 12px; background: #111; border: 1px solid #333; color: #fff; border-radius: 8px;">
            <option value="">Selecione um profissional...</option>
            ${barbers.map(b => {
              let niceName = b.name;
              if (b.name === 'Administrador') niceName = 'Júnior Soares';
              return `<option value="${b.id}">${niceName}</option>`;
            }).join('')}
          </select>
        </div>

        <div style="margin-bottom: 20px;">
          <label style="display:block; margin-bottom: 8px; font-weight: 500; font-size: 14px; color: #ccc;">3. Escolha a data</label>
          <div id="dateCarousel" style="display: flex; gap: 10px; overflow-x: auto; padding-bottom: 8px; scrollbar-width: thin;">
            ${availableDays.map(d => `
              <button type="button" class="date-card ${d.iso === defaultDate ? 'selected' : ''}" data-date="${d.iso}" style="flex: 0 0 85px; padding: 12px 8px; background: ${d.iso === defaultDate ? '#c59b27' : '#111'}; color: ${d.iso === defaultDate ? '#1a1a1a' : '#fff'}; border: 1px solid ${d.iso === defaultDate ? '#c59b27' : '#333'}; border-radius: 8px; cursor: pointer; text-align: center; transition: all 0.2s;">
                <div style="font-size: 11px; text-transform: uppercase; font-weight: 600; opacity: 0.8;">${d.weekDay}</div>
                <div style="font-size: 15px; font-weight: bold; margin-top: 4px;">${d.label}</div>
              </button>
            `).join('')}
          </div>
        </div>

        <div style="margin-bottom: 24px;">
          <label style="display:block; margin-bottom: 8px; font-weight: 500; font-size: 14px; color: #ccc;">4. Escolha o horário</label>
          <div id="slotsWrap" class="slots" style="display: flex; flex-wrap: wrap; gap: 8px;"><span class="text-muted" style="color: #666; font-size: 13px;">Selecione serviço, barbeiro e data.</span></div>
        </div>

        <div class="flex-between" style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 20px;">
          <p id="bookError" class="error-msg" style="color: #ff5252; margin: 0; font-size: 13px;"></p>
          <button id="confirmBtn" class="btn" disabled style="padding: 12px 24px; background: #c59b27; color: #1a1a1a; font-weight: bold; border-radius: 8px; border: none; cursor: pointer; opacity: 0.5;">Confirmar agendamento</button>
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
      confirmBtn.style.opacity = '0.5';
      state.booking.time = null;
      if (!serviceId || !barberId || !date) {
        wrap.innerHTML = '<span class="text-muted" style="color: #666; font-size: 13px;">Selecione serviço, barbeiro e data.</span>';
        return;
      }
      wrap.innerHTML = '<span class="text-muted" style="color: #888; font-size: 13px;">Carregando horários...</span>';
      try {
        const { slots } = await api(`/appointments/available?barberId=${barberId}&date=${date}&serviceId=${serviceId}`);
        if (!slots.length) {
          wrap.innerHTML = '<span class="text-muted" style="color: #888; font-size: 13px;">Nenhum horário disponível nesta data.</span>';
          return;
        }
        wrap.innerHTML = slots.map(s => `<button type="button" class="slot-btn" data-slot="${s}" style="padding: 10px 16px; background: #111; border: 1px solid #333; color: #fff; border-radius: 6px; cursor: pointer;">${s}</button>`).join('');
        
        wrap.querySelectorAll('.slot-btn').forEach(btn => {
          btn.onclick = () => {
            wrap.querySelectorAll('.slot-btn').forEach(b => {
              b.style.background = '#111';
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
            confirmBtn.style.opacity = '1';
          };
        });
      } catch (err) {
        wrap.innerHTML = `<span class="error-msg" style="color: #ff5252; font-size: 13px;">${err.message}</span>`;
      }
    }

    dateCarousel.querySelectorAll('.date-card').forEach(btn => {
      btn.onclick = () => {
        dateCarousel.querySelectorAll('.date-card').forEach(b => {
          b.style.background = '#111';
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

        // Mantido o WhatsApp de teste configurado inicialmente para o seu número
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
    content.innerHTML = `<p class="error-msg" style="text-align:center; color:#ff5252;">${err.message}</p>`;
  }
}

async function renderMyAppointments() {
  const content = document.getElementById('tabContent');
  content.innerHTML = '<p class="text-muted" style="text-align: center; padding: 40px; color: #888;">Carregando seus agendamentos...</p>';
  try {
    const { appointments } = await api('/appointments/me', { auth: true });
    if (!appointments.length) {
      content.innerHTML = `
        <div class="card" style="max-width: 700px; margin: 0 auto; text-align: center; padding: 40px; background: #1a1a1a; border: 1px solid #333; border-radius: 12px;">
          <h3 style="color: #c59b27; margin-bottom: 12px;">Nenhum agendamento encontrado</h3>
          <p class="text-muted" style="margin-bottom: 20px; color: #888; font-size: 14px;">Você ainda não marcou nenhum horário conosco.</p>
          <button class="btn" style="background: #c59b27; color: #1a1a1a; font-weight: bold; padding: 10px 20px; border-radius: 6px; border: none; cursor: pointer;" onclick="document.querySelector('.tab[data-tab=\\'book\\']').click()">Fazer agendamento</button>
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
          let barberDisplayName = a.barber_name;
          if (barberDisplayName === 'Administrador') barberDisplayName = 'Júnior Soares';
          
          return `
            <div class="card" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px; background: #1a1a1a; border: 1px solid #333; padding: 20px; border-radius: 12px;">
              <div style="display: flex; gap: 16px; align-items: center;">
                <div style="background: rgba(197,155,39,0.1); border: 1px solid #c59b27; border-radius: 8px; padding: 10px 14px; text-align: center; min-width: 70px;">
                  <div style="font-size: 12px; color: #c59b27; font-weight: bold; text-transform: uppercase;">${a.start_time}</div>
                  <div style="font-size: 14px; color: #fff; margin-top: 2px; font-weight: 600;">${formatDate(a.date).slice(0, 5)}</div>
                </div>
                <div>
                  <h4 style="margin: 0 0 4px 0; font-size: 16px; color: #fff;">${a.service_name}</h4>
                  <p class="text-muted" style="margin: 0; font-size: 13px; color: #888;">Profissional: <strong style="color: #ddd;">${barberDisplayName}</strong></p>
                  <p class="text-muted" style="margin: 2px 0 0 0; font-size: 13px; color: #888;">Valor: <strong style="color: #c59b27;">${formatPrice(a.price)}</strong></p>
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
    content.innerHTML = `<p class="error-msg" style="text-align:center; color:#ff5252;">${err.message}</p>`;
  }
}

// ---------- Painel do barbeiro ----------
async function renderBarberDashboard() {
  appEl.innerHTML = `
    <div class="tabs" style="display: flex; justify-content: center; gap: 10px; margin-bottom: 20px;">
      <div class="tab active" data-tab="agenda" style="padding: 10px 20px; cursor: pointer; border-bottom: 2px solid #c59b27; font-weight: bold; color: #c59b27;">Agenda</div>
      <div class="tab" data-tab="services" style="padding: 10px 20px; cursor: pointer; color: #888;">Serviços e preços</div>
    </div>
    <div id="tabContent"></div>
  `;
  const tabs = appEl.querySelectorAll('.tab');
  tabs.forEach(t => t.onclick = () => {
    tabs.forEach(x => {
      x.classList.remove('active');
      x.style.color = '#888';
      x.style.borderBottom = 'none';
    });
    t.classList.add('active');
    t.style.color = '#c59b27';
    t.style.borderBottom = '2px solid #c59b27';
    if (t.dataset.tab === 'agenda') renderAgenda();
    else renderServicesAdmin();
  });
  renderAgenda();
}

async function renderAgenda() {
  const content = document.getElementById('tabContent');
  content.innerHTML = `
    <div class="card" style="max-width: 800px; margin: 0 auto; background: #1a1a1a; border: 1px solid #333; padding: 24px; border-radius: 12px;">
      <div class="flex-between" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
        <label style="margin:0; font-weight: bold; color: #fff;">Data da Agenda</label>
        <input type="date" id="agendaDate" value="${todayISO()}" style="max-width:200px; padding: 8px; background: #111; border: 1px solid #333; color: #fff; border-radius: 6px;" />
      </div>
      <div id="agendaList" class="mt-16"><p class="text-muted" style="color: #888; text-align: center; padding: 20px;">Carregando...</p></div>
    </div>
  `;
  const dateInput = document.getElementById('agendaDate');
  async function load() {
    const list = document.getElementById('agendaList');
    list.innerHTML = '<p class="text-muted" style="color: #888; text-align: center; padding: 20px;">Carregando...</p>';
    try {
      const { appointments } = await api(`/appointments/agenda?date=${dateInput.value}`, { auth: true });
      if (!appointments.length) {
        list.innerHTML = '<div class="empty-state" style="color: #888; text-align: center; padding: 20px;">Nenhum agendamento para esta data.</div>';
        return;
      }
      list.innerHTML = `
        <div style="overflow-x: auto;">
          <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 14px;">
            <thead>
              <tr style="border-bottom: 1px solid #333; color: #c59b27;">
                <th style="padding: 10px;">Horário</th>
                <th style="padding: 10px;">Cliente</th>
                <th style="padding: 10px;">Telefone</th>
                <th style="padding: 10px;">Serviço</th>
                <th style="padding: 10px;">Valor</th>
                <th style="padding: 10px;">Status</th>
                <th style="padding: 10px;"></th>
              </tr>
            </thead>
            <tbody>
              ${appointments.map(a => `
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.05); color: #ccc;">
                  <td style="padding: 10px;">${a.start_time} - ${a.end_time}</td>
                  <td style="padding: 10px; color: #fff; font-weight: 500;">${a.client_name}</td>
                  <td style="padding: 10px;">${a.client_phone || '-'}</td>
                  <td style="padding: 10px;">${a.service_name}</td>
                  <td style="padding: 10px; color: #c59b27;">${formatPrice(a.price)}</td>
                  <td style="padding: 10px;"><span class="badge ${a.status}" style="font-size: 11px; padding: 2px 8px; border-radius: 10px; text-transform: uppercase;">${a.status}</span></td>
                  <td style="padding: 10px; text-align: right;">
                    ${a.status === 'agendado' ? `
                      <button class="btn small" data-status="concluido" data-id="${a.id}" style="background: #25D366; color: #fff; border: none; padding: 6px 10px; border-radius: 4px; cursor: pointer; font-size: 12px; margin-right: 4px;">Concluir</button>
                      <button class="btn small danger" data-status="cancelado" data-id="${a.id}" style="background: #ff5252; color: #fff; border: none; padding: 6px 10px; border-radius: 4px; cursor: pointer; font-size: 12px;">Cancelar</button>
                    ` : ''}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
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
      list.innerHTML = `<p class="error-msg" style="color: #ff5252; text-align: center; padding: 20px;">${err.message}</p>`;
    }
  }
  dateInput.onchange = load;
  load();
}

async function renderServicesAdmin() {
  const content = document.getElementById('tabContent');
  content.innerHTML = `
    <div class="card" style="max-width: 700px; margin: 0 auto; background: #1a1a1a; border: 1px solid #333; padding: 24px; border-radius: 12px;">
      <h3 style="color: #c59b27; margin-bottom: 16px;">Gerenciar Serviços</h3>
      <p style="color: #888; font-size: 13px;">Painel de controle para ajuste de serviços e valores oferecidos no sistema.</p>
    </div>
  `;
}
