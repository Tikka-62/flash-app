// Flash App — Main Module
// DB and GCal are loaded via <script> tags before this file

// ─── Tag System ───────────────────────────────────────────────────────────────
const BUILTIN_TAGS = [
  { id: 'task',        label: 'タスク',   color: '#ff7f7f' },
  { id: 'inspiration', label: 'ひらめき', color: '#68c040' },
  { id: 'schedule',    label: '予定',     color: '#bf7fff' },
  { id: 'diary',       label: '日記',     color: '#7fbfff' },
  { id: 'inbox',       label: '未分類',   color: '#94a3b8' },
];

// Preset theme colors
const THEME_PALETTE = [
  '#87ceeb', // Sky（デフォルト）
  '#6366f1', // Indigo
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#ef4444', // Red
  '#f97316', // Orange
  '#f59e0b', // Amber
  '#84cc16', // Lime
  '#10b981', // Emerald
  '#06b6d4', // Cyan
  '#0ea5e9', // Sky Blue
  '#64748b', // Slate
];

// Preset colors for custom tags
const TAG_PALETTE = [
  '#ff9999','#ffb347','#ffd966','#a8e6a3','#87d2f5',
  '#d4a5f5','#ff6b6b','#6bcb77','#4da6ff','#ff8fab',
  '#ffa066','#40c9a2','#c77dff','#ff595e','#8ac926',
];

function getCustomTags() {
  try { return JSON.parse(localStorage.getItem('flash_custom_tags') || '[]'); }
  catch { return []; }
}
function saveCustomTags(tags) {
  localStorage.setItem('flash_custom_tags', JSON.stringify(tags));
}
function getAllTags() {
  return [...BUILTIN_TAGS, ...getCustomTags()];
}
function getTagById(id) {
  return getAllTags().find(t => t.id === id) || { id, label: id, color: '#94a3b8' };
}

// Migrate old items: tag(string) → tags(array)
function ensureTags(item) {
  if (!Array.isArray(item.tags)) {
    item.tags = item.tag ? [item.tag] : ['inbox'];
  }
  return item;
}

// ─── State ────────────────────────────────────────────────────────────────────
const S = {
  view:         'input',
  prevView:     'input',
  items:        [],
  filter:       'all',
  selectedTags: [],          // multi-select for new items
  calYear:      new Date().getFullYear(),
  calMonth:     new Date().getMonth(),
  selectedDate: null,
  newTagColor:  TAG_PALETTE[0],
};

