function adminToast(message, type = 'success') {
  if (window.toast) {
    window.toast(message, type);
    return;
  }

  let region = document.querySelector('.toast-region');
  if (!region) {
    region = document.createElement('div');
    region.className = 'toast-region';
    region.setAttribute('aria-live', 'polite');
    document.body.appendChild(region);
  }
  const item = document.createElement('div');
  item.className = `toast ${type}`;
  item.textContent = message;
  region.appendChild(item);
  window.setTimeout(() => item.remove(), 4200);
}

document.addEventListener('DOMContentLoaded', () => {
  const path = window.location.pathname.replace(/\/$/, '') || '/admin';
  document.querySelectorAll('.sidebar a[href]').forEach((link) => {
    const href = link.getAttribute('href')?.replace(/\/$/, '');
    if (href && (href === path || (href !== '/admin' && path.startsWith(href)))) {
      link.classList.add('is-active');
      link.setAttribute('aria-current', 'page');
    }
  });
});

function openAdminModal(id, trigger) {
  const modal = document.getElementById(id);
  if (!modal) return;

  const defaultRole = trigger?.dataset.defaultRole;
  if (defaultRole) {
    const role = modal.querySelector('[data-staff-role], select[name="role"]');
    if (role && Array.from(role.options).some((option) => option.value === defaultRole)) {
      role.value = defaultRole;
    }
  }

  modal.classList.add('is-open');
  modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');
  window.setTimeout(() => {
    modal.querySelector('input, select, textarea, button')?.focus();
  }, 40);
}

function closeAdminModals() {
  document.querySelectorAll('.modal.is-open').forEach((modal) => {
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
  });
  document.body.classList.remove('modal-open');
}

document.addEventListener('click', (event) => {
  const opener = event.target.closest('[data-open-modal]');
  if (opener) {
    event.preventDefault();
    openAdminModal(opener.dataset.openModal, opener);
    return;
  }

  if (event.target.closest('[data-modal-close]') || event.target.classList?.contains('modal-backdrop')) {
    event.preventDefault();
    closeAdminModals();
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    closeAdminModals();
  }
});

document.addEventListener('submit', async (event) => {
  const form = event.target.closest('[data-admin-status]');
  if (!form) return;
  event.preventDefault();

  const button = form.querySelector('button[type="submit"], button:not([type])');
  button?.classList.add('is-loading');
  if (button) button.disabled = true;

  const response = await fetch(form.action, {
    method: 'POST',
    headers: { 'Accept': 'application/json' },
    body: new FormData(form)
  });
  const data = await response.json().catch(() => ({}));

  button?.classList.remove('is-loading');
  if (button) button.disabled = false;
  adminToast(data.ok ? 'Pedido atualizado e registrado na timeline.' : (data.error || 'Falha ao atualizar pedido.'), data.ok ? 'success' : 'error');
  if (data.ok && (data.reload || form.dataset.reloadOnSuccess === 'true')) {
    window.setTimeout(() => window.location.reload(), 450);
  }
});

document.addEventListener('submit', (event) => {
  const form = event.target.closest('[data-staff-form]');
  if (!form) return;

  const password = form.querySelector('input[name="password"]');
  const confirmation = form.querySelector('input[name="password_confirmation"]');
  if (password && confirmation && password.value !== confirmation.value) {
    event.preventDefault();
    confirmation.setCustomValidity('Confirmacao de senha nao confere.');
    confirmation.reportValidity();
    adminToast('Confirmacao de senha nao confere.', 'error');
    return;
  }
  confirmation?.setCustomValidity('');
});

document.addEventListener('input', (event) => {
  const field = event.target;
  if (!(field instanceof HTMLInputElement)) return;

  if (field.dataset.mask === 'cpf') {
    const digits = field.value.replace(/\D/g, '').slice(0, 11);
    field.value = digits
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  }

  if (field.dataset.mask === 'cep') {
    const digits = field.value.replace(/\D/g, '').slice(0, 8);
    field.value = digits.replace(/(\d{5})(\d)/, '$1-$2');
  }

  if (field.dataset.mask === 'phone') {
    const digits = field.value.replace(/\D/g, '').slice(0, 11);
    field.value = digits
      .replace(/^(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{5})(\d{1,4})$/, '$1-$2');
  }
});

