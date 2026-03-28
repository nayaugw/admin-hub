/* === Session Keys === */
const SESSION = {
  STAFF_ID: 'hub_staff_id',
  STAFF_NAME: 'hub_staff_name',
  STAFF_ROLE: 'hub_staff_role',
  STAFF_VENUE: 'hub_staff_venue',
  ALLOWED_TOOLS: 'hub_allowed_tools',
};

/* === Auth Helpers === */
function isLoggedIn() {
  return !!sessionStorage.getItem(SESSION.STAFF_ID);
}

function getSession() {
  return {
    id: parseInt(sessionStorage.getItem(SESSION.STAFF_ID)),
    name: sessionStorage.getItem(SESSION.STAFF_NAME),
    role: sessionStorage.getItem(SESSION.STAFF_ROLE),
    venue: sessionStorage.getItem(SESSION.STAFF_VENUE),
    allowedTools: sessionStorage.getItem(SESSION.ALLOWED_TOOLS),
  };
}

function setSession(staff) {
  sessionStorage.setItem(SESSION.STAFF_ID, staff.id);
  sessionStorage.setItem(SESSION.STAFF_NAME, staff.name);
  sessionStorage.setItem(SESSION.STAFF_ROLE, staff.role);
  sessionStorage.setItem(SESSION.STAFF_VENUE, staff.venue || 'All');
  sessionStorage.setItem(SESSION.ALLOWED_TOOLS, staff.allowed_tools || 'all');
}

function clearSession() {
  Object.values(SESSION).forEach(k => sessionStorage.removeItem(k));
}

function requireLogin() {
  if (!isLoggedIn()) {
    window.location.href = 'index.html';
    return false;
  }
  return true;
}

function isAdmin() {
  return getSession().role === 'admin';
}

function canAccessTool(slug) {
  const s = getSession();
  if (s.role === 'admin') return true;
  const tools = s.allowedTools;
  if (tools === 'all') return true;
  return tools.split(',').map(t => t.trim()).includes(slug);
}

/* === Fetch Wrapper === */
async function api(path, options = {}) {
  try {
    const res = await fetch(path, {
      headers: { 'Content-Type': 'application/json', ...options.headers },
      ...options,
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Request failed');
    return data;
  } catch (err) {
    showToast(err.message, 'error');
    throw err;
  }
}

/* === HTML Escaping === */
function esc(str) {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* === Toast Notification === */
function showToast(message, type = '') {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.className = 'toast ' + type;
  void toast.offsetHeight;
  toast.classList.add('show');
  clearTimeout(toast._timeout);
  toast._timeout = setTimeout(() => toast.classList.remove('show'), 3000);
}

/* === Logout === */
function logout() {
  clearSession();
  window.location.href = 'index.html';
}
