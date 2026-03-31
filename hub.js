// === Tool Configuration ===
const TOOLS = [
  {
    slug: 'diesel-tracker',
    name: 'Diesel Tracker',
    icon: '🚗',
    url: 'https://diesel-tracker.pages.dev/admin.html',
    live: true,
  },
  {
    slug: 'staff-applications',
    name: 'Staff Applications',
    icon: '📋',
    url: 'https://staff-application-form.pages.dev/admin.html',
    live: true,
  },
  {
    slug: 'staff-dashboard',
    name: 'Staff Dashboard',
    icon: '👥',
    url: 'https://staff-dashboard-3f2.pages.dev/',
    live: true,
  },
  {
    slug: 'eighteen-daily-sales',
    name: 'Eighteen Daily Sales',
    icon: '💰',
    url: null,
    live: false,
  },
  {
    slug: 'dining-club',
    name: 'Dining Club',
    icon: '🎁',
    url: null,
    live: false,
  },
];

// === Init ===
if (!requireLogin()) {
  // redirected
} else {
  init();
}

function init() {
  const session = getSession();
  document.getElementById('user-name').textContent = 'Hi, ' + session.name;
  renderToolCards();
  if (isAdmin()) {
    document.getElementById('staff-section').classList.remove('hidden');
    loadStaffList();
  }
}

// === Render Tool Cards ===
function renderToolCards() {
  const grid = document.getElementById('tool-grid');
  grid.innerHTML = '';

  TOOLS.forEach(tool => {
    if (!canAccessTool(tool.slug)) return;

    const card = document.createElement('div');
    card.className = 'tool-card' + (tool.live ? '' : ' coming-soon');

    if (tool.live && tool.url) {
      card.onclick = () => window.open(tool.url, '_blank');
    }

    let statusHTML = '';
    if (tool.live) {
      statusHTML = '<div class="tool-status" id="status-' + tool.slug + '"><span class="loading">Loading...</span></div>';
    } else {
      statusHTML = '<div class="tool-status"><span class="coming-soon-badge">Coming Soon</span></div>';
    }

    card.innerHTML =
      '<div class="tool-icon">' + tool.icon + '</div>' +
      '<div class="tool-name">' + esc(tool.name) + '</div>' +
      statusHTML +
      '<div class="tool-footer">' +
        (tool.live ? '<span class="open-link">Open &rarr;</span>' : '<span></span>') +
      '</div>';

    grid.appendChild(card);

    // Fetch live status
    if (tool.live) {
      fetchStatus(tool.slug);
    }
  });
}

// === Fetch Status from Worker Proxy ===
async function fetchStatus(slug) {
  const el = document.getElementById('status-' + slug);
  if (!el) return;
  try {
    const data = await api('/api/status/' + slug);
    const lines = data.data.lines || [];
    el.innerHTML = '';
    lines.forEach(line => {
      const span = document.createElement('div');
      span.className = 'status-line';
      if (line.alert) span.classList.add('alert');
      if (line.ok) span.classList.add('ok');
      if (line.loading) span.classList.add('loading');
      span.textContent = line.text;
      el.appendChild(span);
    });
  } catch (err) {
    el.innerHTML = '<span class="loading">Status unavailable</span>';
  }
}

// === Staff Management ===
let staffList = [];

async function loadStaffList() {
  try {
    const data = await api('/api/staff/all');
    staffList = data.data || [];
    renderStaffTable();
  } catch (e) {
    // Error shown by api()
  }
}