// ─── Utilities ────────────────────────────────────────────────────────────────
function genId() {
  return (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : Date.now().toString(36) + Math.random().toString(36).slice(2);
}
function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function fmtDate(ts) {
  const d = new Date(ts);
  return `${d.getMonth()+1}/${d.getDate()}`;
}
function fmtDateTime(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')} `
       + `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}
function esc(s) {
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function trunc(s, n) { return s.length > n ? s.slice(0, n) + '…' : s; }
function $id(id)     { return document.getElementById(id); }

// Tag badge HTML — always white text, color from tag definition
function tagBadge(tagId) {
  const t = getTagById(tagId);
  return `<span class="tag-badge" style="background:${t.color}">${esc(t.label)}</span>`;
}
function tagBadges(tags) {
  const order = getAllTags().map(t => t.id);
  const sorted = (tags || ['inbox']).slice().sort(
    (a, b) => order.indexOf(a) - order.indexOf(b)
  );
  return sorted.map(tagBadge).join('');
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function toast(msg, err = false) {
  let el = $id('toast');
  if (!el) {
    el = Object.assign(document.createElement('div'), { id: 'toast' });
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.className   = 'toast' + (err ? ' error' : '');
  el.classList.add('visible');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('visible'), 2600);
}

// ─── View Manager ─────────────────────────────────────────────────────────────
function setView(v) {
  if (S.view !== 'settings') S.prevView = S.view; // 設定以外のビューを記憶
  S.view = v;
  document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
  $id(`view-${v}`).classList.add('active');
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === v);
  });
  if (v === 'input')    { setTimeout(() => $id('input-text')?.focus(), 80); renderInlineList(); }
  if (v === 'list')     { renderFilterBar(); renderList(); }
  if (v === 'calendar') { renderCalendar(); }
  if (v === 'settings') { renderSettings(); }
}

// ─── Tag Buttons (Input View) ─────────────────────────────────────────────────
function renderTagButtons() {
  const container = $id('tag-buttons-container');
  const tags = getAllTags().filter(t => t.id !== 'inbox');

  container.innerHTML = tags.map(tag => {
    const active = S.selectedTags.includes(tag.id);
    return `<button class="tag-btn${active ? ' selected' : ''}"
                    data-tag="${tag.id}"
                    style="--tag-color:${tag.color}">
      ${esc(tag.label)}
    </button>`;
  }).join('') +
  `<button class="tag-btn tag-add-btn" id="add-tag-btn-inline" title="タグを管理" aria-label="タグを管理">
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none"
         stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
  </button>`;

  container.querySelectorAll('[data-tag]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.tag;
      if (S.selectedTags.includes(id)) {
        S.selectedTags = S.selectedTags.filter(t => t !== id);
      } else {
        S.selectedTags.push(id);
      }
      renderTagButtons();
      toggleSchedulePanel();
    });
  });
  $id('add-tag-btn-inline')?.addEventListener('click', showAddTagModal);
}

// ─── Schedule Panel ───────────────────────────────────────────────────────────
function toggleSchedulePanel() {
  const isSchedule = S.selectedTags.includes('schedule');
  const panel  = $id('schedule-panel');
  const taWrap = document.querySelector('.textarea-wrap');
  panel.classList.toggle('active', isSchedule);
  panel.setAttribute('aria-hidden', String(!isSchedule));
  taWrap.classList.toggle('hidden-for-schedule', isSchedule);
  if (isSchedule) {
    const dateEl = $id('schedule-date');
    if (dateEl && !dateEl.value) dateEl.value = today();
    setTimeout(() => $id('schedule-title')?.focus(), 80);
  } else {
    setTimeout(() => $id('input-text')?.focus(), 80);
  }
  // パネル切替時にボタン状態を再評価
  updateSaveBtn();
}

// ─── Save Button State ────────────────────────────────────────────────────────
// モジュールスコープに置くことで toggleSchedulePanel からも呼べる
function updateSaveBtn() {
  const isScheduleMode = S.selectedTags.includes('schedule');
  const cnt = $id('char-count');
  const MAX = 1000;

  if (isScheduleMode) {
    // 予定モード：予定名が入力されていれば有効（メモは任意）
    const titleVal = ($id('schedule-title')?.value || '').trim();
    $id('save-btn').classList.toggle('empty', !titleVal);
    if (cnt) cnt.textContent = '';
  } else {
    // 通常モード：メインテキストエリアの内容で判定
    const ta  = $id('input-text');
    const len = ta ? ta.value.length : 0;
    if (cnt) {
      cnt.textContent = len ? `${len} / ${MAX}` : '';
      cnt.className   = 'char-count' + (len > MAX ? ' over' : len > MAX * 0.8 ? ' warn' : '');
    }
    $id('save-btn').classList.toggle('empty', !ta?.value.trim());
  }
}

// ─── Input View ───────────────────────────────────────────────────────────────
function initInputView() {
  const ta = $id('input-text');

  ta.addEventListener('input', updateSaveBtn);
  // 予定名の入力でも保存ボタン状態を更新
  $id('schedule-title')?.addEventListener('input', updateSaveBtn);

  updateSaveBtn(); // 初期状態を反映
  ta.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); saveItem(); }
  });
  $id('save-btn').addEventListener('click', saveItem);
  renderTagButtons();
}

async function saveItem() {
  const isScheduleMode = S.selectedTags.includes('schedule');

  let content, scheduledDate = null, scheduledTime = null;

  if (isScheduleMode) {
    // 予定モード：schedule-title を主コンテンツとして使う
    const titleEl = $id('schedule-title');
    content = (titleEl?.value || '').trim();
    if (!content) {
      titleEl?.focus();
      titleEl?.classList.add('shake');
      setTimeout(() => titleEl?.classList.remove('shake'), 500);
      return;
    }
    // メモがあれば本文に結合
    const memoVal = ($id('schedule-memo')?.value || '').trim();
    if (memoVal) content += '\n' + memoVal;
    scheduledDate = $id('schedule-date')?.value || null;
    scheduledTime = document.querySelector('input[name="schedule-time"]:checked')?.value || 'allday';
  } else {
    const ta = $id('input-text');
    content  = ta.value.trim();
    if (!content) {
      ta.focus();
      ta.classList.add('shake');
      setTimeout(() => ta.classList.remove('shake'), 500);
      return;
    }
  }

  const tags = S.selectedTags.length ? [...S.selectedTags] : ['inbox'];
  const item = {
    id:              genId(),
    content,
    tags,
    tag:             tags[0],
    completed:       false,
    createdAt:       Date.now(),
    updatedAt:       Date.now(),
    googleEventId:   null,
    scheduledDate,
    scheduledTime,
    calendarColorId: null,
  };

  await DB.put(item);

  // ── UI リセット ──────────────────────────────────────────────────
  $id('input-text').value = '';
  $id('char-count').textContent = '';
  $id('save-btn').classList.add('empty');
  S.selectedTags = [];
  const scheduleTitle = $id('schedule-title');
  if (scheduleTitle) scheduleTitle.value = '';
  const scheduleMemo  = $id('schedule-memo');
  if (scheduleMemo)  scheduleMemo.value  = '';
  const scheduleDate  = $id('schedule-date');
  if (scheduleDate)  scheduleDate.value  = '';
  const defaultSlot = document.querySelector('input[name="schedule-time"][value="allday"]');
  if (defaultSlot) defaultSlot.checked = true;
  renderTagButtons();
  toggleSchedulePanel();
  renderInlineList();

  const btn = $id('save-btn');
  btn.textContent = '✓ 保存しました！';
  btn.classList.add('saved');
  setTimeout(() => { btn.textContent = '保存する'; btn.classList.remove('saved'); }, 1600);

  if (navigator.vibrate) navigator.vibrate(12);

  // 予定 + GCal 連携済み → GCalモーダルを自動で開く
  if (isScheduleMode && GCal.isConnected()) {
    setTimeout(() => openGCalModal(item), 400);
  } else {
    $id('input-text').focus();
  }
}

// ─── Inline List (Input View) ─────────────────────────────────────────────────
async function renderInlineList() {
  const box = $id('inline-list');
  if (!box) return;

  const all  = await DB.getAll();
  S.items    = all.map(ensureTags);
  const tags = getAllTags();

  // ── filter bar
  const filterBarHtml =
    `<div class="filter-bar" role="group" aria-label="フィルター">` +
    `<button class="filter-btn${S.filter==='all'?' active':''}" data-ifilter="all">すべて</button>` +
    tags.map(tag => {
      const active = S.filter === tag.id;
      const style  = active ? `background:${tag.color};border-color:${tag.color};color:#fff` : '';
      return `<button class="filter-btn${active?' active':''}" data-ifilter="${tag.id}" style="${style}">${esc(tag.label)}</button>`;
    }).join('') +
    `</div>`;

  // ── items
  const filtered = S.filter === 'all'
    ? S.items
    : S.items.filter(i => i.tags.includes(S.filter));

  const itemsHtml = !filtered.length
    ? `<div class="empty-state"><span class="empty-icon">📭</span><p>${
        S.filter==='all' ? 'まだ何も記録されていません' : 'この種類の記録はありません'
      }</p></div>`
    : filtered.map((item, i) => `
      <div class="item-card ${item.completed?'completed':''}" data-id="${item.id}"
           style="animation-delay:${Math.min(i,5)*25}ms">
        <button class="item-check" aria-label="完了を切り替え" data-check="${item.id}">
          ${item.completed
            ? '<svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>'
            : ''}
        </button>
        <div class="item-body" data-expand="${item.id}">
          <p class="item-content">${esc(trunc(item.content,90))}</p>
          <div class="item-meta">
            ${tagBadges(item.tags)}
            <span class="item-date">${fmtDate(item.createdAt)}</span>
            ${item.googleEventId?'<span class="gcal-badge" title="Googleカレンダー連携済み">📅</span>':''}
          </div>
        </div>
      </div>`).join('');

  box.innerHTML = filterBarHtml +
    `<div class="inline-items-wrap">${itemsHtml}</div>`;

  box.querySelectorAll('[data-ifilter]').forEach(btn => {
    btn.addEventListener('click', () => { S.filter = btn.dataset.ifilter; renderInlineList(); });
  });
  box.querySelectorAll('[data-check]').forEach(btn => {
    btn.addEventListener('click', e => { e.stopPropagation(); handleToggle(btn.dataset.check, btn); });
  });
  box.querySelectorAll('[data-expand]').forEach(el => {
    el.addEventListener('click', () => handleExpand(el.dataset.expand, el.closest('.item-card')));
  });
}

