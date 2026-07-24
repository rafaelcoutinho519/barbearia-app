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
        
        // Pega as informações do agendamento antes de apagar
        const apptId = parseInt(btn.dataset.cancel, 10);
        const appt = appointments.find(a => a.id === apptId);

        try {
          await api(`/appointments/${apptId}`, { method: 'DELETE', auth: true });
          toast('Agendamento cancelado.');

          // ---------- Notificação de Cancelamento via WhatsApp ----------
          const barberPhone = '5587996289373'; // Seu número de WhatsApp aqui
          
          let cancelMsg = `⚠️ *CANCELAMENTO DE AGENDAMENTO*%0A%0A` +
                            `O cliente *${state.user ? state.user.name : 'Cliente'}* cancelou um agendamento.`;

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