window.addEventListener('load', () => {
  const canvas = document.getElementById('revenueChart');
  if (!canvas || !window.Chart) return;

  const series = JSON.parse(canvas.dataset.series || '[]').reverse();
  new Chart(canvas, {
    type: 'line',
    data: {
      labels: series.map(item => item.sale_date),
      datasets: [
        {
          label: 'Faturamento',
          data: series.map(item => Number(item.approved_revenue || 0)),
          borderColor: '#0f8b72',
          backgroundColor: 'rgba(15,139,114,.14)',
          pointBackgroundColor: '#0f8b72',
          tension: .28,
          fill: true
        },
        {
          label: 'Pedidos',
          data: series.map(item => Number(item.order_count || 0)),
          borderColor: '#2563eb',
          backgroundColor: 'rgba(37,99,235,.10)',
          pointBackgroundColor: '#2563eb',
          tension: .28,
          yAxisID: 'orders'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { labels: { usePointStyle: true, boxWidth: 8 } },
        tooltip: { padding: 12, displayColors: true }
      },
      scales: {
        y: { beginAtZero: true, grid: { color: 'rgba(148,163,184,.22)' } },
        orders: { beginAtZero: true, position: 'right', grid: { drawOnChartArea: false } },
        x: { grid: { display: false } }
      }
    }
  });
});

window.addEventListener('load', () => {
  const root = document.querySelector('[data-report-charts]');
  if (!root || !window.Chart) return;

  const payload = JSON.parse(root.dataset.reportCharts || '{}');
  const palette = ['#0f8b72', '#2563eb', '#b45309', '#7c3aed', '#047857', '#b42318', '#64748b', '#0891b2'];
  const currency = (value) => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const volumeCanvas = document.getElementById('reportVolumeChart');
  if (volumeCanvas) {
    new Chart(volumeCanvas, {
      type: 'line',
      data: {
        labels: payload.series?.labels || [],
        datasets: [
          {
            label: 'Pedidos',
            data: payload.series?.orders || [],
            borderColor: '#2563eb',
            backgroundColor: 'rgba(37,99,235,.10)',
            pointBackgroundColor: '#2563eb',
            tension: .28,
            yAxisID: 'orders'
          },
          {
            label: 'Receita aprovada',
            data: payload.series?.revenue || [],
            borderColor: '#0f8b72',
            backgroundColor: 'rgba(15,139,114,.14)',
            pointBackgroundColor: '#0f8b72',
            tension: .28,
            fill: true
          },
          {
            label: 'Com receita',
            data: payload.series?.prescriptions || [],
            borderColor: '#b45309',
            backgroundColor: 'rgba(180,83,9,.08)',
            pointBackgroundColor: '#b45309',
            tension: .28,
            yAxisID: 'orders'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { labels: { usePointStyle: true, boxWidth: 8 } },
          tooltip: {
            padding: 12,
            callbacks: {
              label: (context) => context.dataset.label.includes('Receita')
                ? `${context.dataset.label}: ${currency(context.parsed.y)}`
                : `${context.dataset.label}: ${context.parsed.y}`
            }
          }
        },
        scales: {
          y: { beginAtZero: true, grid: { color: 'rgba(148,163,184,.22)' } },
          orders: { beginAtZero: true, position: 'right', grid: { drawOnChartArea: false } },
          x: { grid: { display: false } }
        }
      }
    });
  }

  const doughnut = (id, chartData, label) => {
    const canvas = document.getElementById(id);
    if (!canvas) return;
    new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: chartData?.labels || [],
        datasets: [{ label, data: chartData?.counts || [], backgroundColor: palette, borderWidth: 2, borderColor: '#ffffff' }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '64%',
        plugins: {
          legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8 } },
          tooltip: { padding: 12 }
        }
      }
    });
  };

  doughnut('paymentMixChart', payload.payments, 'Pagamentos');
  doughnut('prescriptionOutcomeChart', payload.prescriptions, 'Receitas');

  const statusCanvas = document.getElementById('statusDistributionChart');
  if (statusCanvas) {
    new Chart(statusCanvas, {
      type: 'bar',
      data: {
        labels: payload.statuses?.labels || [],
        datasets: [{ label: 'Pedidos', data: payload.statuses?.counts || [], backgroundColor: '#0f8b72', borderRadius: 8 }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { padding: 12 } },
        scales: {
          y: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: 'rgba(148,163,184,.22)' } },
          x: { grid: { display: false } }
        }
      }
    });
  }
});