// 現在のビューに応じてリストを再描画
function refreshCurrentList() {
  if (S.view === 'input')    renderInlineList();
  else if (S.view === 'list') renderList();
}

// ─── Filter Bar ───────────────────────────────────────────────────────────────
function renderFilterBar() {
  const bar  = $id('filter-bar');
  const tags = getAllTags();

  bar.innerHTML =
    `<button class="filter-btn${S.filter === 'all' ? ' active' : ''}" data-filter="all">すべて</button>` +
    tags.map(tag => {
      const active = S.filter === tag.id;
      const style  = active
        ? `background:${tag.color};border-color:${tag.color};color:#fff`
        : '';
      return `<button class="filter-btn${active ? ' active' : ''}"
                      data-filter="${tag.id}" style="${style}">
        ${esc(tag.label)}
      </button>`;
    }).join('');

  bar.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      S.filter = btn.dataset.filter;
      renderFilterBar();
      renderList();
    });
  });
}

// ─── List View ────────────────────────────────────────────────────────────────
async function renderList() {
  const all  = await DB.getAll();
  S.items    = all.map(ensureTags);

  const filtered = S.filter === 'all'
    ? S.items
    : S.items.filter(i => i.tags.includes(S.filter));

  const box = $id('items-container');

  if (!filtered.length) {
    box.innerHTML = `<div class="empty-state">
      <span class="empty-icon">📭</span>
      <p>${S.filter === 'all' ? 'まだ何も記録されていません' : 'この種類の記録はありません'}</p>
    </div>`;
    return;
  }

  box.innerHTML = filtered.map((item, i) => `
    <div class="item-card ${item.completed ? 'completed' : ''}"
         data-id="${item.id}" style="animation-delay:${Math.min(i,5)*25}ms">
      <button class="item-check" aria-label="完了を切り替え" data-check="${item.id}">
        ${item.completed
          ? '<svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>'
          : ''}
      </button>
      <div class="item-body" data-expand="${item.id}">
        <p class="item-content">${esc(trunc(item.content, 90))}</p>
        <div class="item-meta">
          ${tagBadges(item.tags)}
          <span class="item-date">${fmtDate(item.createdAt)}</span>
          ${item.googleEventId ? '<span class="gcal-badge" title="Googleカレンダー連携済み">📅</span>' : ''}
        </div>
      </div>
    </div>`).join('');

  box.querySelectorAll('[data-check]').forEach(btn => {
    btn.addEventListener('click', e => { e.stopPropagation(); handleToggle(btn.dataset.check, btn); });
  });
  box.querySelectorAll('[data-expand]').forEach(el => {
    el.addEventListener('click', () => handleExpand(el.dataset.expand, el.closest('.item-card')));
  });
}

