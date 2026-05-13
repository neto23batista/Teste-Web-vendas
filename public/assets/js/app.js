const csrf = document.querySelector('meta[name="csrf-token"]')?.content || '';

function toast(message, type = 'success') {
  let region = document.querySelector('.toast-region');
  if (!region) {
    region = document.createElement('div');
    region.className = 'toast-region';
    region.setAttribute('aria-live', 'polite');
    region.setAttribute('aria-atomic', 'true');
    document.body.appendChild(region);
  }

  const item = document.createElement('div');
  item.className = `toast ${type}`;
  item.textContent = message;
  region.appendChild(item);
  window.setTimeout(() => item.remove(), 4200);
}

async function postForm(url, data) {
  const body = new FormData();
  body.append('_csrf', csrf);
  Object.entries(data).forEach(([key, value]) => body.append(key, value));
  const response = await fetch(url, { method: 'POST', headers: { 'Accept': 'application/json' }, body });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok && !payload.error) {
    payload.error = 'Nao foi possivel concluir a acao. Tente novamente.';
  }
  return payload;
}

function setLoading(button, loading) {
  if (!button) return;
  button.classList.toggle('is-loading', loading);
  button.disabled = loading;
}

function formatCount(count) {
  const total = Number(count || 0);
  return total === 1 ? '1 item' : `${total} itens`;
}

document.addEventListener('click', async (event) => {
  const add = event.target.closest('.add-cart');
  if (add) {
    event.preventDefault();
    setLoading(add, true);
    const result = await postForm('/sacola/adicionar', { product_id: add.dataset.productId, quantity: 1 });
    setLoading(add, false);
    if (result.ok) {
      document.querySelectorAll('[data-cart-count]').forEach((node) => {
        node.textContent = formatCount(result.summary?.count);
      });
      toast('Produto adicionado a sacola.', 'success');
    } else {
      toast(result.error || 'Produto indisponivel.', 'error');
    }
  }

  const remove = event.target.closest('.remove-cart');
  if (remove) {
    event.preventDefault();
    if (!window.confirm('Remover este item da sacola?')) return;
    setLoading(remove, true);
    const result = await postForm('/sacola/remover', { item_id: remove.dataset.itemId });
    if (result.ok) {
      location.reload();
    } else {
      setLoading(remove, false);
      toast(result.error || 'Nao foi possivel remover o item.', 'error');
    }
  }

  const quick = event.target.closest('[data-quick-view]');
  if (quick) {
    event.preventDefault();
    openQuickView(quick);
  }

  const close = event.target.closest('[data-modal-close]');
  if (close) {
    event.preventDefault();
    closeModal();
  }
});

document.addEventListener('change', async (event) => {
  if (event.target.matches('.qty-input')) {
    const input = event.target;
    input.value = Math.max(1, Number(input.value || 1));
    input.disabled = true;
    const result = await postForm('/sacola/atualizar', { item_id: input.dataset.itemId, quantity: input.value });
    if (result.ok) {
      location.reload();
    } else {
      input.disabled = false;
      toast(result.error || 'Nao foi possivel atualizar a quantidade.', 'error');
    }
  }
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

function openQuickView(trigger) {
  const modal = document.querySelector('#quick-view-modal');
  if (!modal) return;

  const imageBox = modal.querySelector('[data-qv-image]');
  imageBox.replaceChildren();
  if (trigger.dataset.image) {
    const image = document.createElement('img');
    image.src = trigger.dataset.image;
    image.alt = trigger.dataset.name || 'Produto';
    imageBox.appendChild(image);
  } else {
    const fallback = document.createElement('span');
    fallback.textContent = 'FV';
    imageBox.appendChild(fallback);
  }
  modal.querySelector('[data-qv-name]').textContent = trigger.dataset.name || 'Produto';
  modal.querySelector('[data-qv-category]').textContent = trigger.dataset.category || 'Produto FarmaVida';
  modal.querySelector('[data-qv-description]').textContent = trigger.dataset.description || 'Produto selecionado no catalogo FarmaVida.';
  modal.querySelector('[data-qv-price]').textContent = trigger.dataset.price || '';
  modal.querySelector('[data-qv-prescription]').hidden = trigger.dataset.prescription !== '1';
  modal.querySelector('[data-qv-detail]').href = trigger.dataset.url || '#';

  const add = modal.querySelector('[data-qv-add]');
  add.dataset.productId = trigger.dataset.productId || '';
  add.hidden = trigger.dataset.canBuy !== '1';

  const unavailable = modal.querySelector('[data-qv-unavailable]');
  unavailable.hidden = trigger.dataset.canBuy === '1';

  modal.classList.add('is-open');
  modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');
  modal.querySelector('[data-modal-close]')?.focus();
}

function closeModal() {
  document.querySelectorAll('.modal.is-open').forEach((modal) => {
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
  });
  document.body.classList.remove('modal-open');
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    closeModal();
    closeSearchResults();
  }
});

