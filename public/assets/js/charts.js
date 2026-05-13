(function () {
  function applyChartDefaults() {
    if (!window.Chart) return false;
    Chart.defaults.font.family = 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
    Chart.defaults.color = getComputedStyle(document.documentElement).getPropertyValue('--slate-600').trim() || '#475569';
    Chart.defaults.borderColor = 'rgba(148, 163, 184, .22)';
    Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(15, 23, 42, .92)';
    Chart.defaults.plugins.tooltip.padding = 12;
    Chart.defaults.plugins.tooltip.cornerRadius = 8;
    return true;
  }

  function currency(value) {
    return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function dashboardCharts() {
    const root = document.querySelector('[data-dashboard-charts]');
    if (!root || !window.Chart) return;
    const payload = JSON.parse(root.dataset.dashboardCharts || '{}');

    const salesCanvas = document.getElementById('dashboardSalesChart');
    if (salesCanvas) {
      new Chart(salesCanvas, {
        type: 'line',
        data: {
          labels: payload.sales?.labels || [],
          datasets: [
            {
              label: 'Faturamento',
              data: payload.sales?.revenue || [],
              borderColor: '#0f8b72',
              backgroundColor: 'rgba(15,139,114,.14)',
              pointBackgroundColor: '#0f8b72',
              fill: true,
              tension: .32
            },
            {
              label: 'Pedidos',
              data: payload.sales?.orders || [],
              borderColor: '#2563eb',
              backgroundColor: 'rgba(37,99,235,.10)',
              pointBackgroundColor: '#2563eb',
              yAxisID: 'orders',
              tension: .32
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
              callbacks: {
                label: (context) => context.dataset.label === 'Faturamento'
                  ? `${context.dataset.label}: ${currency(context.parsed.y)}`
                  : `${context.dataset.label}: ${context.parsed.y}`
              }
            }
          },
          scales: {
            y: { beginAtZero: true },
            orders: { beginAtZero: true, position: 'right', grid: { drawOnChartArea: false }, ticks: { precision: 0 } },
            x: { grid: { display: false } }
          }
        }
      });
    }

    const productsCanvas = document.getElementById('dashboardProductsChart');
    if (productsCanvas) {
      new Chart(productsCanvas, {
        type: 'bar',
        data: {
          labels: payload.products?.labels || [],
          datasets: [{ label: 'Unidades', data: payload.products?.quantity || [], backgroundColor: '#0f8b72', borderRadius: 8 }]
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { beginAtZero: true, ticks: { precision: 0 } },
            y: { grid: { display: false } }
          }
        }
      });
    }
  }

  window.addEventListener('load', () => {
    applyChartDefaults();
    dashboardCharts();
  });
})();