async function handleToggle(id, triggerEl) {
  const all  = await DB.getAll();
  const item = ensureTags(all.find(i => i.id === id) || {});
  if (!item.id) return;

  item.completed = !item.completed;
  item.updatedAt = Date.now();
  await DB.put(item);

  if (item.completed) {
    const rect = triggerEl.getBoundingClientRect();
    spawnConfetti(rect.left + rect.width / 2, rect.top + rect.height / 2);
    if (navigator.vibrate) navigator.vibrate([12, 40, 12]);
    if (item.googleEventId && GCal.isConnected()) {
      GCal.updateEventCompleted(item.googleEventId, item.content).catch(() => {});
    }
  }
  refreshCurrentList();
}

function handleExpand(id, card) {
  if (!card) card = document.querySelector(`.item-card[data-id="${id}"]`);
  if (!card) return;

  const isOpen = card.classList.contains('expanded');
  // 同じコンテナ内の展開済みカードだけ閉じる
  card.closest('#inline-list, #items-container, #cal-day-items')
    ?.querySelectorAll('.item-card.expanded')
    .forEach(c => { c.classList.remove('expanded'); c.querySelector('.item-actions')?.remove(); });
  if (isOpen) return;

  const item = S.items.find(i => i.id === id);
  if (!item) return;

  card.classList.add('expanded');

  const selectableTags = getAllTags().filter(t => t.id !== 'inbox');
  const activeTags     = new Set(item.tags);

  const actions = document.createElement('div');
  actions.className = 'item-actions';
  actions.innerHTML = `
    <div class="item-full-content">${esc(item.content)}</div>
    <div class="item-full-meta">${fmtDateTime(item.createdAt)}</div>

    <div class="tag-editor">
      <div class="tag-editor-label">タグ</div>
      <div class="tag-editor-chips">
        ${selectableTags.map(tag => {
          const on = activeTags.has(tag.id);
          return `<button class="tag-chip${on ? ' active' : ''}"
                          data-tag-toggle="${tag.id}"
                          style="${on
                            ? `background:${tag.color};color:#fff`
                            : 'background:#f0f0f0;color:#666'}">
            ${esc(tag.label)}
          </button>`;
        }).join('')}
      </div>
      <button class="action-btn save-tags-btn" data-save-tags="${id}">タグを保存</button>
    </div>

    <div class="action-btns">
      <button class="action-btn edit-btn" data-edit="${id}">
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
        編集
      </button>
      ${!item.googleEventId && GCal.isConnected()
        ? `<button class="action-btn gcal-btn" data-gcal="${id}">📅 カレンダー追加</button>`
        : ''}
      <button class="action-btn delete-btn" data-del="${id}">
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="3 6 5 6 21 6"/>
          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
          <path d="M10 11v6M14 11v6"/>
          <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
        </svg>
        削除
      </button>
    </div>`;

  card.appendChild(actions);
  card.querySelector('.item-content').textContent = item.content;

  // Tag chip toggles
  actions.querySelectorAll('[data-tag-toggle]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      btn.classList.toggle('active');
      const tag = getTagById(btn.dataset.tagToggle);
      if (btn.classList.contains('active')) {
        btn.style.background = tag.color;
        btn.style.color = '#fff';
      } else {
        btn.style.background = '#f0f0f0';
        btn.style.color = '#666';
      }
    });
  });

  // Save tags
  actions.querySelector('[data-save-tags]')?.addEventListener('click', async e => {
    e.stopPropagation();
    const selected = [...actions.querySelectorAll('[data-tag-toggle].active')]
      .map(b => b.dataset.tagToggle);
    const all2  = await DB.getAll();
    const item2 = ensureTags(all2.find(i => i.id === id) || {});
    if (!item2.id) return;
    item2.tags = selected.length ? selected : ['inbox'];
    item2.tag  = item2.tags[0];
    item2.updatedAt = Date.now();
    await DB.put(item2);
    toast('タグを更新しました ✓');
    refreshCurrentList();
  });

  // Edit
  actions.querySelector('[data-edit]')?.addEventListener('click', e => {
    e.stopPropagation();
    const contentEl = actions.querySelector('.item-full-content');
    if (actions.querySelector('.edit-textarea')) return; // already editing

    const ta = document.createElement('textarea');
    ta.className = 'edit-textarea';
    ta.value = item.content;
    ta.maxLength = 1000;
    contentEl.replaceWith(ta);
    ta.focus();
    ta.setSelectionRange(ta.value.length, ta.value.length);

    const editBtn = actions.querySelector('[data-edit]');
    editBtn.innerHTML = `
      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
        <polyline points="17 21 17 13 7 13 7 21"/>
        <polyline points="7 3 7 8 15 8"/>
      </svg>
      保存`;
    editBtn.classList.add('edit-save-mode');

    editBtn.onclick = async ev => {
      ev.stopPropagation();
      const newContent = ta.value.trim();
      if (!newContent) {
        ta.classList.add('shake');
        setTimeout(() => ta.classList.remove('shake'), 500);
        return;
      }
      const all2  = await DB.getAll();
      const item2 = all2.find(i => i.id === id);
      if (!item2) return;
      item2.content  = newContent;
      item2.updatedAt = Date.now();
      await DB.put(item2);
      toast('メモを更新しました ✓');
      refreshCurrentList();
    };
  });

  actions.querySelector('[data-gcal]')?.addEventListener('click', e => {
    e.stopPropagation(); openGCalModal(item);
  });
  actions.querySelector('[data-del]')?.addEventListener('click', async e => {
    e.stopPropagation(); await handleDelete(id);
  });
}

