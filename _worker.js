// Admin Hub — Cloudflare Worker
// Handles auth, staff management, and status proxy routes

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    const JSON_HEADERS = {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    };

    // CORS preflight
    if (method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    // Check D1 binding
    if (path.startsWith('/api/') && !env.DB) {
      return new Response(JSON.stringify({ success: false, error: 'Database not connected. Check D1 binding.' }), { status: 500, headers: JSON_HEADERS });
    }

    // ─── GET /api/staff — list active staff for login dropdown ───
    if (path === '/api/staff' && method === 'GET') {
      try {
        const { results } = await env.DB.prepare(
          'SELECT id, name, role FROM hub_staff WHERE active = 1 ORDER BY name'
        ).all();
        return new Response(JSON.stringify({ success: true, data: results }), { headers: JSON_HEADERS });
      } catch (err) {
        return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500, headers: JSON_HEADERS });
      }
    }

    // ─── POST /api/login — verify name + passcode ───
    if (path === '/api/login' && method === 'POST') {
      try {
        const { name, passcode } = await request.json();
        if (!name || !passcode) {
          return new Response(JSON.stringify({ success: false, error: 'Name and passcode required' }), { status: 400, headers: JSON_HEADERS });
        }
        const row = await env.DB.prepare(
          'SELECT id, name, role, venue, allowed_tools FROM hub_staff WHERE name = ? AND passcode = ? AND active = 1'
        ).bind(name, passcode).first();
        if (!row) {
          return new Response(JSON.stringify({ success: false, error: 'Invalid name or passcode' }), { status: 401, headers: JSON_HEADERS });
        }
        return new Response(JSON.stringify({ success: true, data: row }), { headers: JSON_HEADERS });
      } catch (err) {
        return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500, headers: JSON_HEADERS });
      }
    }

    // ─── GET /api/staff/all — list all staff for admin management ───
    if (path === '/api/staff/all' && method === 'GET') {
      try {
        const { results } = await env.DB.prepare(
          'SELECT id, name, role, venue, allowed_tools, active, created_at FROM hub_staff ORDER BY active DESC, name'
        ).all();
        return new Response(JSON.stringify({ success: true, data: results }), { headers: JSON_HEADERS });
      } catch (err) {
        return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500, headers: JSON_HEADERS });
      }
    }

    // ─── POST /api/staff/add — add a new manager ───
    if (path === '/api/staff/add' && method === 'POST') {
      try {
        const { name, role, passcode, venue, allowed_tools } = await request.json();
        if (!name || !passcode) {
          return new Response(JSON.stringify({ success: false, error: 'Name and passcode required' }), { status: 400, headers: JSON_HEADERS });
        }
        await env.DB.prepare(
          'INSERT INTO hub_staff (name, role, passcode, venue, allowed_tools) VALUES (?, ?, ?, ?, ?)'
        ).bind(name, role || 'manager', passcode, venue || 'All', allowed_tools || 'all').run();
        return new Response(JSON.stringify({ success: true }), { headers: JSON_HEADERS });
      } catch (err) {
        return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500, headers: JSON_HEADERS });
      }
    }

    // ─── POST /api/staff/update — update manager details ───
    if (path === '/api/staff/update' && method === 'POST') {
      try {
        const { id, name, passcode, venue, allowed_tools } = await request.json();
        if (!id) {
          return new Response(JSON.stringify({ success: false, error: 'Staff ID required' }), { status: 400, headers: JSON_HEADERS });
        }
        const fields = [];
        const params = [];
        if (name !== undefined) { fields.push('name = ?'); params.push(name); }
        if (passcode !== undefined) { fields.push('passcode = ?'); params.push(passcode); }
        if (venue !== undefined) { fields.push('venue = ?'); params.push(venue); }
        if (allowed_tools !== undefined) { fields.push('allowed_tools = ?'); params.push(allowed_tools); }
        if (fields.length === 0) {
          return new Response(JSON.stringify({ success: false, error: 'No fields to update' }), { status: 400, headers: JSON_HEADERS });
        }
        params.push(id);
        await env.DB.prepare(
          'UPDATE hub_staff SET ' + fields.join(', ') + ' WHERE id = ?'
        ).bind(...params).run();
        return new Response(JSON.stringify({ success: true }), { headers: JSON_HEADERS });
      } catch (err) {
        return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500, headers: JSON_HEADERS });
      }
    }

    // ─── POST /api/staff/deactivate — deactivate a manager ───
    if (path === '/api/staff/deactivate' && method === 'POST') {
      try {
        const { id } = await request.json();
        if (!id) {
          return new Response(JSON.stringify({ success: false, error: 'Staff ID required' }), { status: 400, headers: JSON_HEADERS });
        }
        await env.DB.prepare('UPDATE hub_staff SET active = 0 WHERE id = ?').bind(id).run();
        return new Response(JSON.stringify({ success: true }), { headers: JSON_HEADERS });
      } catch (err) {
        return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500, headers: JSON_HEADERS });
      }
    }

    // ─── GET /api/status/diesel-tracker — proxy to diesel tracker ───
    if (path === '/api/status/diesel-tracker' && method === 'GET') {
      try {
        const res = await fetch('https://diesel-tracker.pages.dev/api/maintenance/upcoming');
        if (!res.ok) throw new Error('Diesel tracker API unavailable');
        const data = await res.json();
        if (!data.success) throw new Error('Diesel tracker returned error');
        const alerts = data.data || [];
        const overdue = alerts.filter(a => a.status === 'overdue').length;
        const upcoming = alerts.filter(a => a.status === 'upcoming').length;
        return new Response(JSON.stringify({
          success: true,
          data: {
            lines: [
              overdue > 0 ? { text: overdue + ' overdue service' + (overdue !== 1 ? 's' : ''), alert: true } : null,
              upcoming > 0 ? { text: upcoming + ' upcoming service' + (upcoming !== 1 ? 's' : ''), alert: false } : null,
              overdue === 0 && upcoming === 0 ? { text: 'All services up to date', ok: true } : null,
            ].filter(Boolean)
          }
        }), { headers: JSON_HEADERS });
      } catch (err) {
        return new Response(JSON.stringify({ success: true, data: { lines: [{ text: 'Status unavailable', loading: true }] } }), { headers: JSON_HEADERS });
      }
    }

    // ─── GET /api/status/staff-applications — proxy to staff app ───
    if (path === '/api/status/staff-applications' && method === 'GET') {
      try {
        const res = await fetch('https://staff-application-form.pages.dev/api/applications');
        if (!res.ok) throw new Error('Staff applications API unavailable');
        const apps = await res.json();
        if (!Array.isArray(apps)) throw new Error('Unexpected response');
        const pending = apps.filter(a => (a.status === 'New' || a.status === 'Screening') && !a.archived && !a.deleted_at).length;
        const interviews = apps.filter(a => a.status === 'Interview Scheduled' && !a.archived && !a.deleted_at).length;
        return new Response(JSON.stringify({
          success: true,
          data: {
            lines: [
              pending > 0 ? { text: pending + ' pending application' + (pending !== 1 ? 's' : ''), alert: pending > 5 } : null,
              interviews > 0 ? { text: interviews + ' interview' + (interviews !== 1 ? 's' : '') + ' scheduled', alert: false } : null,
              pending === 0 && interviews === 0 ? { text: 'No pending applications', ok: true } : null,
            ].filter(Boolean)
          }
        }), { headers: JSON_HEADERS });
      } catch (err) {
        return new Response(JSON.stringify({ success: true, data: { lines: [{ text: 'Status unavailable', loading: true }] } }), { headers: JSON_HEADERS });
      }
    }

    // ─── GET /api/status/staff-dashboard — proxy to staff dashboard ───
    if (path === '/api/status/staff-dashboard' && method === 'GET') {
      try {
        const res = await fetch('https://staff-dashboard.pages.dev/api/status');
        if (!res.ok) throw new Error('Staff dashboard API unavailable');
        const data = await res.json();
        const lines = [];
        if (data.pending_leave > 0) {
          lines.push({ text: data.pending_leave + ' pending leave request' + (data.pending_leave !== 1 ? 's' : ''), alert: data.pending_leave > 3 });
        }
        if (data.total_staff > 0) {
          lines.push({ text: data.total_staff + ' active staff', alert: false });
        }
        if (data.pending_leave === 0) {
          lines.push({ text: 'No pending leave requests', ok: true });
        }
        return new Response(JSON.stringify({ success: true, data: { lines } }), { headers: JSON_HEADERS });
      } catch (err) {
        return new Response(JSON.stringify({ success: true, data: { lines: [{ text: 'Status unavailable', loading: true }] } }), { headers: JSON_HEADERS });
      }
    }

    // ─── Serve static files (Cloudflare Pages handles this automatically) ───
    // Fall through — Pages will serve index.html, hub.html, etc.
    return env.ASSETS ? env.ASSETS.fetch(request) : new Response('Not found', { status: 404 });
  }
};