document.addEventListener('click', (event) => {
  if (event.target.classList?.contains('modal-backdrop')) {
    closeModal();
  }
  if (!event.target.closest('.search')) {
    closeSearchResults();
  }
});

const searchInput = document.querySelector('[data-autocomplete]');
if (searchInput) {
  const results = document.createElement('div');
  results.className = 'search-results';
  results.setAttribute('role', 'listbox');
  searchInput.closest('.search')?.appendChild(results);

  let controller;
  searchInput.addEventListener('input', async () => {
    const query = searchInput.value.trim();
    if (query.length < 2) {
      closeSearchResults();
      return;
    }

    controller?.abort();
    controller = new AbortController();
    try {
      const response = await fetch(`/busca/autocomplete?q=${encodeURIComponent(query)}`, {
        headers: { 'Accept': 'application/json' },
        signal: controller.signal
      });
      const data = await response.json();
      renderSearchResults(results, data.items || []);
    } catch (error) {
      if (error.name !== 'AbortError') closeSearchResults();
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const current = window.location.pathname.replace(/\/$/, '') || '/';
  document.querySelectorAll('.mobile-bottom-nav a[href]').forEach((link) => {
    const href = link.getAttribute('href')?.replace(/\/$/, '') || '/';
    const active = href === current || (href !== '/' && current.startsWith(href));
    link.classList.toggle('is-active', active);
    if (active) link.setAttribute('aria-current', 'page');
  });

  if (window.matchMedia('(max-width: 680px)').matches) {
    document.querySelectorAll('[data-mobile-collapsible]').forEach((details) => {
      details.removeAttribute('open');
    });
  }
});

function renderSearchResults(container, items) {
  if (!items.length) {
    container.innerHTML = '<span>Nenhum produto encontrado.</span>';
    container.classList.add('is-open');
    return;
  }

  container.innerHTML = items.map((item) => {
    const label = escapeHtml(item.name || 'Produto');
    const active = item.active_ingredient ? `<small>${escapeHtml(item.active_ingredient)}</small>` : '';
    return `<a role="option" href="/produto/${encodeURIComponent(item.slug)}"><strong>${label}</strong>${active}</a>`;
  }).join('');
  container.classList.add('is-open');
}

function closeSearchResults() {
  document.querySelectorAll('.search-results.is-open').forEach((node) => {
    node.classList.remove('is-open');
  });
}

const tracker = document.querySelector('[data-order-status]');
if (tracker) {
  setInterval(async () => {
    const response = await fetch(`/pedido/${encodeURIComponent(tracker.dataset.orderStatus)}/status`, { headers: { 'Accept': 'application/json' } });
    const data = await response.json();
    if (data.ok && data.order) {
      document.title = `Pedido ${data.order.status}`;
      const pill = document.querySelector('[data-live-order-pill]');
      if (pill) pill.textContent = data.order.status_label || data.order.status;
    }
  }, 30000);
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/service-worker.js').catch(() => {});
}