async function handleDelete(id) {
  if (!confirm('この記録を削除しますか？')) return;
  const all  = await DB.getAll();
  const item = all.find(i => i.id === id);
  if (item?.googleEventId && GCal.isConnected()) {
    GCal.deleteEvent(item.googleEventId).catch(() => {});
  }
  await DB.remove(id);
  refreshCurrentList();
}

// ─── Add Tag Modal ────────────────────────────────────────────────────────────
function initAddTagModal() {
  const modal    = $id('add-tag-modal');
  const colorsEl = $id('new-tag-colors');

  // Build palette
  colorsEl.innerHTML = TAG_PALETTE.map((c, i) =>
    `<button class="palette-swatch${i === 0 ? ' selected' : ''}"
             data-color="${c}" style="background:${c}" title="${c}"></button>`
  ).join('');

  colorsEl.querySelectorAll('.palette-swatch').forEach(sw => {
    sw.addEventListener('click', () => {
      colorsEl.querySelectorAll('.palette-swatch').forEach(s => s.classList.remove('selected'));
      sw.classList.add('selected');
      S.newTagColor = sw.dataset.color;
    });
  });

  $id('add-tag-cancel').addEventListener('click', () => modal.classList.remove('open'));
  modal.addEventListener('click', e => { if (e.target === modal) modal.classList.remove('open'); });

  $id('add-tag-save').addEventListener('click', () => {
    const name = $id('new-tag-name').value.trim();
    if (!name) {
      $id('new-tag-name').classList.add('shake');
      setTimeout(() => $id('new-tag-name').classList.remove('shake'), 500);
      return;
    }
    const customTags = getCustomTags();
    customTags.push({ id: `custom_${Date.now()}`, label: name, color: S.newTagColor });
    saveCustomTags(customTags);
    $id('new-tag-name').value = '';
    renderCustomTagsList();
    modal.classList.remove('open');
    renderTagButtons();
    renderFilterBar();
    toast(`タグ「${name}」を追加しました ✓`);
  });
}

function renderCustomTagsList() {
  const list = $id('custom-tags-list');
  if (!list) return;
  const customTags = getCustomTags();

  if (!customTags.length) {
    list.innerHTML = '';
    return;
  }

  list.innerHTML = `
    <div class="custom-tag-rows">
      ${customTags.map(tag => `
        <div class="custom-tag-row">
          <span class="custom-tag-dot" style="background:${tag.color}"></span>
          <span class="custom-tag-name">${esc(tag.label)}</span>
          <button class="delete-tag-btn" data-delete-tag="${tag.id}" aria-label="削除">✕</button>
        </div>`).join('')}
    </div>
    <div class="modal-divider"></div>`;

  list.querySelectorAll('[data-delete-tag]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      deleteCustomTag(btn.dataset.deleteTag);
    });
  });
}

