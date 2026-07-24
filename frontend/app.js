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
        await api('/appointments', {
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
        document.querySelector('.tab[data-tab="mine"]').click();
      } catch (err) {
        document.getElementById('bookError').textContent = err.message;
      }
    };
  } catch (err) {
    content.innerHTML = `<p class="error-msg">${err.message}</p>`;
  }
}