function renderStaffTable() {
  const tbody = document.getElementById('staff-tbody');
  tbody.innerHTML = '';
  staffList.forEach(s => {
    if (!s.active) return; // hide deactivated
    const toolTags = s.allowed_tools === 'all'
      ? '<span class="tool-tag">All Tools</span>'
      : s.allowed_tools.split(',').map(t => '<span class="tool-tag">' + esc(t.trim()) + '</span>').join('');

    const tr = document.createElement('tr');
    tr.innerHTML =
      '<td>' + esc(s.name) + '</td>' +
      '<td>' + esc(s.role) + '</td>' +
      '<td>' + toolTags + '</td>' +
      '<td>' +
        '<button class="btn btn-secondary btn-small" onclick="openEditStaffModal(' + s.id + ')" style="margin-right:4px">Edit</button>' +
        (s.role !== 'admin' ? '<button class="btn btn-danger btn-small" onclick="deactivateStaff(' + s.id + ')">Remove</button>' : '') +
      '</td>';
    tbody.appendChild(tr);
  });
}

function openAddStaffModal() {
  document.getElementById('modal-title').textContent = 'Add Manager';
  document.getElementById('modal-name').value = '';
  document.getElementById('modal-passcode').value = '';
  document.getElementById('modal-staff-id').value = '';
  renderToolCheckboxes('all');
  document.getElementById('staff-modal').classList.add('active');
}

function openEditStaffModal(id) {
  const s = staffList.find(x => x.id === id);
  if (!s) return;
  document.getElementById('modal-title').textContent = 'Edit ' + s.name;
  document.getElementById('modal-name').value = s.name;
  document.getElementById('modal-passcode').value = '';
  document.getElementById('modal-staff-id').value = id;
  renderToolCheckboxes(s.allowed_tools);
  document.getElementById('staff-modal').classList.add('active');
}

function closeStaffModal() {
  document.getElementById('staff-modal').classList.remove('active');
}

function renderToolCheckboxes(currentTools) {
  const container = document.getElementById('modal-tools');
  const isAll = currentTools === 'all';
  const selected = isAll ? [] : currentTools.split(',').map(t => t.trim());
  container.innerHTML = TOOLS.map(tool =>
    '<label class="tool-checkbox">' +
      '<input type="checkbox" value="' + tool.slug + '"' +
        (isAll || selected.includes(tool.slug) ? ' checked' : '') +
      '> ' + tool.icon + ' ' + esc(tool.name) +
    '</label>'
  ).join('');
}

function getSelectedTools() {
  const checkboxes = document.querySelectorAll('#modal-tools input[type="checkbox"]');
  const checked = [];
  let allChecked = true;
  checkboxes.forEach(cb => {
    if (cb.checked) checked.push(cb.value);
    else allChecked = false;
  });
  if (allChecked) return 'all';
  return checked.join(',');
}

async function saveStaff() {
  const id = document.getElementById('modal-staff-id').value;
  const name = document.getElementById('modal-name').value.trim();
  const passcode = document.getElementById('modal-passcode').value.trim();
  const allowed_tools = getSelectedTools();

  if (!name) return showToast('Name is required', 'error');
  if (!allowed_tools) return showToast('Select at least one tool', 'error');

  try {
    if (id) {
      // Update
      const payload = { id: parseInt(id), name, allowed_tools };
      if (passcode) payload.passcode = passcode;
      await api('/api/staff/update', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      showToast('Updated', 'success');
    } else {
      // Add new
      if (!passcode) return showToast('Passcode is required for new staff', 'error');
      await api('/api/staff/add', {
        method: 'POST',
        body: JSON.stringify({ name, passcode, role: 'manager', allowed_tools }),
      });
      showToast('Manager added', 'success');
    }
    closeStaffModal();
    loadStaffList();
  } catch (e) {
    // Error shown by api()
  }
}

async function deactivateStaff(id) {
  const s = staffList.find(x => x.id === id);
  if (!s) return;
  if (!confirm('Remove ' + s.name + ' from Admin Hub?')) return;
  try {
    await api('/api/staff/deactivate', {
      method: 'POST',
      body: JSON.stringify({ id }),
    });
    showToast('Removed', 'success');
    loadStaffList();
  } catch (e) {
    // Error shown by api()
  }
}