function deleteCustomTag(id) {
  const customTags = getCustomTags().filter(t => t.id !== id);
  saveCustomTags(customTags);
  // Remove from selectedTags if present
  S.selectedTags = S.selectedTags.filter(t => t !== id);
  // Reset filter if it was this tag
  if (S.filter === id) S.filter = 'all';
  renderCustomTagsList();
  renderTagButtons();
  renderFilterBar();
  if (S.view === 'list') renderList();
}

function showAddTagModal() {
  $id('new-tag-name').value = '';
  // Reset palette selection to first color
  const colorsEl = $id('new-tag-colors');
  colorsEl.querySelectorAll('.palette-swatch').forEach((sw, i) => {
    sw.classList.toggle('selected', i === 0);
  });
  S.newTagColor = TAG_PALETTE[0];
  renderCustomTagsList();
  $id('add-tag-modal').classList.add('open');
}

// ─── GCal Modal ───────────────────────────────────────────────────────────────
const GCAL_COLORS = [
  { id: '1',  hex: '#7986cb', name: 'ラベンダー'  },
  { id: '2',  hex: '#33b679', name: 'セージ'      },
  { id: '3',  hex: '#8e24aa', name: 'グレープ'    },
  { id: '4',  hex: '#e67c73', name: 'フラミンゴ'  },
  { id: '5',  hex: '#f6bf26', name: 'バナナ'      },
  { id: '6',  hex: '#f4511e', name: 'タンジェリン' },
  { id: '7',  hex: '#039be5', name: 'ピーコック'  },
  { id: '9',  hex: '#3f51b5', name: 'ブルーベリー' },
  { id: '10', hex: '#0b8043', name: 'バジル'      },
  { id: '11', hex: '#d50000', name: 'トマト'      },
];

function openGCalModal(item) {
  // 件名：メモ付き予定の場合は1行目だけをタイトルに
  $id('gcal-subject').value = item.content.split('\n')[0].slice(0, 100);
  // 日付：保存済みのスケジュール日 or 今日
  $id('gcal-date').value    = item.scheduledDate || today();
  $id('gcal-modal').dataset.itemId = item.id;
  // 時間帯：保存済みのスロット or 終日
  const slot = item.scheduledTime || 'allday';
  const slotRadio = document.querySelector(`input[name="time-slot"][value="${slot}"]`);
  if (slotRadio) slotRadio.checked = true;
  else document.querySelector('input[name="time-slot"][value="allday"]').checked = true;
  const grid = $id('gcal-color-grid');
  if (!grid.children.length) {
    grid.innerHTML = GCAL_COLORS.map(c =>
      `<label class="color-opt" title="${c.name}">
        <input type="radio" name="gcal-color" value="${c.id}" ${c.id === '7' ? 'checked' : ''}>
        <span class="color-swatch" style="background:${c.hex}"></span>
      </label>`
    ).join('');
  }
  $id('gcal-modal').classList.add('open');
}

function initGCalModal() {
  $id('gcal-cancel').addEventListener('click', () => $id('gcal-modal').classList.remove('open'));
  $id('gcal-modal').addEventListener('click', e => {
    if (e.target === $id('gcal-modal')) $id('gcal-modal').classList.remove('open');
  });
  $id('gcal-save').addEventListener('click', async () => {
    const id      = $id('gcal-modal').dataset.itemId;
    const all     = await DB.getAll();
    const item    = all.find(i => i.id === id);
    if (!item) return;
    const subject  = $id('gcal-subject').value.trim();
    const date     = $id('gcal-date').value;
    const timeSlot = document.querySelector('input[name="time-slot"]:checked')?.value || 'allday';
    const colorId  = document.querySelector('input[name="gcal-color"]:checked')?.value || '7';
    if (!subject || !date) { toast('件名と日付を入力してください', true); return; }
    const btn = $id('gcal-save');
    btn.disabled = true; btn.textContent = '登録中…';
    try {
      item.content = subject; item.scheduledDate = date;
      item.scheduledTime = timeSlot; item.calendarColorId = colorId;
      item.googleEventId = await GCal.createEvent(item);
      item.updatedAt = Date.now();
      await DB.put(item);
      $id('gcal-modal').classList.remove('open');
      toast('Googleカレンダーに登録しました ✓');
      renderList();
    } catch (err) {
      toast('エラー: ' + err.message, true);
    } finally {
      btn.disabled = false; btn.textContent = '登録する';
    }
  });
}

