// Flash GCal - Google Calendar API (client-side OAuth2)
const GCal = (() => {
  let _token     = null;
  let _tokenExp  = 0;
  let _tokenClient = null;

  // ── Storage helpers ─────────────────────────────────────────────────────────
  function getClientId()      { return localStorage.getItem('gcal_client_id') || ''; }
  function setClientId(id)    { localStorage.setItem('gcal_client_id', id); }
  function isConnected()      { return !!getClientId(); }

  function disconnect() {
    if (_token && window.google?.accounts?.oauth2) {
      try { google.accounts.oauth2.revoke(_token, () => {}); } catch (_) {}
    }
    _token = null; _tokenExp = 0; _tokenClient = null;
    localStorage.removeItem('gcal_client_id');
  }

  // ── GIS loader ───────────────────────────────────────────────────────────────
  function loadGIS() {
    return new Promise(resolve => {
      if (window.google?.accounts?.oauth2) return resolve();
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.async = true;
      s.onload = resolve;
      document.head.appendChild(s);
    });
  }

  // ── Token acquisition ────────────────────────────────────────────────────────
  async function getToken() {
    if (_token && Date.now() < _tokenExp) return _token;
    const clientId = getClientId();
    if (!clientId) throw new Error('Google Client IDが設定されていません。\n設定画面でClient IDを入力してください。');

    await loadGIS();

    return new Promise((resolve, reject) => {
      _tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: 'https://www.googleapis.com/auth/calendar.events',
        callback: res => {
          if (res.error) return reject(new Error(res.error_description || res.error));
          _token    = res.access_token;
          _tokenExp = Date.now() + (parseInt(res.expires_in, 10) - 120) * 1000;
          resolve(_token);
        },
        error_callback: err => reject(new Error(err.message || 'OAuth エラー')),
      });
      _tokenClient.requestAccessToken({ prompt: '' });
    });
  }

  // ── Calendar helpers ─────────────────────────────────────────────────────────
  function timeZone() {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  }

  function nextDay(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  }

  function slotToTimes(dateStr, slot) {
    const map = { morning: '08:00:00', noon: '12:00:00', evening: '19:00:00' };
    if (slot === 'allday') {
      return { start: { date: dateStr }, end: { date: nextDay(dateStr) } };
    }
    const t   = map[slot] || '09:00:00';
    const [h, m, s] = t.split(':').map(Number);
    const endH = String(h + 1).padStart(2, '0');
    const tz   = timeZone();
    return {
      start: { dateTime: `${dateStr}T${t}`,                    timeZone: tz },
      end:   { dateTime: `${dateStr}T${endH}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`, timeZone: tz },
    };
  }

  // Google Calendar color IDs (1-11)
  // 1=lavender 2=sage 3=grape 4=flamingo 5=banana 6=tangerine
  // 7=peacock 8=graphite 9=blueberry 10=basil 11=tomato

  // ── API calls ────────────────────────────────────────────────────────────────
  async function apiFetch(path, opts = {}) {
    const token = await getToken();
    const res   = await fetch(`https://www.googleapis.com/calendar/v3${path}`, {
      ...opts,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type':  'application/json',
        ...(opts.headers || {}),
      },
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error?.message || `HTTP ${res.status}`);
    }
    if (res.status === 204) return null;
    return res.json();
  }

  async function createEvent(item) {
    const { start, end } = slotToTimes(
      item.scheduledDate || new Date().toISOString().split('T')[0],
      item.scheduledTime || 'allday'
    );
    const body = {
      summary:     item.content.slice(0, 100),
      description: item.content,
      start, end,
      colorId: item.calendarColorId || '1',
      extendedProperties: { private: { flashId: item.id } },
    };
    const data = await apiFetch('/calendars/primary/events', {
      method: 'POST',
      body:   JSON.stringify(body),
    });
    return data.id;
  }

  async function updateEventCompleted(googleEventId, content) {
    await apiFetch(`/calendars/primary/events/${googleEventId}`, {
      method: 'PATCH',
      body:   JSON.stringify({ summary: `✓ ${content.slice(0, 98)}`, colorId: '8' }),
    });
  }

  async function deleteEvent(googleEventId) {
    try {
      await apiFetch(`/calendars/primary/events/${googleEventId}`, { method: 'DELETE' });
    } catch (e) {
      if (!e.message.includes('404') && !e.message.includes('410')) throw e;
    }
  }

  return {
    getClientId, setClientId, isConnected, disconnect,
    createEvent, updateEventCompleted, deleteEvent,
  };
})();