// ─── Calendar View ────────────────────────────────────────────────────────────
async function renderCalendar() {
  const all = await DB.getAll();
  S.items   = all.map(ensureTags);

  const dateMap = {};
  for (const item of S.items) {
    const d = new Date(item.createdAt).toISOString().split('T')[0];
    (dateMap[d] = dateMap[d] || []).push(item);
  }

  const { calYear: y, calMonth: m } = S;
  $id('cal-title').textContent = `${y}年${m + 1}月`;

  const startOff = (new Date(y, m, 1).getDay() + 6) % 7;
  const daysInMo = new Date(y, m + 1, 0).getDate();
  const todayStr = today();
  const selStr   = S.selectedDate;

  let html = ['月','火','水','木','金','土','日']
    .map(d => `<div class="cal-header-cell">${d}</div>`).join('');

  for (let i = 0; i < startOff; i++) html += '<div class="cal-cell empty"></div>';

  for (let d = 1; d <= daysInMo; d++) {
    const ds  = `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const its = dateMap[ds] || [];
    const dots = its.slice(0, 3).map(i => {
      const color = getTagById(i.tags[0]).color;
      return `<span class="cal-dot" style="background:${color}"></span>`;
    }).join('');

    html += `<div class="cal-cell${ds===todayStr?' today':''}${ds===selStr?' selected':''}${its.length?' has-items':''}"
      data-date="${ds}">
      <span class="cal-day-num">${d}</span>
      ${its.length ? `<div class="cal-dots">${dots}</div>` : ''}
    </div>`;
  }

  const grid = $id('cal-grid');
  grid.innerHTML = html;
  grid.querySelectorAll('.cal-cell[data-date]').forEach(cell => {
    cell.addEventListener('click', () => { S.selectedDate = cell.dataset.date; renderCalendar(); });
  });

  renderDayItems(selStr || todayStr, dateMap[selStr || todayStr] || []);
}

function renderDayItems(dateStr, items) {
  const box = $id('cal-day-items');
  if (!dateStr) { box.innerHTML = ''; return; }
  const d     = new Date(dateStr + 'T00:00:00');
  const label = `${d.getMonth()+1}月${d.getDate()}日`;

  if (!items.length) {
    box.innerHTML = `<div class="cal-day-header">${label}</div>
      <div class="empty-state small"><p>この日の記録はありません</p></div>`;
    return;
  }

  box.innerHTML = `<div class="cal-day-header">${label}</div>` +
    items.map(item => `
    <div class="item-card small ${item.completed ? 'completed' : ''}" data-id="${item.id}">
      <button class="item-check" data-check="${item.id}">
        ${item.completed
          ? '<svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>'
          : ''}
      </button>
      <div class="item-body">
        <p class="item-content">${esc(trunc(item.content, 60))}</p>
        <div class="item-meta">${tagBadges(item.tags)}</div>
      </div>
    </div>`).join('');

  box.querySelectorAll('[data-check]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      handleToggle(btn.dataset.check, btn).then(() => renderCalendar());
    });
  });
}

function initCalNav() {
  $id('cal-prev').addEventListener('click', () => {
    S.calMonth--;
    if (S.calMonth < 0) { S.calMonth = 11; S.calYear--; }
    S.selectedDate = null; renderCalendar();
  });
  $id('cal-next').addEventListener('click', () => {
    S.calMonth++;
    if (S.calMonth > 11) { S.calMonth = 0; S.calYear++; }
    S.selectedDate = null; renderCalendar();
  });
}

// ─── Theme Color ──────────────────────────────────────────────────────────────
function getTheme() {
  return localStorage.getItem('flash_theme_color') || '#87ceeb';
}
function applyTheme(color) {
  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);
  const root = document.documentElement;
  root.style.setProperty('--theme',     color);
  root.style.setProperty('--theme-rgb', `${r}, ${g}, ${b}`);
  localStorage.setItem('flash_theme_color', color);
}
function renderThemePalette() {
  const palette = $id('theme-palette');
  if (!palette) return;
  const current = getTheme();

  palette.innerHTML =
    THEME_PALETTE.map(c =>
      `<button class="theme-swatch${c.toLowerCase() === current.toLowerCase() ? ' selected' : ''}"
               data-theme="${c}" style="background:${c}" aria-label="${c}"></button>`
    ).join('') +
    `<label class="theme-swatch theme-swatch-custom" title="カスタムカラー" aria-label="カスタムカラー">
       <input type="color" id="theme-custom-input" value="${current}">
     </label>`;

  palette.querySelectorAll('[data-theme]').forEach(btn => {
    btn.addEventListener('click', () => {
      applyTheme(btn.dataset.theme);
      renderThemePalette();
    });
  });
  const customInput = $id('theme-custom-input');
  if (customInput) {
    customInput.addEventListener('input', e => {
      applyTheme(e.target.value);
      // プリセットの選択状態を外す
      palette.querySelectorAll('[data-theme]').forEach(b => b.classList.remove('selected'));
    });
  }
}

// ─── Dark Mode ────────────────────────────────────────────────────────────────
function isDarkMode() {
  return localStorage.getItem('flash_dark_mode') === 'on';
}
function applyDarkMode(on) {
  document.body.classList.toggle('dark', on);
  localStorage.setItem('flash_dark_mode', on ? 'on' : 'off');
  const toggle = $id('dark-mode-toggle');
  if (toggle) toggle.checked = on;
}

// ─── Settings View ────────────────────────────────────────────────────────────
function renderSettings() {
  const cid = GCal.getClientId();
  $id('gcal-client-id').value = cid;
  const statusEl = $id('gcal-status');
  statusEl.textContent = cid ? '● 設定済み' : '○ 未設定';
  statusEl.className   = 'gcal-status' + (cid ? ' connected' : '');
  // sync toggle state
  const toggle = $id('dark-mode-toggle');
  if (toggle) toggle.checked = isDarkMode();
  // render theme palette
  renderThemePalette();
}

function initSettings() {
  $id('settings-save').addEventListener('click', () => {
    GCal.setClientId($id('gcal-client-id').value.trim());
    renderSettings(); toast('設定を保存しました ✓');
  });
  $id('settings-disconnect').addEventListener('click', () => {
    if (!confirm('接続を解除しますか？')) return;
    GCal.disconnect(); renderSettings(); toast('接続を解除しました');
  });
  $id('export-btn').addEventListener('click', async () => {
    const items = await DB.getAll();
    const blob  = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
    const url   = URL.createObjectURL(blob);
    Object.assign(document.createElement('a'), { href: url, download: `flash-${today()}.json` }).click();
    URL.revokeObjectURL(url); toast('エクスポートしました ✓');
  });
  $id('import-btn').addEventListener('click', () => $id('import-file').click());
  $id('dark-mode-toggle').addEventListener('change', e => {
    applyDarkMode(e.target.checked);
  });
  $id('import-file').addEventListener('change', async e => {
    const file = e.target.files[0]; if (!file) return;
    try {
      const items = JSON.parse(await file.text());
      for (const item of items) await DB.put(item);
      toast(`${items.length}件をインポートしました ✓`);
    } catch { toast('インポートに失敗しました', true); }
    e.target.value = '';
  });
}

// ─── Confetti ─────────────────────────────────────────────────────────────────
function spawnConfetti(cx, cy) {
  const cvs = $id('confetti-canvas');
  const ctx = cvs.getContext('2d');
  cvs.width = window.innerWidth; cvs.height = window.innerHeight;
  cvs.style.display = 'block';
  const COLORS = ['#ff7f7f','#68c040','#bf7fff','#7fbfff','#ffd966','#ff9999'];
  const pts = Array.from({ length: 28 }, () => ({
    x: cx, y: cy,
    vx: (Math.random() - 0.5) * 11, vy: Math.random() * -11 - 4,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    w: Math.random() * 9 + 3, h: Math.random() * 5 + 2,
    life: 1, decay: Math.random() * 0.022 + 0.014,
    rot: Math.random() * Math.PI * 2, rv: (Math.random() - 0.5) * 0.22,
  }));
  let raf;
  function frame() {
    ctx.clearRect(0, 0, cvs.width, cvs.height);
    let alive = false;
    for (const p of pts) {
      p.x += p.vx; p.y += p.vy; p.vy += 0.38; p.vx *= 0.985;
      p.life -= p.decay; p.rot += p.rv;
      if (p.life > 0) {
        alive = true;
        ctx.save(); ctx.globalAlpha = Math.max(0, p.life);
        ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.fillStyle = p.color; ctx.fillRect(-p.w/2, -p.h/2, p.w, p.h);
        ctx.restore();
      }
    }
    if (alive) raf = requestAnimationFrame(frame);
    else { cancelAnimationFrame(raf); ctx.clearRect(0,0,cvs.width,cvs.height); cvs.style.display='none'; }
  }
  raf = requestAnimationFrame(frame);
}

// ─── Navigation ───────────────────────────────────────────────────────────────
function initNav() {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => setView(btn.dataset.view));
  });
  $id('settings-back-btn').addEventListener('click', () => setView(S.prevView || 'input'));
}

// ─── Init ─────────────────────────────────────────────────────────────────────
async function init() {
  applyDarkMode(isDarkMode()); // 保存済み設定を即時反映
  applyTheme(getTheme());      // 保存済みテーマカラーを即時反映
  await DB.open();
  initNav();
  initInputView();
  renderInlineList();
  initAddTagModal();
  initGCalModal();
  initSettings();
  initCalNav();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
  setView('input');
}

init();
