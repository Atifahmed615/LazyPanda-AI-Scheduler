// ══════════════════════════════════════════════
//  DATA STORE
// ══════════════════════════════════════════════
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const CAT_COLORS = {
  class: { dot:'#7c6ff7', badge:'#7c6ff7', bg:'rgba(124,111,247,0.12)', label:'CLASS' },
  study: { dot:'#34d399', badge:'#34d399', bg:'rgba(52,211,153,0.1)', label:'STUDY' },
  meeting: { dot:'#60a5fa', badge:'#60a5fa', bg:'rgba(96,165,250,0.1)', label:'MEETING' },
  personal: { dot:'#fbbf24', badge:'#fbbf24', bg:'rgba(251,191,36,0.1)', label:'PERSONAL' },
  other: { dot:'#9090a8', badge:'#9090a8', bg:'rgba(144,144,168,0.1)', label:'OTHER' },
};
const PRIORITY_COLORS = { high:'#f87171', medium:'#fbbf24', low:'#34d399' };
const STATE_STORAGE_KEY = 'classflow_state';
const API_KEY_STORAGE_KEY = 'lazy_panda_api_key';
const DOCS_STORAGE_KEY = 'lazy_panda_uploaded_docs';
const OPTIMIZER_STORAGE_KEY = 'lazy_panda_optimizer_result';
const DEFAULT_VIEW = 'dashboard';
let uploadedDocs = [];
let lastOptimizerResult = null;

function defaultEvents() {
  const today = new Date();
  const fmt = d => d.toISOString().split('T')[0];
  const dayOfWeek = today.getDay(); // 0=Sun

  // Compute next occurrence of a given weekday
  function nextDay(targetDay) {
    let d = new Date(today);
    let diff = (targetDay - dayOfWeek + 7) % 7;
    if (diff === 0) diff = 0;
    d.setDate(d.getDate() + diff);
    return fmt(d);
  }

  return [
    { id:'e1', title:'Machine Learning', category:'class', date: nextDay(1), start:'18:00', end:'21:00', location:'NED CIS Department', recurring:'weekly' },
    { id:'e2', title:'Mathematics for AI', category:'class', date: nextDay(2), start:'18:00', end:'21:00', location:'NED CIS Department', recurring:'weekly' },
    { id:'e3', title:'Introduction to AI', category:'class', date: nextDay(3), start:'18:00', end:'21:00', location:'NED CIS Department', recurring:'weekly' },
    { id:'e4', title:'Understanding Holy Quran 1', category:'class', date: nextDay(4), start:'18:00', end:'21:00', location:'NED Auditorium', recurring:'weekly' },
    { id:'e5', title:'AI-Driven Dev & Claude Code', category:'class', date: nextDay(5), start:'20:00', end:'22:00', location:'Online', recurring:'weekends' },
    { id:'e6', title:'AI-Driven Dev & Claude Code', category:'class', date: nextDay(0), start:'20:00', end:'22:00', location:'Online', recurring:'weekends' },
    { id:'e7', title:'PGD: Machine Learning', category:'class', date: nextDay(6), start:'11:00', end:'13:00', location:'NED Textile Department', recurring:'weekends' },
    { id:'e8', title:'PGD: Machine Learning', category:'class', date: nextDay(0), start:'11:00', end:'13:00', location:'NED Textile Department', recurring:'weekends' },
    { id:'e9', title:'CAIPP', category:'class', date: nextDay(6), start:'14:00', end:'18:00', location:'PNEC Computer Science Dept', recurring:'weekly' },
  ];
}

function defaultTasks() {
  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate()+1);
  const tmrw = tomorrow.toISOString().split('T')[0];
  return [
    { id:'t1', name:'Review ML backpropagation notes', due: today, priority:'high', done: false },
    { id:'t2', name:'Complete Math for AI assignment', due: today, priority:'medium', done: false },
    { id:'t3', name:'Prepare CAIPP presentation', due: tmrw, priority:'high', done: false },
    { id:'t4', name:'Read Quran tafseer chapter 2', due: tmrw, priority:'low', done: false },
  ];
}

let state = { events: [], tasks: [], attendance: [], grades: [], apiKey: '', theme: 'dark', accent: '#7c6ff7', currentView: DEFAULT_VIEW, showFreeTime: true, weeklyHourLimit: 50 };

// Undo/Redo stacks for destructive actions
let undoStack = [];
let redoStack = [];
const MAX_UNDO_ENTRIES = 20;

function loadState() {
  try {
    const saved = localStorage.getItem(STATE_STORAGE_KEY);
    if (saved) {
      state = { ...state, ...JSON.parse(saved) };
      if (!Array.isArray(state.events)) state.events = [];
      if (!Array.isArray(state.tasks)) state.tasks = [];
    } else {
      state.events = defaultEvents();
      state.tasks = defaultTasks();
      state.theme = 'dark';
      state.accent = '#7c6ff7';
    }
    const savedApiKey = localStorage.getItem(API_KEY_STORAGE_KEY);
    if (savedApiKey) state.apiKey = savedApiKey;
    try {
      const savedDocs = localStorage.getItem(DOCS_STORAGE_KEY);
      uploadedDocs = savedDocs ? JSON.parse(savedDocs) : [];
    if (!Array.isArray(uploadedDocs)) uploadedDocs = [];
    } catch(e) {
      uploadedDocs = [];
    }
    try {
      lastOptimizerResult = localStorage.getItem(OPTIMIZER_STORAGE_KEY) || null;
    } catch(e) {
      lastOptimizerResult = null;
    }
    if (!state.attendance) state.attendance = [];
    if (!state.grades) state.grades = [];
    if (!state.notifMinutes) state.notifMinutes = 10;
    if (state.notificationsEnabled === undefined) state.notificationsEnabled = false;
    if (!state.gcalClientId) state.gcalClientId = '';
    if (!state.waPhone) state.waPhone = '';
    if (!state.waServer) state.waServer = '';
    if (!state.currentView) state.currentView = DEFAULT_VIEW;
    if (state.showFreeTime === undefined) state.showFreeTime = true;
    if (!state.weeklyHourLimit) state.weeklyHourLimit = 50;
    state.events.forEach(ev => {
      if (!ev.recurringEndDate) ev.recurringEndDate = '';
      if (!ev.color) ev.color = '';
    });
    state.tasks.forEach(t => {
      if (!Array.isArray(t.subtasks)) t.subtasks = [];
      if (!t.recurring) t.recurring = 'none';
      if (t.recurringDay === undefined) t.recurringDay = new Date((t.due || todayStr()) + 'T12:00:00').getDay();
      if (!t.doneDates) t.doneDates = [];
    });
    document.documentElement.setAttribute('data-theme', state.theme || 'dark');
    if (state.accent) document.documentElement.style.setProperty('--accent', state.accent);
    const statusEl = document.getElementById('api-status-sidebar');
    if (statusEl) {
      statusEl.textContent = state.apiKey ? '⬤ Connected' : '⬤ No key';
      statusEl.style.color = state.apiKey ? 'var(--green)' : 'var(--coral)';
    }
  } catch(e) { state.events = defaultEvents(); state.tasks = defaultTasks(); state.attendance = []; state.grades = []; state.theme = 'dark'; state.accent = '#7c6ff7'; }
}

function saveState() {
  try {
    localStorage.setItem(STATE_STORAGE_KEY, JSON.stringify(state));
  } catch(e) {}
  try {
    if (state.apiKey) localStorage.setItem(API_KEY_STORAGE_KEY, state.apiKey);
    else localStorage.removeItem(API_KEY_STORAGE_KEY);
  } catch(e) {}
  try {
    if (uploadedDocs.length) localStorage.setItem(DOCS_STORAGE_KEY, JSON.stringify(uploadedDocs));
    else localStorage.removeItem(DOCS_STORAGE_KEY);
  } catch(e) {}
  try {
    if (lastOptimizerResult) localStorage.setItem(OPTIMIZER_STORAGE_KEY, lastOptimizerResult);
    else localStorage.removeItem(OPTIMIZER_STORAGE_KEY);
  } catch(e) {}
}

function resetData() {
  if (!confirm('Reset everything? All data will be lost.')) return;
  // Clear all data and settings
  state.events = [];
  state.tasks = [];
  state.attendance = [];
  state.grades = [];
  state.apiKey = '';
  state.theme = 'dark';
  state.accent = '#7c6ff7';
  state.notificationsEnabled = false;
  state.notifMinutes = 10;
  state.gcalClientId = '';
  state.waPhone = '';
  state.waServer = '';
  state.currentView = DEFAULT_VIEW;
  state.showFreeTime = true;
  state.weeklyHourLimit = 50;
  uploadedDocs = [];
  lastOptimizerResult = null;
  // Stop notification scheduler
  if (window.notificationIntervalId) {
    clearInterval(window.notificationIntervalId);
    window.notificationIntervalId = null;
  }
  saveState();
  // Reset UI to defaults
  document.documentElement.setAttribute('data-theme', 'dark');
  document.documentElement.style.setProperty('--accent', '#7c6ff7');
  render();
  showView(DEFAULT_VIEW, { pushHistory: false, persist: false });
}

// ══════════════════════════════════════════════
//  HELPERS
// ══════════════════════════════════════════════
function todayStr() { return new Date().toISOString().split('T')[0]; }
function nowMins() { const n=new Date(); return n.getHours()*60+n.getMinutes(); }
function timeMins(t) { const [h,m]=t.split(':').map(Number); return h*60+m; }
function dateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function fmt12(t) {
  const [h,m]=t.split(':').map(Number);
  const ampm=h>=12?'PM':'AM';
  return `${h%12||12}:${String(m).padStart(2,'0')} ${ampm}`;
}
function addMinutesToTime(time, minutes) {
  const total = (timeMins(time) + minutes) % (24 * 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
}
function getWeekBounds(baseDate = new Date()) {
  const start = new Date(baseDate);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - start.getDay());
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { start, end, startStr: dateStr(start), endStr: dateStr(end) };
}

// XSS prevention — escape all user-supplied strings before injecting into innerHTML
const _ESC = { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' };
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => _ESC[c]); }
function daysBetween(a, b) {
  const start = new Date(a + 'T12:00:00');
  const end = new Date(b + 'T12:00:00');
  return Math.floor((end - start) / 86400000);
}

function hexToRgba(hex, alpha) {
  const raw = String(hex || '').replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(raw)) return `rgba(144,144,168,${alpha})`;
  const n = parseInt(raw, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

function getEventColor(ev) {
  return ev.color || (CAT_COLORS[ev.category]?.dot) || CAT_COLORS.other.dot;
}

function getEventBg(ev) {
  return hexToRgba(getEventColor(ev), 0.13);
}

function getEventsForDay(targetDateStr, targetDayOfWeek) {
  const seen = new Set();
  return state.events.filter(ev => {
    if (ev.recurringEndDate && targetDateStr > ev.recurringEndDate) return false;
    if (targetDateStr < ev.date) return false;
    let matches = false;
    const rec = ev.recurring || 'none';
    if (rec === 'none') {
      matches = ev.date === targetDateStr;
    } else if (rec === 'daily') {
      matches = true;
    } else if (rec === 'weekly') {
      const evDay = new Date(ev.date + 'T12:00:00').getDay();
      matches = evDay === targetDayOfWeek;
    } else if (rec === 'weekends') {
      matches = targetDayOfWeek === 0 || targetDayOfWeek === 6;
    } else if (rec === 'biweekly') {
      const evDay = new Date(ev.date + 'T12:00:00').getDay();
      const weeks = Math.floor(daysBetween(ev.date, targetDateStr) / 7);
      matches = evDay === targetDayOfWeek && weeks >= 0 && weeks % 2 === 0;
    } else if (rec === 'monthly') {
      matches = new Date(ev.date + 'T12:00:00').getDate() === new Date(targetDateStr + 'T12:00:00').getDate();
    } else {
      matches = ev.date === targetDateStr;
    }
    if (!matches) return false;
    // Use ID as dedup key — title-based key silently drops events with same name/time
    if (seen.has(ev.id)) return false;
    seen.add(ev.id);
    return true;
  }).sort((a,b) => timeMins(a.start)-timeMins(b.start));
}

function getTodayEvents() {
  return getEventsForDay(todayStr(), new Date().getDay());
}

function getUpcomingEvent() {
  const now = nowMins();
  const todayEvs = getTodayEvents();
  return todayEvs.find(ev => timeMins(ev.end) > now) || null;
}

function locationLink(loc) {
  if (!loc || !loc.trim()) return '';
  const q = encodeURIComponent(loc);
  return `<a href="https://maps.google.com/?q=${q}" target="_blank" rel="noopener" class="location-link" onclick="event.stopPropagation()">📍 ${esc(loc)}</a>`;
}

function getAllEvents() {
  return [...state.events].sort((a,b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return timeMins(a.start)-timeMins(b.start);
  });
}

// ══════════════════════════════════════════════
//  RENDER
// ══════════════════════════════════════════════

// Safe wrapper — a broken render function never crashes the whole app
function safeRender(fn, label) {
  try { fn(); } catch(e) { console.error('[render] ' + label + ':', e); }
}

function isViewVisible(id) {
  const el = document.getElementById('view-' + id);
  return el && !el.classList.contains('hidden');
}

function render() {
  // Dashboard widgets — always kept fresh (they're visible on load)
  safeRender(renderUpcoming,       'upcoming');
  safeRender(renderWorkloadWidget, 'workload');
  safeRender(renderTimeline,       'timeline');
  safeRender(renderTasks,          'tasks');
  safeRender(renderConflictBanner, 'conflictBanner');
  safeRender(updateBadge,          'badge');

  // Only re-render views that are currently visible — avoids wasted work on hidden panels
  if (isViewVisible('schedule'))   safeRender(renderCalendar,           'calendar');
  if (isViewVisible('schedule') || isViewVisible('dashboard'))
                                   safeRender(renderAllEvents,          'allEvents');
  if (isViewVisible('tasks'))      safeRender(renderAllTasks,           'allTasks');
  if (isViewVisible('deadlines'))  safeRender(renderDeadlines,          'deadlines');
}

function isValidView(view) {
  return views.includes(view);
}

function getOpenModalId() {
  const openModal = document.querySelector('.modal-overlay:not(.hidden)');
  return openModal ? openModal.id : null;
}

let lastActiveElement = null;

function openModal(id, pushHistory = true) {
  const modal = document.getElementById(id);
  if (!modal) return;
  
  // Store the currently focused element to restore focus later
  lastActiveElement = document.activeElement;
  
  modal.classList.remove('hidden');
  
  // Add accessibility attributes if not present
  if (!modal.getAttribute('role')) modal.setAttribute('role', 'dialog');
  if (!modal.getAttribute('aria-modal')) modal.setAttribute('aria-modal', 'true');
  
  // Find and focus first input or focusable element in the modal
  const focusableElements = modal.querySelectorAll('input, button, [tabindex]:not([tabindex="-1"])');
  if (focusableElements.length > 0) {
    focusableElements[0].focus();
  }
  
  if (pushHistory) history.pushState({ panel: 'modal', modal: id, view: state.currentView || DEFAULT_VIEW }, '', location.href);
}

function closeModal(id, useHistory = true) {
  const modal = document.getElementById(id);
  if (!modal) return;
  const wasOpen = !modal.classList.contains('hidden');
  modal.classList.add('hidden');
  
  // Restore focus to the previously active element
  if (lastActiveElement && typeof lastActiveElement.focus === 'function') {
    lastActiveElement.focus();
  }
  
  if (useHistory && wasOpen && history.state && history.state.panel === 'modal' && history.state.modal === id) history.back();
}

function closeAllModals() {
  document.querySelectorAll('.modal-overlay').forEach(function(modal) {
    modal.classList.add('hidden');
  });
}

let timerInterval;
function renderUpcoming() {
  clearInterval(timerInterval);
  const wrap = document.getElementById('upcoming-card-wrap');
  const ev = getUpcomingEvent();
  if (!ev) {
    wrap.innerHTML = `<div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r);padding:20px 24px;color:var(--text3);">
      <div style="font-size:22px;margin-bottom:6px;">🎉</div>
      <div style="font-size:15px;font-weight:500;color:var(--text2);">No more classes today</div>
      <div style="font-size:13px;margin-top:4px;">You're free! Check tomorrow's schedule.</div>
    </div>`;
    return;
  }
  const cat = CAT_COLORS[ev.category] || CAT_COLORS.other;
  wrap.innerHTML = `<div class="upcoming-card">
    <div class="upcoming-label">NEXT UP</div>
    <div class="upcoming-name">${esc(ev.title)}</div>
    <div class="upcoming-meta">${fmt12(ev.start)} – ${fmt12(ev.end)}${locationLink(ev.location) ? ' · ' + locationLink(ev.location) : ''}</div>
    <div class="upcoming-timer" id="timer-display">--:--</div>
    <div class="upcoming-timer-label">until class starts</div>
    <div class="upcoming-actions">
      <button class="btn-ghost" onclick="deleteEvent('${esc(ev.id)}')">Remove</button>
      <button class="btn-ghost" onclick="editEvent('${esc(ev.id)}')">Edit</button>
    </div>
  </div>`;

  function tick() {
    const now = nowMins();
    const start = timeMins(ev.start);
    const diff = start - now;
    const disp = document.getElementById('timer-display');
    if (!disp) { clearInterval(timerInterval); return; }
    if (diff <= 0) {
      const inProgress = timeMins(ev.end) - now;
      disp.textContent = inProgress > 0 ? 'IN PROGRESS' : 'ENDED';
      disp.style.fontSize = '18px';
    } else {
      const h = Math.floor(diff/60), m = diff%60;
      disp.textContent = h > 0 ? `${h}h ${m}m` : `${m}m`;
    }
  }
  tick();
  timerInterval = setInterval(tick, 30000);
}

function calcWeeklyWorkload() {
  const week = getWeekBounds();
  let scheduledMinutes = 0;

  for (let d = new Date(week.start); d <= week.end; d.setDate(d.getDate() + 1)) {
    const events = getEventsForDay(dateStr(d), d.getDay());
    events.forEach(ev => {
      scheduledMinutes += Math.max(0, timeMins(ev.end) - timeMins(ev.start));
    });
  }

  const pendingTasks = state.tasks.filter(t => !isTaskComplete(t) && t.due >= week.startStr && t.due <= week.endStr);
  const pendingMinutes = pendingTasks.length * 90;
  const scheduledHours = scheduledMinutes / 60;
  const pendingHours = pendingMinutes / 60;
  const totalHours = scheduledHours + pendingHours;
  const limit = Number(state.weeklyHourLimit) || 50;

  return {
    scheduledHours,
    pendingHours,
    totalHours,
    pendingTasks: pendingTasks.length,
    limit,
    overloaded: totalHours > limit
  };
}

function renderWorkloadWidget() {
  const wrap = document.getElementById('workload-widget-wrap');
  if (!wrap) return;
  const workload = calcWeeklyWorkload();
  const pct = Math.min(100, Math.round((workload.totalHours / workload.limit) * 100));
  const scheduledPct = Math.min(pct, Math.round((workload.scheduledHours / workload.limit) * 100));
  const taskPct = Math.max(0, pct - scheduledPct);
  const color = workload.overloaded ? 'var(--coral)' : 'var(--green)';

  wrap.innerHTML = `<div class="workload-card${workload.overloaded ? ' overloaded' : ''}">
    <div class="workload-top">
      <div>
        <div class="workload-label">THIS WEEK</div>
        <div class="workload-title">${workload.totalHours.toFixed(1)}h / ${workload.limit}h committed</div>
      </div>
      <div class="workload-meta">${workload.scheduledHours.toFixed(1)}h scheduled · ${workload.pendingHours.toFixed(1)}h tasks</div>
    </div>
    <div class="workload-track" aria-label="Weekly workload ${pct}%">
      <div class="workload-fill scheduled" style="width:${scheduledPct}%;background:${color};"></div>
      <div class="workload-fill tasks" style="left:${scheduledPct}%;width:${taskPct}%;"></div>
    </div>
    <div class="workload-note">${workload.overloaded ? 'Heavy week: consider rescheduling low-priority tasks.' : `${workload.pendingTasks} pending task${workload.pendingTasks === 1 ? '' : 's'} due this week.`}</div>
  </div>`;
}

// Get left-border color based on priority or category
function getPriorityBorderColor(ev) {
  if (ev.priority && PRIORITY_COLORS[ev.priority]) {
    return PRIORITY_COLORS[ev.priority];
  }
  return getEventColor(ev);
}

function isTaskComplete(t) {
  const subtasks = t.subtasks || [];
  if (subtasks.length) return subtasks.every(st => st.done);
  return !!t.done;
}

function isTaskDoneForDate(t, date = todayStr()) {
  if ((t.recurring || 'none') !== 'none') return (t.doneDates || []).includes(date);
  return isTaskComplete(t);
}

function getTasksForDay(targetDateStr) {
  const day = new Date(targetDateStr + 'T12:00:00').getDay();
  return state.tasks.filter(t => {
    const rec = t.recurring || 'none';
    if (rec === 'none') return t.due <= targetDateStr && !isTaskComplete(t);
    if (targetDateStr < t.due) return false;
    if (rec === 'daily') return true;
    if (rec === 'weekly') return Number(t.recurringDay) === day;
    return false;
  });
}

function renderSubtaskProgress(t) {
  const subtasks = t.subtasks || [];
  if (!subtasks.length) return '';
  const done = subtasks.filter(st => st.done).length;
  return `<span class="subtask-progress">${done}/${subtasks.length}</span>`;
}

function renderSubtasks(t) {
  const subtasks = t.subtasks || [];
  if (!subtasks.length) return '';
  return `<div class="subtask-list">${subtasks.map(st => `
    <div class="subtask-item">
      <span class="subtask-check${st.done ? ' done' : ''}" onclick="event.stopPropagation();toggleSubtask('${esc(t.id)}','${esc(st.id)}')"></span>
      <span class="${st.done ? 'task-name done' : ''}">${esc(st.name)}</span>
    </div>`).join('')}</div>`;
}

function renderTimeline() {
  const el = document.getElementById('timeline');
  const evs = getTodayEvents();
  if (!evs.length) {
    el.innerHTML = `<div class="empty"><div class="empty-icon">📅</div>No events today. Add one!</div>`;
    return;
  }
  const now = nowMins();
  el.innerHTML = evs.map(ev => {
    const cat = CAT_COLORS[ev.category] || CAT_COLORS.other;
    const evColor = getEventColor(ev);
    const past = timeMins(ev.end) < now;
    const active = timeMins(ev.start) <= now && timeMins(ev.end) > now;
    const borderColor = getPriorityBorderColor(ev);
    return `<div class="timeline-item priority-stripe" role="button" tabindex="0" aria-label="${esc(ev.title)}, ${fmt12(ev.start)} to ${fmt12(ev.end)}${ev.location ? ', Location: ' + ev.location : ''}${active ? ', currently in progress' : ''}${past ? ', completed' : ''}" onclick="editEvent('${esc(ev.id)}')" onkeydown="if(event.key==='Enter' || event.key===' ') { event.preventDefault(); editEvent('${esc(ev.id)}'); }" style="--priority-stripe-color:${borderColor};${past?'opacity:0.45':''}${active?';background:var(--surface2);border-color:var(--border2)':''}">
      <div class="timeline-time">${fmt12(ev.start)}</div>
      <div class="timeline-dot" style="background:${evColor}"></div>
      <div class="timeline-content">
        <div class="timeline-title">${esc(ev.title)}${active?' <span style="font-size:10px;color:var(--green);font-weight:600;margin-left:6px;">● LIVE</span>':''}</div>
        <div class="timeline-sub">${fmt12(ev.start)} – ${fmt12(ev.end)}${locationLink(ev.location) ? ' · ' + locationLink(ev.location) : ''}</div>
      </div>
      <div style="display:flex;align-items:center;gap:6px;flex-shrink:0;">
        <span class="badge" style="background:${getEventBg(ev)};color:${evColor}">${cat.label}</span>
      </div>
    </div>`;
  }).join('');
}

function renderTasks() {
  const today = todayStr();

  const todayTasks = getTasksForDay(today).filter(t => !isTaskDoneForDate(t, today));
  const upcomingTasks = state.tasks.filter(t => (t.recurring || 'none') === 'none' && t.due > today && !isTaskComplete(t));

  const renderTask = (t) => `<div class="task-item">
    <div class="task-check${isTaskDoneForDate(t, today)?' done':''}" role="checkbox" tabindex="0" aria-checked="${isTaskDoneForDate(t, today)}" aria-label="Mark '${esc(t.name)}' as ${isTaskDoneForDate(t, today) ? 'incomplete' : 'complete'}" onclick="toggleTask('${esc(t.id)}', '${today}')" onkeydown="if(event.key==='Enter' || event.key===' ') { event.preventDefault(); toggleTask('${esc(t.id)}', '${today}'); }"></div>
    <div class="task-text">
      <div class="task-name${isTaskDoneForDate(t, today)?' done':''}">${esc(t.name)}${renderSubtaskProgress(t)}</div>
      <div class="task-due">${(t.recurring || 'none') !== 'none' ? `Repeats ${esc(t.recurring)}` : esc(t.due)}</div>
      ${renderSubtasks(t)}
    </div>
    <div class="priority-dot" style="background:${PRIORITY_COLORS[t.priority]||'#9090a8'}"></div>
  </div>`;

  const todayEl = document.getElementById('tasks-today');
  const upcomingEl = document.getElementById('tasks-upcoming');

  todayEl.innerHTML = todayTasks.length ? todayTasks.map(renderTask).join('') : '<div class="empty" style="padding:12px 0;font-size:12px;">All done! 🎉</div>';
  upcomingEl.innerHTML = upcomingTasks.length ? upcomingTasks.map(renderTask).join('') : '<div class="empty" style="padding:12px 0;font-size:12px;">Nothing upcoming</div>';
}

function renderAllEvents() {
  const el = document.getElementById('all-events-list');
  if (!el) return;
  const evs = getAllEvents();
  el.innerHTML = evs.map(ev => {
    const cat = CAT_COLORS[ev.category] || CAT_COLORS.other;
    const evColor = getEventColor(ev);
    return `<div class="timeline-item" role="button" tabindex="0" aria-label="${esc(ev.title)}, ${esc(ev.date)}, ${fmt12(ev.start)} to ${fmt12(ev.end)}${ev.location ? ', Location: ' + ev.location : ''}" onclick="editEvent('${esc(ev.id)}')" onkeydown="if(event.key==='Enter' || event.key===' ') { event.preventDefault(); editEvent('${esc(ev.id)}'); }">
      <div class="timeline-time" style="width:70px;font-size:10px;">${esc(ev.date)}</div>
      <div class="timeline-dot" style="background:${evColor}"></div>
      <div class="timeline-content">
        <div class="timeline-title">${esc(ev.title)}</div>
        <div class="timeline-sub">${fmt12(ev.start)} – ${fmt12(ev.end)}${locationLink(ev.location) ? ' · ' + locationLink(ev.location) : ''}</div>
      </div>
      <div style="display:flex;align-items:center;gap:6px;flex-shrink:0;">
        <span class="badge" style="background:${getEventBg(ev)};color:${evColor}">${cat.label}</span>
      </div>
    </div>`;
  }).join('') || '<div class="empty"><div class="empty-icon">📅</div>No events yet.</div>';
}

function renderAllTasks() {
  const el = document.getElementById('all-tasks-list');
  if (!el) return;
  const tasks = [...state.tasks].sort((a,b)=>{
    if(isTaskComplete(a)!==isTaskComplete(b)) return isTaskComplete(a)?1:-1;
    return a.due.localeCompare(b.due);
  });
  const today = todayStr();
  el.innerHTML = tasks.map(t => `<div class="task-item" style="border-bottom:1px solid var(--border);padding:10px 0;">
    <div class="task-check${isTaskDoneForDate(t, today)?' done':''}" role="checkbox" tabindex="0" aria-checked="${isTaskComplete(t)}" aria-label="Mark '${esc(t.name)}' as ${isTaskComplete(t) ? 'incomplete' : 'complete'}" onclick="toggleTask('${esc(t.id)}', '${today}')" onkeydown="if(event.key==='Enter' || event.key===' ') { event.preventDefault(); toggleTask('${esc(t.id)}', '${today}'); }"></div>
    <div class="task-text">
      <div class="task-name${isTaskComplete(t)?' done':''}">${esc(t.name)}${renderSubtaskProgress(t)}</div>
      ${renderSubtasks(t)}
      <div class="task-due">Due: ${esc(t.due)} · ${esc(t.priority)} priority</div>
    </div>
    <div class="priority-dot" style="background:${PRIORITY_COLORS[t.priority]||'#9090a8'}"></div>
    <span onclick="deleteTask('${esc(t.id)}')" style="font-size:14px;color:var(--text3);cursor:pointer;margin-left:8px;padding:4px;" role="button" tabindex="0" aria-label="Delete task '${esc(t.name)}'" onkeydown="if(event.key==='Enter' || event.key===' ') { event.preventDefault(); deleteTask('${esc(t.id)}'); }">✕</span>
  </div>`).join('') || '<div class="empty"><div class="empty-icon">✅</div>No tasks yet.</div>';
}

function updateBadge() {
  const today = todayStr();
  const count = getTasksForDay(today).filter(t => !isTaskDoneForDate(t, today)).length;
  const badge = document.getElementById('task-badge');
  if (badge) badge.textContent = count || '';
  if (badge) badge.style.display = count ? '' : 'none';
}

// ══════════════════════════════════════════════
//  VIEWS
// ══════════════════════════════════════════════
function setScheduleMode(mode) {
  document.getElementById('schedule-week').classList.toggle('hidden', mode !== 'week');
  document.getElementById('schedule-list').classList.toggle('hidden', mode !== 'list');
  document.getElementById('btn-view-week').classList.toggle('active', mode === 'week');
  document.getElementById('btn-view-list').classList.toggle('active', mode === 'list');
  if (mode === 'week') renderCalendar();
}

function toggleFreeTime() {
  state.showFreeTime = !state.showFreeTime;
  saveState();
  renderCalendar();
}

function renderCalendar() {
  const headerEl = document.getElementById('cal-header');
  if (!headerEl) return;
  const freeBtn = document.getElementById('btn-toggle-free-time');
  if (freeBtn) {
    freeBtn.classList.toggle('active', !!state.showFreeTime);
    freeBtn.textContent = state.showFreeTime ? 'Hide Free Time' : 'Show Free Time';
  }
  const now = new Date();
  const todayDay = now.getDay();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - todayDay);

  const timesEl = document.getElementById('cal-times');
  const daysEl = document.getElementById('cal-days');

  // Render Header
  let headerHtml = `<div class="cal-header-day"></div>`;
  for(let i=0; i<7; i++) {
    const d = new Date(startOfWeek);
    d.setDate(startOfWeek.getDate() + i);
    const isToday = i === todayDay && d.getMonth() === now.getMonth();
    headerHtml += `<div class="cal-header-day${isToday?' active':''}">${DAYS[i]}<br>${d.getDate()}</div>`;
  }
  headerEl.innerHTML = headerHtml;

  // Render Times
  let timesHtml = '';
  for(let i=0; i<24; i++) {
    timesHtml += `<div class="cal-time">${i===0?'12 AM':(i<12?i+' AM':(i===12?'12 PM':(i-12)+' PM'))}</div>`;
  }
  timesEl.innerHTML = timesHtml;

  // Render Days Columns
  let daysHtml = '';
  for(let i=0; i<7; i++) {
    const targetDate = new Date(startOfWeek);
    targetDate.setDate(startOfWeek.getDate() + i);
    const targetDateStr = targetDate.toISOString().split('T')[0];
    const evs = getEventsForDay(targetDateStr, i);

    let evHtml = '';
    evs.forEach(ev => {
       const startMin = timeMins(ev.start);
       const endMin = timeMins(ev.end);
       const dur = endMin - startMin;
       const top = startMin; // 1 min = 1px (since 60px per hour)
       const height = dur;
       const borderColor = getPriorityBorderColor(ev);
       evHtml += `<div class="cal-event priority-stripe" role="button" tabindex="0" aria-label="${esc(ev.title)}, ${fmt12(ev.start)} to ${fmt12(ev.end)}${ev.location ? ', Location: ' + ev.location : ''}" onclick="editEvent('${esc(ev.id)}')" onkeydown="if(event.key==='Enter' || event.key===' ') { event.preventDefault(); editEvent('${esc(ev.id)}'); }" style="--priority-stripe-color:${borderColor};top:${top}px; height:${height}px; background:var(--surface2); border:1px solid var(--border); color:var(--text);">
         <div class="cal-event-title">${esc(ev.title)}</div>
         <div style="font-size:8px; opacity:0.8;">${fmt12(ev.start)}</div>
         ${ev.location ? `<div style="font-size:8px; opacity:0.75;">${locationLink(ev.location)}</div>` : ''}
       </div>`;
    });

    let freeHtml = '';
    if (state.showFreeTime) {
      const sorted = [...evs].sort((a,b) => timeMins(a.start) - timeMins(b.start));
      let cursor = 8 * 60;
      const dayEnd = 23 * 60;
      sorted.forEach(ev => {
        const startMin = Math.max(8 * 60, timeMins(ev.start));
        const endMin = Math.min(dayEnd, timeMins(ev.end));
        if (startMin - cursor >= 30) {
          const gap = startMin - cursor;
          freeHtml += `<div class="cal-free-block" style="top:${cursor}px;height:${gap}px;">${gap >= 60 ? '<span>free</span>' : ''}</div>`;
        }
        cursor = Math.max(cursor, endMin);
      });
      if (dayEnd - cursor >= 30) {
        const gap = dayEnd - cursor;
        freeHtml += `<div class="cal-free-block" style="top:${cursor}px;height:${gap}px;">${gap >= 60 ? '<span>free</span>' : ''}</div>`;
      }
    }

    let gridLines = `<div class="cal-grid-lines">`;
    for(let h=0; h<24; h++) gridLines += `<div class="cal-grid-line"></div>`;
    gridLines += `</div>`;

    daysHtml += `<div class="cal-day-col">${gridLines}${freeHtml}${evHtml}</div>`;
  }
  daysEl.innerHTML = daysHtml;

  // Auto-scroll to current time (use requestAnimationFrame so layout is ready)
  requestAnimationFrame(() => {
    const wrap = document.querySelector('.cal-grid-wrap');
    if (wrap) {
      wrap.scrollTop = Math.max(0, (now.getHours() * 60) - 60);
    }
  });
}
const views = ['dashboard','schedule','tasks','deadlines','focus','settings'];
function showView(v, options) {
  const opts = options || {};
  if (!isValidView(v)) v = DEFAULT_VIEW;

  // Close drawer if it was open (drawer items: settings)
  closeMobileDrawer(false);
  closeChatOverlay(false);
  state.currentView = v;
  if (opts.persist !== false) saveState();
  
  // Set view visibility
  views.forEach(id => {
    const el = document.getElementById('view-'+id);
    if (el) el.classList.toggle('hidden', id!==v);
    const nav = document.getElementById('nav-'+id);
    if(nav) nav.classList.toggle('active', id===v);
    const mnav = document.getElementById('mnav-'+id);
    if(mnav) mnav.classList.toggle('active', id===v);
  });
  
  // Highlight "More" tab if viewing overflow items (only settings remains)
  const overflowViews = ['settings'];
  const mnavMore = document.getElementById('mnav-more');
  if(mnavMore) {
    mnavMore.classList.toggle('active', overflowViews.includes(v));
  }
  
  const titles = { dashboard:'Dashboard', schedule:'Schedule', tasks:'Tasks', deadlines:'Deadlines', focus:'Focus', settings:'Settings' };
  document.getElementById('mobile-title').textContent = titles[v] || v;
  if(v==='settings') {
    const keyEl = document.getElementById('settings-api-key');
    if(keyEl) keyEl.value = state.apiKey||'';
    const themeEl = document.getElementById('settings-theme');
    if(themeEl) themeEl.value = state.theme || 'dark';
    const accentEl = document.getElementById('settings-accent');
    if(accentEl) accentEl.value = state.accent || '#7c6ff7';
    const weeklyLimitEl = document.getElementById('settings-weekly-limit');
    if(weeklyLimitEl) weeklyLimitEl.value = state.weeklyHourLimit || 50;
    updateNotifStatusUI();
    updateGCalUI();
    updateWAUI();
    updateAppVersionUI();
  }
  if(v==='schedule') { requestAnimationFrame(() => { renderCalendar(); }); }
  if(v==='deadlines') renderDeadlines();

  if (opts.pushHistory !== false) {
    const hash = v === DEFAULT_VIEW ? '' : '#' + v;
    history.pushState({ view: v }, '', hash || location.pathname + location.search);
  }
}

// ══════════════════════════════════════════════
//  MOBILE DRAWER (MORE MENU)
// ══════════════════════════════════════════════
function toggleMobileDrawer() {
  const drawer = document.getElementById('mobile-drawer');
  const overlay = document.getElementById('mobile-drawer-overlay');
  if(!drawer || !overlay) return;
  
  const isOpen = drawer.classList.contains('open');
  if (isOpen) closeMobileDrawer();
  else openMobileDrawer();
}

function openMobileDrawer(pushHistory = true) {
  const drawer = document.getElementById('mobile-drawer');
  const overlay = document.getElementById('mobile-drawer-overlay');
  if(!drawer || !overlay) return;
  drawer.classList.add('open');
  overlay.classList.add('open');
  if (pushHistory) history.pushState({ panel: 'drawer', view: state.currentView || DEFAULT_VIEW }, '', location.href);
}

function closeMobileDrawer(useHistory = true) {
  const drawer = document.getElementById('mobile-drawer');
  const overlay = document.getElementById('mobile-drawer-overlay');
  if(!drawer || !overlay) return;

  const wasOpen = drawer.classList.contains('open');
  drawer.classList.remove('open');
  overlay.classList.remove('open');
  if (useHistory && wasOpen && history.state && history.state.panel === 'drawer') history.back();
}

// ══════════════════════════════════════════════
//  EVENTS CRUD
// ══════════════════════════════════════════════
let editingEventId = null;
function showAddModal() {
  editingEventId = null;
  document.getElementById('event-modal-title').textContent = 'Add Event';
  document.getElementById('ev-title').value = '';
  document.getElementById('ev-date').value = todayStr();
  document.getElementById('ev-start').value = '18:00';
  document.getElementById('ev-end').value = '19:00';
  document.getElementById('ev-category').value = 'class';
  document.getElementById('ev-location').value = '';
  document.getElementById('ev-recurring').value = 'none';
  document.getElementById('ev-recurring-end').value = '';
  document.getElementById('ev-color').value = CAT_COLORS.class.dot;
  document.getElementById('ev-color').dataset.reset = 'true';
  openModal('event-modal');
}
function editEvent(id) {
  const ev = state.events.find(e=>e.id===id);
  if (!ev) return;
  editingEventId = id;
  document.getElementById('event-modal-title').textContent = 'Edit Event';
  document.getElementById('ev-title').value = ev.title;
  document.getElementById('ev-date').value = ev.date;
  document.getElementById('ev-start').value = ev.start;
  document.getElementById('ev-end').value = ev.end;
  document.getElementById('ev-category').value = ev.category;
  document.getElementById('ev-location').value = ev.location||'';
  document.getElementById('ev-recurring').value = ev.recurring||'none';
  document.getElementById('ev-recurring-end').value = ev.recurringEndDate || '';
  document.getElementById('ev-color').value = ev.color || getEventColor(ev);
  document.getElementById('ev-color').dataset.reset = ev.color ? '' : 'true';
  openModal('event-modal');
}
function resetEventColor() {
  const category = document.getElementById('ev-category').value || 'other';
  document.getElementById('ev-color').value = (CAT_COLORS[category] || CAT_COLORS.other).dot;
  document.getElementById('ev-color').dataset.reset = 'true';
}
function saveEvent() {
  const title = document.getElementById('ev-title').value.trim();
  if (!title) { alert('Please enter a title'); return; }
  const existingEvent = editingEventId ? state.events.find(e=>e.id===editingEventId) : null;
  const ev = {
    id: editingEventId || 'e'+Date.now(),
    title,
    date: document.getElementById('ev-date').value,
    start: document.getElementById('ev-start').value,
    end: document.getElementById('ev-end').value,
    category: document.getElementById('ev-category').value,
    location: document.getElementById('ev-location').value.trim(),
    recurring: document.getElementById('ev-recurring').value,
    recurringEndDate: document.getElementById('ev-recurring-end').value || '',
    color: document.getElementById('ev-color').dataset.reset === 'true' ? '' : (document.getElementById('ev-color').value || ''),
    notes: document.getElementById('ev-notes')?.value || existingEvent?.notes || '',
  };
  document.getElementById('ev-color').dataset.reset = '';
  if (editingEventId) {
    const idx = state.events.findIndex(e=>e.id===editingEventId);
    if (idx>=0) state.events[idx] = ev;
  } else {
    state.events.push(ev);
  }
  if (navigator.vibrate) navigator.vibrate(30);
  saveState(); render();
  closeModal('event-modal');
}

function itemLabelForUndo(entry) {
  if (!entry) return 'item';
  if (entry.type === 'delete_event') return entry.payload.title || 'event';
  if (entry.type === 'delete_task') return entry.payload.name || 'task';
  if (entry.type === 'delete_attendance') return entry.payload.subject || 'attendance record';
  if (entry.type === 'delete_grade') return entry.payload.subject || 'grade';
  return 'item';
}

function pushUndoEntry(entry) {
  entry.toastId = Date.now() + '_' + Math.random().toString(36).slice(2);
  undoStack.push(entry);
  if (undoStack.length > MAX_UNDO_ENTRIES) undoStack.shift();
  redoStack = [];
  return entry;
}

function undoLast() {
  if (undoStack.length === 0) return;
  const entry = undoStack.pop();
  restoreUndoEntry(entry);
}

function restoreUndoEntry(entry) {
  redoStack.push(entry);
  if (redoStack.length > MAX_UNDO_ENTRIES) redoStack.shift();
  
  if (entry.type === 'delete_event') {
    state.events.push(entry.payload);
  } else if (entry.type === 'delete_task') {
    state.tasks.push(entry.payload);
  } else if (entry.type === 'delete_attendance') {
    state.attendance.push(entry.payload);
  } else if (entry.type === 'delete_grade') {
    state.grades.push(entry.payload);
  }
  
  saveState();
  render();
  showToast('Restored ' + itemLabelForUndo(entry));
}

function undoToastEntry(toastId) {
  const idx = undoStack.findIndex(entry => entry.toastId === toastId);
  if (idx < 0) return;
  const entry = undoStack.splice(idx, 1)[0];
  restoreUndoEntry(entry);
  document.querySelector(`[data-undo-toast-id="${toastId}"]`)?.remove();
}

function redoLast() {
  if (redoStack.length === 0) return;
  const entry = redoStack.pop();
  undoStack.push(entry);
  if (undoStack.length > MAX_UNDO_ENTRIES) undoStack.shift();
  
  if (entry.type === 'delete_event') {
    state.events = state.events.filter(e => e.id !== entry.payload.id);
  } else if (entry.type === 'delete_task') {
    state.tasks = state.tasks.filter(t => t.id !== entry.payload.id);
  } else if (entry.type === 'delete_attendance') {
    state.attendance = state.attendance.filter(a => a.id !== entry.payload.id);
  } else if (entry.type === 'delete_grade') {
    state.grades = state.grades.filter(g => g.id !== entry.payload.id);
  }
  
  saveState();
  render();
  showToast('Deleted ' + itemLabelForUndo(entry));
}

function showUndoToast(entry) {
  let label = '';
  if (entry.type === 'delete_event') label = entry.payload.title;
  else if (entry.type === 'delete_task') label = entry.payload.name;
  else if (entry.type === 'delete_attendance') label = entry.payload.subject;
  else if (entry.type === 'delete_grade') label = entry.payload.subject;
  
  const toast = document.createElement('div');
  toast.className = 'undo-toast';
  toast.innerHTML = `<span>↩ Restored: ${esc(label)}</span><button onclick="this.parentElement.remove()">✕</button>`;
  document.body.appendChild(toast);
  
  setTimeout(() => {
    if (toast.parentElement) {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }
  }, 8000);
}

function showDeleteUndoToast(entry) {
  const label = itemLabelForUndo(entry);
  const toast = document.createElement('div');
  toast.className = 'undo-toast';
  toast.dataset.undoToastId = entry.toastId;
  toast.innerHTML = `<span>Deleted ${esc(label)}</span><button class="undo-toast-action" onclick="undoToastEntry('${entry.toastId}')">Undo</button><button onclick="this.parentElement.remove()">x</button>`;
  document.body.appendChild(toast);

  setTimeout(() => {
    const idx = undoStack.findIndex(item => item.toastId === entry.toastId);
    if (idx >= 0) undoStack.splice(idx, 1);
    if (toast.parentElement) {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }
  }, 8000);
}

function deleteEvent(id) {
  const ev = state.events.find(e => e.id === id);
  let entry = null;
  if (ev) {
    entry = pushUndoEntry({ type: 'delete_event', payload: { ...ev } });
  }
  state.events = state.events.filter(e=>e.id!==id);
  saveState(); render();
  if (entry) showDeleteUndoToast(entry);
}

function showQuickAdd(triggerEvent) {
  if (triggerEvent) triggerEvent.stopPropagation();
  const popover = document.getElementById('quick-add-popover');
  if (!popover) return;
  popover.classList.remove('hidden');
  document.getElementById('qa-title').value = '';
  document.getElementById('qa-date').value = todayStr();
  document.getElementById('qa-start').value = '18:00';
  document.getElementById('qa-category').value = 'class';
  if (triggerEvent?.currentTarget && window.matchMedia('(min-width: 769px)').matches) {
    const rect = triggerEvent.currentTarget.getBoundingClientRect();
    const margin = 12;
    const popoverWidth = popover.offsetWidth || 300;
    popover.style.top = `${Math.min(rect.bottom + margin, window.innerHeight - 360)}px`;
    popover.style.left = `${Math.max(16, Math.min(rect.right - popoverWidth, window.innerWidth - popoverWidth - 16))}px`;
    popover.style.right = 'auto';
    popover.style.bottom = 'auto';
  } else {
    popover.removeAttribute('style');
  }
  // Focus title input
  setTimeout(() => document.getElementById('qa-title').focus(), 100);
  // Close popover when clicking outside
  document.addEventListener('click', closeQuickAddOnClickOutside);
}

function closeQuickAdd() {
  const popover = document.getElementById('quick-add-popover');
  if (popover) popover.classList.add('hidden');
  document.removeEventListener('click', closeQuickAddOnClickOutside);
}

function closeQuickAddOnClickOutside(e) {
  const popover = document.getElementById('quick-add-popover');
  const btn = document.getElementById('btn-quick-add');
  if (popover && !popover.contains(e.target) && !btn.contains(e.target)) {
    closeQuickAdd();
  }
}

function saveQuickEvent() {
  const title = document.getElementById('qa-title').value.trim();
  if (!title) { alert('Please enter a title'); return; }
  const start = document.getElementById('qa-start').value;
  if (!start) { alert('Please set a start time'); return; }
  const end = document.getElementById('qa-end')?.value || addMinutesToTime(start, 60);
  
  const ev = {
    id: 'e'+Date.now(),
    title,
    date: document.getElementById('qa-date').value || todayStr(),
    start,
    end,
    category: document.getElementById('qa-category').value,
    location: '',
    recurring: 'none',
    notes: '',
  };
  state.events.push(ev);
  if (navigator.vibrate) navigator.vibrate(30);
  saveState(); render();
  closeQuickAdd();
}

// ══════════════════════════════════════════════
//  FEATURE 1: SEARCH & FILTER EVENTS
// ══════════════════════════════════════════════
function filterScheduleEvents() {
  const searchTerm = document.getElementById('schedule-search')?.value?.toLowerCase() || '';
  const categoryFilter = document.getElementById('schedule-category-filter')?.value || '';
  
  const allEventsList = document.getElementById('all-events-list');
  if (!allEventsList) return;
  
  const evs = getAllEvents();
  const filtered = evs.filter(ev => {
    const matchesSearch = ev.title.toLowerCase().includes(searchTerm) || 
                         (ev.location?.toLowerCase().includes(searchTerm));
    const matchesCategory = !categoryFilter || ev.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });
  
  // Re-render the filtered list
  allEventsList.innerHTML = filtered.map(ev => {
    const cat = CAT_COLORS[ev.category] || CAT_COLORS.other;
    const evColor = getEventColor(ev);
    return `<div class="timeline-item" onclick="editEvent('${esc(ev.id)}')">
      <div class="timeline-time" style="width:70px;font-size:10px;">${esc(ev.date)}</div>
      <div class="timeline-dot" style="background:${evColor}"></div>
      <div class="timeline-content">
        <div class="timeline-title">${esc(ev.title)}</div>
        <div class="timeline-sub">${fmt12(ev.start)} – ${fmt12(ev.end)}${locationLink(ev.location) ? ' · ' + locationLink(ev.location) : ''}</div>
      </div>
      <div style="display:flex;align-items:center;gap:6px;flex-shrink:0;">
        <span class="badge" style="background:${getEventBg(ev)};color:${evColor}">${cat.label}</span>
      </div>
    </div>`;
  }).join('') || '<div class="empty"><div class="empty-icon">📅</div>No events match your search.</div>';
}

// ══════════════════════════════════════════════
//  FEATURE 3: DUPLICATE EVENT
// ══════════════════════════════════════════════
function duplicateEvent(id) {
  const ev = state.events.find(e=>e.id===id);
  if (!ev) return;

  // Create a one-off copy on the next calendar day.
  // 'recurring' is intentionally reset to 'none' — duplicating a weekly
  // class should produce a single extra session, not another recurring series.
  const tomorrow = new Date(ev.date + 'T12:00:00');
  tomorrow.setDate(tomorrow.getDate() + 1);
  const newDate = tomorrow.toISOString().split('T')[0];

  const newEvent = {
    ...ev,
    id: 'e' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
    date: newDate,
    recurring: 'none',   // Bug D fix: never inherit the source's recurrence
  };

  state.events.push(newEvent);
  saveState();
  render();
  showToast(`✓ "${ev.title}" duplicated for ${newDate}`);
}

// ══════════════════════════════════════════════
//  CLASS NOTES VIEWER (Feature 8)
// ══════════════════════════════════════════════
let viewingNotesEventId = null;
function openNotesViewer(id) {
  const ev = state.events.find(e => e.id === id);
  if (!ev) return;
  viewingNotesEventId = id;
  const titleEl = document.getElementById('notes-modal-title');
  const metaEl = document.getElementById('notes-modal-meta');
  const body = document.getElementById('notes-modal-body');
  // Notes UI may have been removed; guard against missing DOM.
  if (!titleEl || !metaEl || !body) return;
  titleEl.textContent = `📝 ${ev.title}`;
  metaEl.textContent =
    `${ev.date} · ${fmt12(ev.start)} – ${fmt12(ev.end)}${ev.location ? ' · ' + ev.location : ''}`;
  body.textContent = ev.notes && ev.notes.trim() ? ev.notes : '(No notes yet — click Edit Notes to add some.)';
  body.style.color = ev.notes && ev.notes.trim() ? 'var(--text)' : 'var(--text3)';
  openModal('notes-modal');
}
function editEventFromNotes() {
  const id = viewingNotesEventId;
  closeModal('notes-modal', false);
  if (!id) return;
  const ev = state.events.find(e => e.id === id);
  if (!ev) return;
  editingEventId = id;
  document.getElementById('event-modal-title').textContent = 'Edit Event';
  document.getElementById('ev-title').value = ev.title;
  document.getElementById('ev-date').value = ev.date;
  document.getElementById('ev-start').value = ev.start;
  document.getElementById('ev-end').value = ev.end;
  document.getElementById('ev-category').value = ev.category;
  document.getElementById('ev-location').value = ev.location || '';
  document.getElementById('ev-recurring').value = ev.recurring || 'none';
  document.getElementById('ev-recurring-end').value = ev.recurringEndDate || '';
  document.getElementById('ev-color').value = ev.color || getEventColor(ev);
  document.getElementById('ev-color').dataset.reset = ev.color ? '' : 'true';
  const notesEl = document.getElementById('ev-notes');
  if (notesEl) notesEl.value = ev.notes || '';
  openModal('event-modal', false);
  history.replaceState({ panel: 'modal', modal: 'event-modal', view: state.currentView || DEFAULT_VIEW }, '', location.href);
}

// ══════════════════════════════════════════════
//  TASKS CRUD
// ══════════════════════════════════════════════
let taskModalSubtasks = [];

function renderTaskModalSubtasks() {
  const el = document.getElementById('tk-subtasks-list');
  if (!el) return;
  el.innerHTML = taskModalSubtasks.map(st => `<div class="subtask-editor-item">
    <span>${esc(st.name)}</span>
    <button type="button" onclick="removeTaskModalSubtask('${esc(st.id)}')">x</button>
  </div>`).join('');
}

function addTaskModalSubtask() {
  const input = document.getElementById('tk-subtask-input');
  const name = input.value.trim();
  if (!name) return;
  taskModalSubtasks.push({ id: 'st' + Date.now() + '_' + Math.random().toString(36).slice(2, 6), name, done: false });
  input.value = '';
  renderTaskModalSubtasks();
}

function removeTaskModalSubtask(id) {
  taskModalSubtasks = taskModalSubtasks.filter(st => st.id !== id);
  renderTaskModalSubtasks();
}

function showAddTaskModal() {
  taskModalSubtasks = [];
  document.getElementById('tk-name').value = '';
  document.getElementById('tk-due').value = todayStr();
  document.getElementById('tk-priority').value = 'medium';
  document.getElementById('tk-recurring').value = 'none';
  document.getElementById('tk-recurring-day').value = String(new Date().getDay());
  document.getElementById('tk-subtask-input').value = '';
  renderTaskModalSubtasks();
  openModal('task-modal');
}
function saveTask() {
  const name = document.getElementById('tk-name').value.trim();
  if (!name) { alert('Please enter a task name'); return; }
  state.tasks.push({
    id: 't'+Date.now(),
    name,
    due: document.getElementById('tk-due').value,
    priority: document.getElementById('tk-priority').value,
    subtasks: taskModalSubtasks,
    recurring: document.getElementById('tk-recurring').value,
    recurringDay: Number(document.getElementById('tk-recurring-day').value),
    doneDates: [],
    done: false,
  });
  saveState(); render();
  closeModal('task-modal');
}
function toggleTask(id, date = todayStr()) {
  const t = state.tasks.find(t=>t.id===id);
  if (t) { 
    if ((t.recurring || 'none') !== 'none') {
      t.doneDates = t.doneDates || [];
      if (t.doneDates.includes(date)) t.doneDates = t.doneDates.filter(d => d !== date);
      else t.doneDates.push(date);
    } else {
      t.done = !t.done;
      if ((t.subtasks || []).length && t.done) t.subtasks.forEach(st => st.done = true);
    }
    if (isTaskDoneForDate(t, date) && navigator.vibrate) navigator.vibrate(40);
    saveState(); render(); 
  }
}

function toggleSubtask(taskId, subtaskId) {
  const t = state.tasks.find(task => task.id === taskId);
  const st = t?.subtasks?.find(item => item.id === subtaskId);
  if (!st) return;
  st.done = !st.done;
  t.done = t.subtasks.length ? t.subtasks.every(item => item.done) : !!t.done;
  saveState();
  render();
}
function deleteTask(id) {
  const task = state.tasks.find(t => t.id === id);
  let entry = null;
  if (task) {
    entry = pushUndoEntry({ type: 'delete_task', payload: { ...task } });
  }
  state.tasks = state.tasks.filter(t=>t.id!==id);
  saveState(); render();
  if (entry) showDeleteUndoToast(entry);
}

// ══════════════════════════════════════════════
//  MOBILE CHAT
// ══════════════════════════════════════════════
function openChatOverlay(pushHistory = true) {
  const overlay = document.getElementById('chat-overlay');
  overlay.classList.add('open');
  document.getElementById('chat-close-btn').style.display = '';
  document.getElementById('chat-fab').style.display = 'none';
  requestAnimationFrame(() => {
    const msgsEl = document.getElementById('chat-messages');
    if (msgsEl) msgsEl.scrollTop = msgsEl.scrollHeight;
  });
  if (pushHistory) history.pushState({ panel: 'chat', view: state.currentView || DEFAULT_VIEW }, '', location.href);
}
function closeChatOverlay(useHistory = true) {
  const overlay = document.getElementById('chat-overlay');
  const wasOpen = overlay.classList.contains('open');
  overlay.classList.remove('open');
  document.getElementById('chat-close-btn').style.display = 'none';
  document.getElementById('chat-fab').style.display = '';
  if (useHistory && wasOpen && history.state && history.state.panel === 'chat') history.back();
}

// ══════════════════════════════════════════════
//  API KEY
// ══════════════════════════════════════════════
function saveApiKey() {
  const key = document.getElementById('settings-api-key').value.trim();
  const statusEl = document.getElementById('api-key-status');
  state.apiKey = key;
  let stored = true;
  try {
    if (key) localStorage.setItem(API_KEY_STORAGE_KEY, key);
    else localStorage.removeItem(API_KEY_STORAGE_KEY);
  } catch(e) {
    stored = false;
  }
  saveState();
  statusEl.style.display = 'block';
  if (stored) {
    if (key) { statusEl.textContent = '✓ Key saved'; statusEl.style.color='var(--green)'; }
    else { statusEl.textContent = 'Key cleared'; statusEl.style.color='var(--text3)'; }
  } else {
    statusEl.textContent = 'Could not save key on this device.';
    statusEl.style.color = 'var(--coral)';
  }
  document.getElementById('api-status-sidebar').textContent = key ? '⬤ Connected' : '⬤ No key';
  document.getElementById('api-status-sidebar').style.color = key ? 'var(--green)' : 'var(--coral)';
}

// ══════════════════════════════════════════════
//  AI CHAT
// ══════════════════════════════════════════════

// Gemini fetch — native browser CORS support, no proxy needed
async function geminiFetch(payload) {
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + encodeURIComponent(state.apiKey.trim());
  return await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}
let chatHistory = [];

function buildSystemPrompt() {
  const today = new Date();
  const todayEvs = getTodayEvents();
  const allEvs = getAllEvents().slice(0,30);
  const pendingTasks = state.tasks.filter(t=>!isTaskComplete(t));

  return `You are Lazy Panda 🐼, an intelligent scheduling assistant powered by Gemini AI embedded in a productivity app.

CURRENT DATE & TIME: ${today.toDateString()}, ${today.toLocaleTimeString()}
TODAY IS: ${DAYS[today.getDay()]}

TODAY'S SCHEDULE:
${todayEvs.length ? todayEvs.map(e=>`- ${e.title} | ${fmt12(e.start)}–${fmt12(e.end)} | ${e.location||'N/A'} | ${e.category}`).join('\n') : 'No events today'}

ALL UPCOMING EVENTS (next 30):
${allEvs.map(e=>`- ${e.title} | ${e.date} | ${fmt12(e.start)}–${fmt12(e.end)} | ${e.location||'N/A'} | ${e.recurring||'once'}`).join('\n')}

PENDING TASKS:
${pendingTasks.length ? pendingTasks.map(t=>`- ${t.name} | Due: ${t.due} | ${t.priority} priority`).join('\n') : 'No pending tasks'}

TIME RESOLUTION RULES (apply these before creating events):
- "morning" → 09:00–10:00
- "afternoon" → 14:00–15:00
- "evening" → 18:00–19:00
- "night" → 21:00–22:00
- "tomorrow" → ${new Date(today.getTime() + 86400000).toISOString().split('T')[0]}
- "next Monday/Tuesday/..." → compute the date of the next occurrence of that weekday
- "after [class name]" → look up that event's end time and use it as the start
- "before [class name]" → use 1 hour before that event's start
- If duration is not specified, default to 1 hour.
- Always confirm the resolved time in your response before executing the ACTION block.

YOUR CAPABILITIES:
You can help the user manage their schedule through conversation. When a user wants to add/edit/delete events or tasks, respond in a friendly way AND include a JSON action block at the END of your response in this exact format:

ACTION:{"type":"create_event","data":{"title":"...","date":"YYYY-MM-DD","start":"HH:MM","end":"HH:MM","category":"class|study|meeting|personal|other","location":"...","recurring":"none|daily|weekly|weekends|biweekly|monthly","recurringEndDate":"","color":""}}

ACTION:{"type":"create_task","data":{"name":"...","due":"YYYY-MM-DD","priority":"high|medium|low","recurring":"none|daily|weekly","subtasks":[]}}

ACTION:{"type":"delete_event","data":{"id":"..."}}

ACTION:{"type":"delete_task","data":{"id":"..."}}

Only include the ACTION block when actually performing an operation. Always be conversational, helpful, and proactive about suggesting study sessions or reminders. If info is missing, ask clarifying questions before executing.`;
}

function addMsg(role, text, isAction) {
  const msgsEl = document.getElementById('chat-messages');
  const timeStr = new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
  const div = document.createElement('div');
  div.className = `msg ${role}`;
  div.innerHTML = `<div class="msg-bubble">${text.replace(/\n/g,'<br>')}</div><div class="msg-time">${timeStr}</div>`;
  if (isAction) {
    const card = document.createElement('div');
    card.className = 'action-card';
    card.innerHTML = `<div class="action-card-title">✦ Action Performed</div>${isAction}`;
    div.appendChild(card);
  }
  msgsEl.appendChild(div);
  msgsEl.scrollTop = msgsEl.scrollHeight;
}

function showTyping() {
  const msgsEl = document.getElementById('chat-messages');
  const div = document.createElement('div');
  div.className = 'msg ai'; div.id = 'typing-msg';
  div.innerHTML = `<div class="typing-indicator"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div>`;
  msgsEl.appendChild(div);
  msgsEl.scrollTop = msgsEl.scrollHeight;
}

function removeTyping() {
  const el = document.getElementById('typing-msg');
  if (el) el.remove();
}

function parseAndExecuteActions(text) {
  const actionRegex = /ACTION:(\{.*?\})/gs;
  let match; let results = [];
  let cleanText = text;

  while ((match = actionRegex.exec(text)) !== null) {
    try {
      const action = JSON.parse(match[1]);
      cleanText = cleanText.replace(match[0], '').trim();
      let result = '';

      if (action.type === 'create_event') {
        const ev = { id: 'e'+Date.now()+Math.random(), recurring:'none', recurringEndDate:'', color:'', ...action.data };
        state.events.push(ev);
        result = `Event "${ev.title}" added on ${ev.date} at ${fmt12(ev.start)}`;
        saveState(); render();
      } else if (action.type === 'create_task') {
        const task = { id: 't'+Date.now()+Math.random(), done: false, subtasks: [], recurring: 'none', doneDates: [], ...action.data };
        task.recurringDay = task.recurringDay ?? new Date((task.due || todayStr()) + 'T12:00:00').getDay();
        state.tasks.push(task);
        result = `Task "${task.name}" added (due ${task.due})`;
        saveState(); render();
      } else if (action.type === 'delete_event') {
        const ev = state.events.find(e=>e.id===action.data.id);
        if (ev) {
          state.events = state.events.filter(e=>e.id!==action.data.id);
          result = `Removed "${ev.title}"`;
          saveState(); render();
        }
      } else if (action.type === 'delete_task') {
        const task = state.tasks.find(t=>t.id===action.data.id);
        if (task) {
          state.tasks = state.tasks.filter(t=>t.id!==action.data.id);
          result = `Removed task "${task.name}"`;
          saveState(); render();
        }
      }
      if (result) results.push(result);
    } catch(e) { console.error('Action parse error:', e); }
  }
  return { cleanText, results };
}

// ══════════════════════════════════════════════
//  PHASE 4.2 — VOICE COMMANDS
// ══════════════════════════════════════════════
let voiceRecognition = null;
let isListening = false;

function startVoiceInput() {
  const voiceBtn = document.getElementById('voice-btn');
  if (!voiceBtn) return;

  // Check for Web Speech API support
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    showToast('🎤 Voice input not supported in this browser. Use Chrome, Edge, or Safari.');
    return;
  }

  // If already listening, stop
  if (isListening) {
    if (voiceRecognition) voiceRecognition.stop();
    return;
  }

  // Create recognition instance if not already created
  if (!voiceRecognition) {
    voiceRecognition = new SpeechRecognition();
    voiceRecognition.lang = 'en-US';
    voiceRecognition.interimResults = false;
    voiceRecognition.maxAlternatives = 1;

    voiceRecognition.onstart = () => {
      isListening = true;
      voiceBtn.classList.add('active');
      voiceBtn.setAttribute('aria-label', 'Listening... click to stop');
      voiceBtn.textContent = '🔴';
    };

    voiceRecognition.onresult = (event) => {
      let transcript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const isFinal = event.results[i].isFinal;
        transcript += event.results[i][0].transcript;
        if (isFinal) {
          // Insert transcript into chat input
          const input = document.getElementById('chat-input');
          if (input) {
            input.value = transcript.trim();
            // Auto-resize textarea
            input.style.height = '';
            input.style.height = Math.min(input.scrollHeight, 100) + 'px';
            // Auto-submit the message
            setTimeout(() => sendMessage(), 100);
          }
        }
      }
    };

    voiceRecognition.onerror = (event) => {
      const errorMessages = {
        'no-speech': '🎤 No speech detected. Please try again.',
        'audio-capture': '🎤 No microphone detected. Check your permissions.',
        'network': '🎤 Network error. Check your connection.',
        'denied': '🎤 Microphone access denied. Enable in your browser settings.'
      };
      const msg = errorMessages[event.error] || `🎤 Voice error: ${event.error}`;
      showToast(msg);
    };

    voiceRecognition.onend = () => {
      isListening = false;
      voiceBtn.classList.remove('active');
      voiceBtn.setAttribute('aria-label', 'Voice input: click to speak your message');
      voiceBtn.textContent = '🎤';
    };
  }

  // Start listening
  voiceRecognition.start();
}

async function sendMessage() {
  const input = document.getElementById('chat-input');
  const msg = input.value.trim();
  if (!msg) return;

  input.value = ''; input.style.height = '';
  addMsg('user', msg);
  chatHistory.push({ role: 'user', parts: [{ text: msg }] });
  // Cap history at 40 entries (~20 turns) to prevent unbounded memory growth
  if (chatHistory.length > 40) chatHistory.splice(0, chatHistory.length - 40);

  document.getElementById('chat-send').disabled = true;
  document.getElementById('ai-chat-status').textContent = 'Thinking…';
  showTyping();
  // Hide chips while waiting; they'll be restored after the reply
  const chipsEl = document.getElementById('quick-chips');
  if (chipsEl) chipsEl.style.display = 'none';

  try {
    const contents = chatHistory.slice(-12).filter(m => m.role === 'user' || m.role === 'model');

    // Try Gemini first, fall back to offline AI if no key
    if (!state.apiKey) {
      removeTyping();
      const offlineReply = await tryOfflineAI(msg);
      if (offlineReply) {
        addMsg('ai', `🔒 <em style="font-size:11px;color:var(--text3);">Offline AI (Gemini Nano)</em><br><br>${offlineReply}`);
        chatHistory.push({ role: 'model', parts: [{ text: offlineReply }] });
      } else {
        addMsg('ai', '⚠️ No API key found. Go to <b>Settings</b> → paste your Gemini API key → tap Save Key.<br><br>Get a free key at <a href="https://aistudio.google.com/apikey" target="_blank" style="color:#a78bfa;">aistudio.google.com/apikey</a>');
      }
      document.getElementById('chat-send').disabled = false;
      document.getElementById('ai-chat-status').textContent = 'Ready';
      if (chipsEl) chipsEl.style.display = '';
      return;
    }

    const res = await geminiFetch({
        system_instruction: { parts: [{ text: buildSystemPrompt() }] },
        contents: contents,
        generationConfig: { maxOutputTokens: 1200, temperature: 0.7 }
      });

    removeTyping();

    const responseText = await res.text();
    let data;
    try {
      data = JSON.parse(responseText);
    } catch(parseErr) {
      console.error('Non-JSON response:', responseText.substring(0, 200));
      addMsg('ai', '⚠️ Invalid API key or network error. Please check your Gemini API key in Settings.');
      document.getElementById('chat-send').disabled = false;
      document.getElementById('ai-chat-status').textContent = 'Ready';
      if (chipsEl) chipsEl.style.display = '';
      return;
    }

    if (!res.ok) {
      const errMsg = data.error?.message || 'API error ' + res.status;
      addMsg('ai', '⚠️ ' + errMsg);
    } else {
      const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Sorry, I got an empty response.';
      const { cleanText, results } = parseAndExecuteActions(raw);
      const actionSummary = results.join(', ');
      addMsg('ai', cleanText || raw, actionSummary || null);
      chatHistory.push({ role: 'model', parts: [{ text: raw }] });
    }
  } catch(e) {
    removeTyping();
    addMsg('ai', '⚠️ Connection error: ' + e.message + '. Check your Gemini API key in Settings.');
  }

  document.getElementById('chat-send').disabled = false;
  document.getElementById('ai-chat-status').textContent = 'Ready';
  // Restore quick chips so they stay accessible throughout the conversation
  if (chipsEl) chipsEl.style.display = '';
}

function sendQuick(msg) {
  document.getElementById('chat-input').value = msg;
  sendMessage();
}

function handleKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
}

function autoResize(el) {
  el.style.height = '';
  el.style.height = Math.min(el.scrollHeight, 100) + 'px';
}

// ══════════════════════════════════════════════
//  SETTINGS HELPERS
// ══════════════════════════════════════════════
function changeTheme() {
  const theme = document.getElementById('settings-theme').value;
  state.theme = theme;
  document.documentElement.setAttribute('data-theme', theme);
  saveState();
}

function changeAccent() {
  const accent = document.getElementById('settings-accent').value;
  state.accent = accent;
  document.documentElement.style.setProperty('--accent', accent);
  saveState();
}

function changeWeeklyHourLimit() {
  const input = document.getElementById('settings-weekly-limit');
  const value = Math.max(10, Math.min(120, Number(input.value) || 50));
  state.weeklyHourLimit = value;
  input.value = value;
  saveState();
  renderWorkloadWidget();
}
function toggleKeyVisibility() {
  const input = document.getElementById('settings-api-key');
  const eye = document.getElementById('key-eye');
  if (input.type === 'password') {
    input.type = 'text';
    eye.textContent = '🙈';
  } else {
    input.type = 'password';
    eye.textContent = '👁';
  }
}

async function testApiKey() {
  const key = document.getElementById('settings-api-key').value.trim();
  const statusEl = document.getElementById('api-key-status');
  const btn = document.getElementById('test-btn');

  if (!key) {
    statusEl.style.display = 'block';
    statusEl.style.color = 'var(--amber)';
    statusEl.textContent = '⚠️ Please enter an API key first.';
    return;
  }

  btn.textContent = '⏳ Testing…';
  btn.disabled = true;
  statusEl.style.display = 'block';
  statusEl.style.color = 'var(--text3)';
  statusEl.textContent = 'Sending test request to Gemini…';

  try {
    const testUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + encodeURIComponent(key.trim());
    const res = await fetch(testUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: 'Say hello in 3 words.' }] }], generationConfig: { maxOutputTokens: 20 } })
    });
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch(e) {
      statusEl.style.color = 'var(--coral)';
      statusEl.textContent = '❌ Invalid response — double check your key is correct.';
      btn.textContent = '🧪 Test Key'; btn.disabled = false;
      return;
    }
    if (res.ok && data.candidates?.[0]?.content?.parts?.[0]?.text) {
      statusEl.style.color = 'var(--green)';
      statusEl.textContent = '✅ Key works! Gemini replied: "' + data.candidates[0].content.parts[0].text.trim() + '"';
    } else {
      const msg = data.error?.message || 'Unknown error';
      statusEl.style.color = 'var(--coral)';
      statusEl.textContent = '❌ Error: ' + msg;
    }
  } catch(e) {
    statusEl.style.color = 'var(--coral)';
    statusEl.textContent = '❌ Network error: ' + e.message;
  }

  btn.textContent = '🧪 Test Key';
  btn.disabled = false;
}

// ══════════════════════════════════════════════
//  BACKUP & RESTORE
// ══════════════════════════════════════════════
function exportData() {
  const backup = {
    version: 2,
    exportedAt: new Date().toISOString(),
    events: state.events,
    tasks: state.tasks,
    attendance: state.attendance || [],
    grades: state.grades || [],
    settings: {
      apiKey: state.apiKey || '',
      theme: state.theme || 'dark',
      accent: state.accent || '#7c6ff7',
      notifMinutes: state.notifMinutes || 10,
      notificationsEnabled: !!state.notificationsEnabled,
      gcalClientId: state.gcalClientId || '',
      waPhone: state.waPhone || '',
      waServer: state.waServer || '',
      currentView: state.currentView || DEFAULT_VIEW,
      showFreeTime: state.showFreeTime !== false,
      weeklyHourLimit: state.weeklyHourLimit || 50
    },
    uploadedDocs: uploadedDocs || [],
    optimizerResult: lastOptimizerResult || null
  };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'lazy-panda-backup-' + new Date().toISOString().split('T')[0] + '.json';
  a.click();
  URL.revokeObjectURL(url);
  const el = document.getElementById('backup-status');
  if (el) {
    el.style.display = 'block';
    el.style.color = 'var(--green)';
    el.textContent = '✅ Exported ' + state.events.length + ' events, ' + state.tasks.length + ' tasks, ' + (state.attendance||[]).length + ' attendance records, ' + (state.grades||[]).length + ' grades.';
  }
}

function exportIcal() {
  const tzid = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const formatIcsDateTime = (dateStr, timeStr) => {
    return dateStr.replace(/-/g, '') + 'T' + timeStr.replace(':', '') + '00';
  };
  
  const escapeIcsText = (text) => {
    if (!text) return '';
    return String(text).replace(/\\/g, '\\\\').replace(/,/g, '\\,').replace(/;/g, '\\;').replace(/\r?\n/g, '\\n');
  };
  
  const vevents = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const in90Days = new Date();
  in90Days.setHours(0, 0, 0, 0);
  in90Days.setDate(today.getDate() + 90);
  
  // Generate events for 90 days
  state.events.forEach(ev => {
    const rec = ev.recurring || 'none';
    const evDate = new Date(ev.date + 'T00:00:00');
    if (rec === 'none' && evDate > in90Days) return;
    
    // Determine which days this event should appear on
    const daysToUse = [];
    const evDay = new Date(ev.date).getDay();
    
    const startDate = evDate > today ? new Date(evDate) : new Date(today);
    for (let d = startDate; d <= in90Days; d.setDate(d.getDate() + 1)) {
      const dStr = dateStr(d);
      const dayOfWeek = d.getDay();
      if (ev.recurringEndDate && dStr > ev.recurringEndDate) continue;
      
      let include = false;
      if (rec === 'none') {
        include = dStr === ev.date;
      } else if (rec === 'daily') {
        include = true;
      } else if (rec === 'weekly') {
        include = dayOfWeek === evDay;
      } else if (rec === 'weekends') {
        include = dayOfWeek === 0 || dayOfWeek === 6;
      } else if (rec === 'biweekly') {
        const weeks = Math.floor(daysBetween(ev.date, dStr) / 7);
        include = dayOfWeek === evDay && weeks >= 0 && weeks % 2 === 0;
      } else if (rec === 'monthly') {
        include = new Date(ev.date + 'T12:00:00').getDate() === d.getDate();
      }
      
      if (include) daysToUse.push(dStr);
    }
    
    // Create VEVENT for each occurrence
    daysToUse.forEach(dateStr => {
      const dtStart = formatIcsDateTime(dateStr, ev.start);
      const dtEnd = formatIcsDateTime(dateStr, ev.end);
      const uid = ev.id + '-' + dateStr + '@lazypanda';
      
      const vevent = [
        'BEGIN:VEVENT',
        'UID:' + uid,
        'DTSTART;TZID=' + tzid + ':' + dtStart,
        'DTEND;TZID=' + tzid + ':' + dtEnd,
        'SUMMARY:' + escapeIcsText(ev.title),
        'LOCATION:' + escapeIcsText(ev.location || ''),
        'DESCRIPTION:' + escapeIcsText(ev.notes || ''),
        'CATEGORIES:' + escapeIcsText(ev.category),
        'END:VEVENT'
      ];
      vevents.push(vevent.join('\r\n'));
    });
  });
  
  const now = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Lazy Panda//AI Scheduler//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Lazy Panda Schedule',
    'X-WR-TIMEZONE:' + tzid,
    'DTSTAMP:' + now,
    ...vevents,
    'END:VCALENDAR'
  ].join('\r\n');
  
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'lazy-panda-schedule-' + new Date().toISOString().split('T')[0] + '.ics';
  a.click();
  URL.revokeObjectURL(url);
  
  const el = document.getElementById('backup-status');
  if (el) {
    el.style.display = 'block';
    el.style.color = 'var(--green)';
    el.textContent = '✅ Exported ' + vevents.length + ' event occurrences to .ics file. You can now import to Google Calendar, Outlook, or Apple Calendar.';
  }
  showToast('Exported ' + vevents.length + ' iCal events');
}

function importData(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(ev) {
    try {
      const backup = JSON.parse(ev.target.result);
      const el = document.getElementById('backup-status');
      if (!backup.events || !backup.tasks) throw new Error('Invalid backup file format');
      if (!confirm('This will replace your current data with the backup. Continue?')) return;
      state.events = backup.events;
      state.tasks = backup.tasks;
      state.attendance = backup.attendance || [];
      state.grades = backup.grades || [];
      state.apiKey = backup.settings?.apiKey || state.apiKey || '';
      state.theme = backup.settings?.theme || 'dark';
      state.accent = backup.settings?.accent || '#7c6ff7';
      state.notifMinutes = backup.settings?.notifMinutes || 10;
      state.notificationsEnabled = !!backup.settings?.notificationsEnabled;
      state.gcalClientId = backup.settings?.gcalClientId || '';
      state.waPhone = backup.settings?.waPhone || '';
      state.waServer = backup.settings?.waServer || '';
      state.currentView = backup.settings?.currentView || DEFAULT_VIEW;
      state.showFreeTime = backup.settings?.showFreeTime !== false;
      state.weeklyHourLimit = backup.settings?.weeklyHourLimit || 50;
      uploadedDocs = Array.isArray(backup.uploadedDocs) ? backup.uploadedDocs : [];
      lastOptimizerResult = backup.optimizerResult || null;
      document.documentElement.setAttribute('data-theme', state.theme);
      document.documentElement.style.setProperty('--accent', state.accent);
      saveState();
      render();
      showView(isValidView(state.currentView) ? state.currentView : DEFAULT_VIEW, { pushHistory: false, persist: false });
      // Re-arm notification scheduler if notifications are enabled
      if (state.notificationsEnabled) {
        startNotificationScheduler();
      }
      if (el) {
        el.style.display = 'block';
        el.style.color = 'var(--green)';
        el.textContent = '✅ Restored backup from ' + (backup.exportedAt || 'unknown') + '.';
      }
    } catch(err) {
      const el = document.getElementById('backup-status');
      if (el) {
        el.style.display = 'block';
        el.style.color = 'var(--coral)';
        el.textContent = '❌ Failed to import: ' + err.message;
      }
    }
  };
  reader.readAsText(file);
}

// ══════════════════════════════════════════════
//  POMODORO TIMER
// ══════════════════════════════════════════════
let pomoInterval = null;
let pomoTimeLeft = 25 * 60; // 25 mins
let pomoMode = 'work'; // 'work' | 'break'
let pomoRunning = false;

function updatePomoUI() {
  const m = Math.floor(pomoTimeLeft / 60);
  const s = pomoTimeLeft % 60;
  const timeEl = document.getElementById('pomo-time');
  if (timeEl) timeEl.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;

  const box = document.getElementById('pomo-box');
  const toggleBtn = document.getElementById('pomo-toggle');
  const status = document.getElementById('pomo-status');

  if (!box || !toggleBtn) return;

  if (pomoMode === 'work') {
    box.classList.remove('break');
    if (status) status.textContent = pomoRunning ? 'Stay focused! 🎯' : 'Ready to focus';
    toggleBtn.textContent = pomoRunning ? 'Pause' : 'Start Focus';
  } else {
    box.classList.add('break');
    if (status) status.textContent = pomoRunning ? 'Relax, you earned it ☕' : 'Ready for a break';
    toggleBtn.textContent = pomoRunning ? 'Pause' : 'Start Break';
  }

  // Update tab highlights
  const tabWork = document.getElementById('tab-work');
  const tabBreak = document.getElementById('tab-break');
  if (tabWork && tabBreak) {
    tabWork.classList.toggle('active', pomoMode === 'work');
    tabBreak.classList.toggle('active', pomoMode === 'break');
  }
}

function setPomodoroMode(mode) {
  if (pomoRunning) {
    if (!confirm('A timer is currently running. Switch modes anyway?')) return;
    clearInterval(pomoInterval);
    pomoRunning = false;
  }
  pomoMode = mode;
  pomoTimeLeft = mode === 'work' ? 25 * 60 : 5 * 60;
  updatePomoUI();
}

function togglePomodoro() {
  if (pomoRunning) {
    clearInterval(pomoInterval);
    pomoRunning = false;
    updatePomoUI();
  } else {
    pomoRunning = true;
    if (navigator.vibrate) navigator.vibrate(50);
    pomoInterval = setInterval(() => {
      pomoTimeLeft--;
      if (pomoTimeLeft <= 0) {
        clearInterval(pomoInterval);
        pomoRunning = false;
        if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 500]); // long vibration
        
        // Switch modes
        if (pomoMode === 'work') {
          pomoMode = 'break';
          pomoTimeLeft = 5 * 60; // 5 mins
        } else {
          pomoMode = 'work';
          pomoTimeLeft = 25 * 60; // 25 mins
        }
      }
      updatePomoUI();
    }, 1000);
    updatePomoUI();
  }
}

function resetPomodoro() {
  clearInterval(pomoInterval);
  pomoRunning = false;
  pomoMode = 'work';
  pomoTimeLeft = 25 * 60;
  updatePomoUI();
}

// ══════════════════════════════════════════════
//  PHASE 2 — DEADLINE COUNTDOWN (Feature 6)
// ══════════════════════════════════════════════
function deadlineDiffLabel(dueStr) {
  const today = new Date(); today.setHours(0,0,0,0);
  const due = new Date(dueStr + 'T00:00:00');
  const diff = Math.round((due - today) / 86400000);
  if (diff < 0) return { label: `${Math.abs(diff)}d overdue`, color: '#f87171', urgency: 0 };
  if (diff === 0) return { label: 'Due today!', color: '#f87171', urgency: 1 };
  if (diff === 1) return { label: 'Due tomorrow', color: '#fbbf24', urgency: 2 };
  if (diff <= 3) return { label: `${diff} days left`, color: '#fbbf24', urgency: 3 };
  if (diff <= 7) return { label: `${diff} days left`, color: '#34d399', urgency: 4 };
  return { label: `${diff} days left`, color: 'var(--text3)', urgency: 5 };
}

function renderDeadlines() {
  const el = document.getElementById('deadlines-list');
  if (!el) return;
  const pending = state.tasks
    .filter(t => !isTaskComplete(t))
    .map(t => ({ ...t, _diff: deadlineDiffLabel(t.due), _repeat: (t.recurring || 'none') !== 'none' }))
    .sort((a, b) => a._diff.urgency - b._diff.urgency || a.due.localeCompare(b.due));

  if (!pending.length) {
    el.innerHTML = `<div class="empty"><div class="empty-icon">🎉</div>No pending deadlines!</div>`;
    return;
  }

  el.innerHTML = pending.map(t => {
    const { label, color } = t._diff;
    const pColor = PRIORITY_COLORS[t.priority] || '#9090a8';
    const barPct = Math.max(5, Math.min(100, 100 - (t._diff.urgency * 18)));
    return `<div class="deadline-card" role="article" aria-label="${esc(t.name)}, ${label}, ${esc(t.priority)} priority${t._repeat ? `, repeats ${esc(t.recurring)}` : ''}">
      <div class="deadline-card-top">
        <div class="deadline-title">${esc(t.name)}</div>
        <div class="deadline-badge" style="color:${color};background:${color}22;">${t._repeat ? `Repeats ${esc(t.recurring)}` : esc(label)}</div>
      </div>
      <div class="deadline-meta">
        <span style="color:${pColor};font-size:11px;font-weight:600;text-transform:uppercase;">${esc(t.priority)} priority</span>
        <span style="color:var(--text3);font-size:11px;">${t._repeat ? `Started ${esc(t.due)}` : `Due ${esc(t.due)}`}</span>
      </div>
      <div class="deadline-bar-track" role="progressbar" aria-valuenow="${barPct}" aria-valuemin="0" aria-valuemax="100" aria-label="Time remaining for ${esc(t.name)}">
        <div class="deadline-bar-fill" style="width:${barPct}%;background:${color};"></div>
      </div>
      <div style="display:flex;gap:8px;margin-top:10px;">
        <button class="btn-add" style="font-size:11px;" onclick="toggleTask('${esc(t.id)}')" aria-label="Mark ${esc(t.name)} as complete">✓ Mark Done</button>
        <button class="btn-add" style="font-size:11px;" onclick="deleteTask('${esc(t.id)}')" aria-label="Remove ${esc(t.name)}">✕ Remove</button>
      </div>
    </div>`;
  }).join('');
}

// ══════════════════════════════════════════════
//  PHASE 2 — ATTENDANCE TRACKER (Feature 3)
// ══════════════════════════════════════════════
function getClassSubjects() {
  const seen = new Set();
  return state.events
    .filter(e => e.category === 'class')
    .map(e => e.title)
    .filter(t => { if (seen.has(t)) return false; seen.add(t); return true; });
}

function showMarkAttendanceModal() {
  document.getElementById('att-date').value = todayStr();
  document.getElementById('att-status').value = 'present';
  document.getElementById('att-note').value = '';
  const subEl = document.getElementById('att-subject');
  const subjects = getClassSubjects();
  subEl.innerHTML = subjects.length
    ? subjects.map(s => `<option value="${s}">${s}</option>`).join('')
    : `<option value="Other">Other</option>`;
  openModal('attendance-modal');
}

function saveAttendance() {
  const record = {
    id: 'a' + Date.now(),
    subject: document.getElementById('att-subject').value,
    date: document.getElementById('att-date').value,
    status: document.getElementById('att-status').value,
    note: document.getElementById('att-note').value.trim(),
  };
  state.attendance.push(record);
  if (navigator.vibrate) navigator.vibrate(30);
  saveState();
  renderAttendanceSummary();
  renderAttendanceLog();
  closeModal('attendance-modal');
}

function deleteAttendance(id) {
  const record = state.attendance.find(a => a.id === id);
  if (record) {
    undoStack.push({ type: 'delete_attendance', payload: { ...record } });
    if (undoStack.length > MAX_UNDO_ENTRIES) undoStack.shift();
    redoStack = [];
  }
  state.attendance = state.attendance.filter(a => a.id !== id);
  saveState();
  renderAttendanceSummary();
  renderAttendanceLog();
}

function getAttendanceStats() {
  const stats = {};
  state.attendance.forEach(r => {
    if (!stats[r.subject]) stats[r.subject] = { present: 0, absent: 0, late: 0, total: 0 };
    stats[r.subject][r.status]++;
    stats[r.subject].total++;
  });
  return stats;
}

function renderAttendanceSummary() {
  const el = document.getElementById('attendance-summary');
  if (!el) return;
  const stats = getAttendanceStats();
  const subjects = Object.keys(stats);

  if (!subjects.length) {
    el.innerHTML = `<div class="empty"><div class="empty-icon">📋</div>No attendance records yet. Mark your first session!</div>`;
    return;
  }

  el.innerHTML = `<div class="att-grid">${subjects.map(subj => {
    const s = stats[subj];
    const pct = s.total ? Math.round((s.present + s.late * 0.5) / s.total * 100) : 0;
    const warn = pct < 75;
    const color = pct >= 85 ? 'var(--green)' : pct >= 75 ? 'var(--amber)' : 'var(--coral)';
    return `<div class="att-card${warn ? ' att-warn' : ''}" role="article" aria-label="${esc(subj)}, attendance ${pct}%${warn ? ', below 75% threshold' : ''}">
      <div class="att-subject">${esc(subj)}</div>
      <div class="att-pct" style="color:${color};" aria-live="polite">${pct}%</div>
      <div class="att-bar-track"><div class="att-bar-fill" style="width:${pct}%;background:${color};"></div></div>
      <div class="att-counts">
        <span style="color:var(--green);" title="Present">✅ ${s.present}</span>
        <span style="color:var(--coral);" title="Absent">❌ ${s.absent}</span>
        <span style="color:var(--amber);" title="Late">🕐 ${s.late}</span>
        <span style="color:var(--text3);">/ ${s.total}</span>
      </div>
      ${warn ? `<div class="att-warning">⚠️ Below 75% threshold</div>` : ''}
    </div>`;
  }).join('')}</div>`;
}

function renderAttendanceLog() {
  const el = document.getElementById('attendance-log');
  if (!el) return;
  const sorted = [...state.attendance].sort((a, b) => b.date.localeCompare(a.date));
  if (!sorted.length) { el.innerHTML = ''; return; }

  const STATUS_ICON = { present: '✅', absent: '❌', late: '🕐' };
  el.innerHTML = `<div class="section-header" style="margin-bottom:8px;">
    <span class="section-title">ATTENDANCE LOG</span>
  </div>
  <div class="timeline">${sorted.map(r => `
    <div class="timeline-item">
      <div class="timeline-time" style="width:70px;font-size:10px;">${esc(r.date)}</div>
      <div style="font-size:16px;flex-shrink:0;">${STATUS_ICON[r.status] || '—'}</div>
      <div class="timeline-content">
        <div class="timeline-title">${esc(r.subject)}</div>
        <div class="timeline-sub">${esc(r.status.charAt(0).toUpperCase()+r.status.slice(1))}${r.note ? ' · ' + esc(r.note) : ''}</div>
      </div>
      <span onclick="deleteAttendance('${esc(r.id)}')" style="font-size:14px;color:var(--text3);cursor:pointer;padding:4px;">✕</span>
    </div>`).join('')}</div>`;
}

// ══════════════════════════════════════════════
//  PHASE 2 — GRADE & GPA TRACKER (Feature 5)
// ══════════════════════════════════════════════
let editingGradeId = null;

function gradeToLetter(pct) {
  if (pct >= 90) return { letter: 'A+', gp: 4.0 };
  if (pct >= 85) return { letter: 'A',  gp: 4.0 };
  if (pct >= 80) return { letter: 'A-', gp: 3.7 };
  if (pct >= 75) return { letter: 'B+', gp: 3.3 };
  if (pct >= 70) return { letter: 'B',  gp: 3.0 };
  if (pct >= 65) return { letter: 'B-', gp: 2.7 };
  if (pct >= 60) return { letter: 'C+', gp: 2.3 };
  if (pct >= 55) return { letter: 'C',  gp: 2.0 };
  if (pct >= 50) return { letter: 'C-', gp: 1.7 };
  if (pct >= 45) return { letter: 'D',  gp: 1.0 };
  return { letter: 'F', gp: 0.0 };
}

function calcGPA() {
  // Group grades by subject, calculate weighted score per subject, then GPA by credits
  const subjects = {};
  state.grades.forEach(g => {
    if (!subjects[g.subject]) subjects[g.subject] = { credits: g.credits || 3, weightedSum: 0, totalWeight: 0 };
    const pct = (g.score / g.total) * 100;
    const weight = g.weight || 100;
    subjects[g.subject].weightedSum += pct * weight;
    subjects[g.subject].totalWeight += weight;
  });

  let totalPoints = 0, totalCredits = 0;
  Object.values(subjects).forEach(s => {
    if (s.totalWeight === 0) return;
    const avgPct = s.weightedSum / s.totalWeight;
    const { gp } = gradeToLetter(avgPct);
    totalPoints += gp * s.credits;
    totalCredits += s.credits;
  });
  return totalCredits ? (totalPoints / totalCredits).toFixed(2) : null;
}

function showAddGradeModal(id) {
  editingGradeId = id || null;
  const g = id ? state.grades.find(x => x.id === id) : null;
  document.getElementById('grade-modal-title').textContent = g ? 'Edit Grade' : 'Add Grade';
  document.getElementById('gr-subject').value = g ? g.subject : '';
  document.getElementById('gr-name').value = g ? g.name : '';
  document.getElementById('gr-score').value = g ? g.score : '';
  document.getElementById('gr-total').value = g ? g.total : '100';
  document.getElementById('gr-weight').value = g ? g.weight : '100';
  document.getElementById('gr-credits').value = g ? g.credits : '3';
  openModal('grade-modal');
}

function saveGrade() {
  const subject = document.getElementById('gr-subject').value.trim();
  const name = document.getElementById('gr-name').value.trim();
  const score = parseFloat(document.getElementById('gr-score').value);
  const total = parseFloat(document.getElementById('gr-total').value) || 100;
  const weight = parseFloat(document.getElementById('gr-weight').value) || 100;
  const credits = parseFloat(document.getElementById('gr-credits').value) || 3;
  if (!subject || !name || isNaN(score)) { alert('Please fill in subject, name and score.'); return; }
  const entry = { id: editingGradeId || 'g' + Date.now(), subject, name, score, total, weight, credits };
  if (editingGradeId) {
    const idx = state.grades.findIndex(g => g.id === editingGradeId);
    if (idx >= 0) state.grades[idx] = entry;
  } else {
    state.grades.push(entry);
  }
  if (navigator.vibrate) navigator.vibrate(30);
  saveState();
  renderGrades();
  closeModal('grade-modal');
}

function deleteGrade(id) {
  const grade = state.grades.find(g => g.id === id);
  if (grade) {
    undoStack.push({ type: 'delete_grade', payload: { ...grade } });
    if (undoStack.length > MAX_UNDO_ENTRIES) undoStack.shift();
    redoStack = [];
  }
  state.grades = state.grades.filter(g => g.id !== id);
  saveState();
  renderGrades();
}

function renderGrades() {
  const summaryEl = document.getElementById('gpa-summary');
  const listEl = document.getElementById('grades-list');
  if (!summaryEl || !listEl) return;

  const gpa = calcGPA();
  const gpaColor = !gpa ? 'var(--text3)' : gpa >= 3.5 ? 'var(--green)' : gpa >= 2.5 ? 'var(--amber)' : 'var(--coral)';

  summaryEl.innerHTML = `<div class="gpa-banner">
    <div>
      <div style="font-size:11px;color:var(--text3);font-weight:600;letter-spacing:0.06em;text-transform:uppercase;margin-bottom:4px;">Cumulative GPA</div>
      <div class="gpa-value" style="color:${gpaColor};">${gpa || '—'}</div>
      <div style="font-size:12px;color:var(--text3);margin-top:2px;">${gpa ? gradeToLetter(gpa * 25).letter + ' Average' : 'No grades yet'}</div>
    </div>
    <div style="font-size:40px;">🎓</div>
  </div>`;

  if (!state.grades.length) {
    listEl.innerHTML = `<div class="empty"><div class="empty-icon">📝</div>No grades added yet. Tap "+ Add Grade" to start tracking.</div>`;
    return;
  }

  // Group by subject
  const bySubject = {};
  state.grades.forEach(g => {
    if (!bySubject[g.subject]) bySubject[g.subject] = [];
    bySubject[g.subject].push(g);
  });

  listEl.innerHTML = Object.entries(bySubject).map(([subj, grades]) => {
    const totalWeight = grades.reduce((s, g) => s + (g.weight || 100), 0);
    const weightedPct = grades.reduce((s, g) => s + (g.score / g.total * 100) * (g.weight || 100), 0) / (totalWeight || 1);
    const { letter, gp } = gradeToLetter(weightedPct);
    const color = gp >= 3.5 ? 'var(--green)' : gp >= 2.5 ? 'var(--amber)' : 'var(--coral)';

    return `<div class="grade-subject-block" role="article" aria-label="${esc(subj)}, grade ${letter}, ${weightedPct.toFixed(1)}% average, ${grades[0].credits || 3} credit hours">
      <div class="grade-subject-header">
        <div>
          <div class="grade-subject-name">${esc(subj)}</div>
          <div style="font-size:11px;color:var(--text3);">${grades[0].credits || 3} credit hrs · ${weightedPct.toFixed(1)}% avg</div>
        </div>
        <div style="text-align:right;">
          <div class="grade-letter" style="color:${color};" aria-live="polite">${esc(letter)}</div>
          <div style="font-size:11px;color:var(--text3);">${gp.toFixed(1)} GP</div>
        </div>
      </div>
      ${grades.map(g => {
        const pct = (g.score / g.total * 100).toFixed(1);
        const { letter: gl } = gradeToLetter(parseFloat(pct));
        return `<div class="grade-item" role="listitem" aria-label="${esc(g.name)}, score ${g.score} out of ${g.total}, ${pct}%, grade ${gl}">
          <div class="grade-item-name">${esc(g.name)} <span style="color:var(--text3);font-size:10px;">(${g.weight}% weight)</span></div>
          <div style="display:flex;align-items:center;gap:10px;">
            <span style="font-size:12px;color:var(--text2);">${g.score}/${g.total} · ${pct}% · ${esc(gl)}</span>
            <span onclick="showAddGradeModal('${esc(g.id)}')" style="cursor:pointer;color:var(--text3);font-size:12px;" role="button" tabindex="0" aria-label="Edit grade ${esc(g.name)}" onkeydown="if(event.key==='Enter' || event.key===' ') { event.preventDefault(); showAddGradeModal('${esc(g.id)}'); }">✏️</span>
            <span onclick="deleteGrade('${esc(g.id)}')" style="cursor:pointer;color:var(--text3);font-size:12px;" role="button" tabindex="0" aria-label="Delete grade ${esc(g.name)}" onkeydown="if(event.key==='Enter' || event.key===' ') { event.preventDefault(); deleteGrade('${esc(g.id)}'); }">✕</span>
          </div>
        </div>`;
      }).join('')}
    </div>`;
  }).join('');
}

// ══════════════════════════════════════════════
//  PHASE 3 — NOTIFICATIONS (Feature 1)
// ══════════════════════════════════════════════
let notifCheckInterval = null;

function saveNotifPrefs() {
  state.notifMinutes = parseInt(document.getElementById('notif-minutes')?.value || '10');
  saveState();
}

async function requestNotificationPermission() {
  const btn = document.getElementById('notif-enable-btn');
  const statusEl = document.getElementById('notif-status');
  if (!('Notification' in window)) {
    statusEl.textContent = '❌ Notifications not supported in this browser';
    statusEl.style.color = 'var(--coral)';
    return;
  }
  const perm = await Notification.requestPermission();
  if (perm === 'granted') {
    state.notificationsEnabled = true;
    saveState();
    statusEl.textContent = '✅ Notifications enabled!';
    statusEl.style.color = 'var(--green)';
    if (btn) btn.textContent = '✅ Enabled';
    startNotificationScheduler();
  } else {
    statusEl.textContent = '❌ Permission denied — enable in browser settings';
    statusEl.style.color = 'var(--coral)';
  }
}

function updateNotifStatusUI() {
  const statusEl = document.getElementById('notif-status');
  const btn = document.getElementById('notif-enable-btn');
  const minutesEl = document.getElementById('notif-minutes');
  if (!statusEl) return;
  if (Notification.permission === 'granted' && state.notificationsEnabled) {
    statusEl.textContent = '✅ Active';
    statusEl.style.color = 'var(--green)';
    if (btn) btn.textContent = '✅ Enabled';
  } else if (Notification.permission === 'denied') {
    statusEl.textContent = '❌ Blocked — allow in browser settings';
    statusEl.style.color = 'var(--coral)';
  } else {
    statusEl.textContent = 'Not enabled';
    statusEl.style.color = 'var(--text3)';
  }
  if (minutesEl && state.notifMinutes) minutesEl.value = state.notifMinutes;
}

function updateAppVersionUI() {
  const buildEl = document.getElementById('app-version-value');
  const statusEl = document.getElementById('app-update-status');
  if (!buildEl || !statusEl) return;

  const build = window.LAZY_PANDA_BUILD || 'unknown';
  buildEl.textContent = 'Build: ' + build;

  const status = window.__lpSwStatus || { text: 'Update status unavailable.', color: 'var(--text3)' };
  statusEl.textContent = status.text;
  statusEl.style.color = status.color || 'var(--text3)';
}

async function checkForUpdates() {
  if (typeof window.__setLpSwStatus === 'function') {
    window.__setLpSwStatus('Checking for updates…', 'var(--text3)');
  }

  try {
    let reg = window.__lpSwRegistration;
    if (!reg && 'serviceWorker' in navigator) {
      reg = await navigator.serviceWorker.getRegistration();
      window.__lpSwRegistration = reg || null;
    }

    if (!reg) {
      if (typeof window.__setLpSwStatus === 'function') {
        window.__setLpSwStatus('No installed app updater found in this browser session.', 'var(--amber)');
      }
      return;
    }

    await reg.update();

    if (reg.waiting) {
      if (typeof window.__setLpSwStatus === 'function') {
        window.__setLpSwStatus('Update is ready. Reopen the app if it does not refresh automatically.', 'var(--green)');
      }
    } else {
      if (typeof window.__setLpSwStatus === 'function') {
        window.__setLpSwStatus('Checked successfully. This build looks current.', 'var(--green)');
      }
    }
  } catch (e) {
    if (typeof window.__setLpSwStatus === 'function') {
      window.__setLpSwStatus('Update check failed: ' + e.message, 'var(--coral)');
    }
  }
}

function testNotification() {
  if (Notification.permission !== 'granted') {
    alert('Please enable notifications first.');
    return;
  }
  new Notification('Lazy Panda 🐼', {
    body: 'Notifications are working! You\'ll be reminded before class.',
    icon: './icon.svg',
    badge: './icon.svg',
    tag: 'test'
  });
}

function startNotificationScheduler() {
  if (notifCheckInterval) clearInterval(notifCheckInterval);
  checkUpcomingNotifications();
  notifCheckInterval = setInterval(checkUpcomingNotifications, 60000);
}

const notifiedEvents = new Set();

function checkUpcomingNotifications() {
  const mins = state.notifMinutes || 10;
  const now = nowMins();
  const todayEvs = getTodayEvents();

  todayEvs.forEach(ev => {
    const start = timeMins(ev.start);
    const diff = start - now;
    if (diff <= 0 || diff > mins) return;

    // Browser push notification
    const notifKey = `${todayStr()}-${ev.id}`;
    if (Notification.permission === 'granted' && state.notificationsEnabled && !notifiedEvents.has(notifKey)) {
      notifiedEvents.add(notifKey);
      new Notification(`🐼 ${ev.title} in ${diff} min`, {
        body: `${fmt12(ev.start)} – ${fmt12(ev.end)}${ev.location ? ' · ' + ev.location : ''}`,
        icon: './icon.svg',
        tag: notifKey,
        requireInteraction: false
      });
    }

    // WhatsApp reminder (Bug E fix: merged here — no monkey-patch needed)
    const waKey = `wa-${todayStr()}-${ev.id}`;
    if (state.waPhone && state.waServer && !notifiedEvents.has(waKey)) {
      notifiedEvents.add(waKey);
      sendWhatsAppReminder(ev, diff);
    }
  });
}

// ══════════════════════════════════════════════
//  PHASE 3 — SHARE SCHEDULE (Feature 18)
// ══════════════════════════════════════════════
async function shareSchedule(mode) {
  const today = new Date();
  let text = '';

  if (mode === 'today') {
    const evs = getTodayEvents();
    const pending = state.tasks.filter(t => !isTaskDoneForDate(t, todayStr()) && t.due === todayStr());
    text = `📅 Lazy Panda — ${today.toDateString()}\n`;
    text += `${'─'.repeat(34)}\n`;
    if (evs.length) {
      text += `\n🗓 TODAY'S SCHEDULE\n`;
      evs.forEach(ev => {
        text += `  ${fmt12(ev.start)} – ${fmt12(ev.end)}  ${ev.title}`;
        if (ev.location) text += `\n  📍 ${ev.location}`;
        text += '\n';
      });
    } else {
      text += '\n🎉 No classes today!\n';
    }
    if (pending.length) {
      text += `\n✅ TODAY'S TASKS\n`;
      pending.forEach(t => { text += `  · ${t.name} (${t.priority})\n`; });
    }
    text += `\n— Shared from Lazy Panda 🐼`;
  } else {
    text = `📆 Lazy Panda — Weekly Schedule\n`;
    text += `${'─'.repeat(34)}\n`;
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      const ds = d.toISOString().split('T')[0];
      const evs = getEventsForDay(ds, d.getDay());
      if (evs.length) {
        text += `\n${DAYS[d.getDay()]} ${d.getDate()}\n`;
        evs.forEach(ev => { text += `  ${fmt12(ev.start)}  ${ev.title}\n`; });
      }
    }
    text += `\n— Shared from Lazy Panda 🐼`;
  }

  if (navigator.share) {
    try {
      await navigator.share({ title: 'My Schedule — Lazy Panda', text });
      return;
    } catch(e) { /* fallback to clipboard */ }
  }
  // Clipboard fallback
  try {
    await navigator.clipboard.writeText(text);
    showToast('📋 Schedule copied to clipboard!');
  } catch(e) {
    showToast('Could not share — try copying manually.');
  }
}

function showToast(msg, duration = 3000) {
  let toast = document.getElementById('lp-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'lp-toast';
    toast.style.cssText = `position:fixed;bottom:calc(90px + var(--safe-bottom));left:50%;transform:translateX(-50%) translateY(20px);background:var(--surface3);color:var(--text);padding:10px 18px;border-radius:20px;font-size:13px;font-weight:500;z-index:200;opacity:0;transition:opacity .2s,transform .2s;pointer-events:none;border:1px solid var(--border2);white-space:nowrap;`;
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateX(-50%) translateY(0)';
  });
  clearTimeout(toast._t);
  toast._t = setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(-50%) translateY(10px)';
  }, duration);
}

// ══════════════════════════════════════════════
//  PHASE 3 — CONFLICT DETECTION (Feature 10)
// ══════════════════════════════════════════════
function detectConflicts(dateStr, dayOfWeek) {
  const evs = getEventsForDay(dateStr, dayOfWeek);
  const conflicts = [];
  for (let i = 0; i < evs.length; i++) {
    for (let j = i + 1; j < evs.length; j++) {
      const a = evs[i], b = evs[j];
      const aStart = timeMins(a.start), aEnd = timeMins(a.end);
      const bStart = timeMins(b.start), bEnd = timeMins(b.end);
      if (aStart < bEnd && bStart < aEnd) {
        conflicts.push({ a, b });
      }
    }
  }
  return conflicts;
}

function detectAllConflicts() {
  const results = [];
  const now = new Date();
  for (let i = 0; i < 14; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + i);
    const ds = d.toISOString().split('T')[0];
    const found = detectConflicts(ds, d.getDay());
    found.forEach(c => results.push({ date: ds, ...c }));
  }
  return results;
}

function renderConflictBanner() {
  const conflicts = detectAllConflicts();
  const existing = document.getElementById('conflict-banner');
  if (existing) existing.remove();
  if (!conflicts.length) return;

  const banner = document.createElement('div');
  banner.id = 'conflict-banner';
  banner.className = 'conflict-banner';
  banner.innerHTML = `<div style="display:flex;align-items:flex-start;gap:10px;">
    <span style="font-size:18px;flex-shrink:0;">⚡</span>
    <div>
      <div style="font-weight:600;font-size:13px;margin-bottom:4px;">${conflicts.length} Schedule Conflict${conflicts.length > 1 ? 's' : ''} Detected</div>
      ${conflicts.map(c => `<div style="font-size:12px;color:var(--text2);margin-top:2px;">
        <b>${esc(c.date)}</b>: &ldquo;${esc(c.a.title)}&rdquo; (${fmt12(c.a.start)}–${fmt12(c.a.end)}) overlaps with &ldquo;${esc(c.b.title)}&rdquo; (${fmt12(c.b.start)}–${fmt12(c.b.end)})
      </div>`).join('')}
    </div>
    <span onclick="this.parentElement.parentElement.remove()" style="cursor:pointer;color:var(--text3);margin-left:auto;padding:2px 6px;font-size:14px;">✕</span>
  </div>`;
  const dashboard = document.getElementById('view-dashboard');
  if (dashboard) dashboard.insertAdjacentElement('afterbegin', banner);
}

// ══════════════════════════════════════════════
//  PHASE 3 — OFFLINE AI (Feature 15)
// ══════════════════════════════════════════════
async function tryOfflineAI(prompt) {
  // Chrome's experimental Prompt API (window.ai / window.LanguageModel)
  const api = window.ai?.languageModel || window.LanguageModel;
  if (!api) return null;
  try {
    const { available } = await api.capabilities();
    if (available === 'no') return null;
    const session = await api.create({
      systemPrompt: `You are Lazy Panda 🐼, a scheduling assistant. Answer briefly and helpfully. Today is ${new Date().toDateString()}.`
    });
    const result = await session.prompt(prompt);
    session.destroy();
    return result;
  } catch(e) {
    return null;
  }
}

// ══════════════════════════════════════════════
//  PHASE 4 — CHAT WITH NOTES (Feature 11)
// ══════════════════════════════════════════════
async function handleNotesUpload(event) {
  const files = Array.from(event.target.files);
  event.target.value = ''; // reset so same file can be re-uploaded
  for (const file of files) {
    const id = 'doc_' + Date.now() + Math.random();
    let text = '';
    if (file.type === 'application/pdf') {
      text = await extractPdfText(file);
    } else {
      text = await file.text();
    }
    uploadedDocs.push({ id, name: file.name, type: file.type, text: text.slice(0, 40000), size: file.size });
    addNotesChatMsg('ai', `✅ Loaded <b>${file.name}</b> (${(file.size/1024).toFixed(1)} KB). Ask me anything about it!`);
  }
  saveState();
  renderNotesDocs();
}

async function extractPdfText(file) {
  // Load pdf.js from CDN dynamically
  if (!window.pdfjsLib) {
    await new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
    window.pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }
  try {
    const ab = await file.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({ data: ab }).promise;
    let fullText = '';
    for (let i = 1; i <= Math.min(pdf.numPages, 50); i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      fullText += content.items.map(s => s.str).join(' ') + '\n';
    }
    return fullText;
  } catch(e) {
    return `[Could not extract text from PDF: ${e.message}]`;
  }
}

function removeDoc(id) {
  uploadedDocs = uploadedDocs.filter(d => d.id !== id);
  saveState();
  renderNotesDocs();
  showToast('Document removed');
}

function renderNotesDocs() {
  const el = document.getElementById('notes-docs-list');
  if (!el) return;
  // Combine uploaded docs + events with notes
  const eventNotes = state.events.filter(e => e.notes && e.notes.trim());
  if (!uploadedDocs.length && !eventNotes.length) {
    el.innerHTML = `<div style="font-size:12px;color:var(--text3);padding:8px 0;">No documents loaded. Upload a PDF or use your class notes below.</div>`;
    return;
  }
  el.innerHTML = `<div style="display:flex;flex-wrap:wrap;gap:6px;">
    ${uploadedDocs.map(d => `<div class="doc-chip">
      <span style="font-size:12px;">📄</span>
      <span>${d.name}</span>
      <span onclick="removeDoc('${d.id}')" style="cursor:pointer;opacity:0.6;margin-left:2px;">✕</span>
    </div>`).join('')}
    ${eventNotes.map(e => `<div class="doc-chip" style="border-color:var(--accent);color:var(--accent);">
      <span style="font-size:12px;">📝</span>
      <span>${e.title}</span>
    </div>`).join('')}
  </div>`;
}

function buildNotesContext(query) {
  const eventNotes = state.events
    .filter(e => e.notes && e.notes.trim())
    .map(e => `[Class Notes: ${e.title} (${e.date})]\n${e.notes}`)
    .join('\n\n');
  const uploadedContext = uploadedDocs
    .map(d => `[Document: ${d.name}]\n${d.text}`)
    .join('\n\n');
  const combined = [eventNotes, uploadedContext].filter(Boolean).join('\n\n');
  // Trim to ~12000 chars to stay within token limits
  return combined.slice(0, 12000);
}

function addNotesChatMsg(role, html) {
  const el = document.getElementById('notes-chat-messages');
  if (!el) return;
  const timeStr = new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
  const div = document.createElement('div');
  div.className = `msg ${role}`;
  div.innerHTML = `<div class="msg-bubble">${html}</div><div class="msg-time">${timeStr}</div>`;
  el.appendChild(div);
  el.scrollTop = el.scrollHeight;
}

async function sendNotesChat() {
  const input = document.getElementById('notes-chat-input');
  const query = input.value.trim();
  if (!query) return;
  input.value = ''; input.style.height = '';

  const context = buildNotesContext(query);
  if (!context) {
    addNotesChatMsg('ai', '⚠️ No notes or documents found. Upload a PDF or add notes to your class events first.');
    return;
  }
  if (!state.apiKey) {
    addNotesChatMsg('ai', '⚠️ Add your Gemini API key in Settings to use this feature.');
    return;
  }
  addNotesChatMsg('user', query);

  // Show typing
  const msgsEl = document.getElementById('notes-chat-messages');
  const typingDiv = document.createElement('div');
  typingDiv.className = 'msg ai'; typingDiv.id = 'notes-typing';
  typingDiv.innerHTML = `<div class="typing-indicator"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div>`;
  msgsEl.appendChild(typingDiv);
  msgsEl.scrollTop = msgsEl.scrollHeight;

  try {
    const systemPrompt = `You are a study assistant for Lazy Panda 🐼. Answer questions based ONLY on the provided notes and documents. 
If the answer isn't in the documents, say so clearly. Be concise, accurate, and helpful.
Quote relevant passages when useful. Format with markdown-style bold for key terms.

DOCUMENTS & NOTES:
${context}`;

    const res = await geminiFetch({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: 'user', parts: [{ text: query }] }],
      generationConfig: { maxOutputTokens: 800, temperature: 0.3 }
    });
    document.getElementById('notes-typing')?.remove();
    const data = await res.json();
    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response.';
    addNotesChatMsg('ai', reply.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>'));
  } catch(e) {
    document.getElementById('notes-typing')?.remove();
    addNotesChatMsg('ai', '⚠️ Error: ' + e.message);
  }
}

function handleNotesChatKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendNotesChat(); }
}

// ══════════════════════════════════════════════
//  PHASE 4 — AUTO SCHEDULE OPTIMIZER (Feature 12)
// ══════════════════════════════════════════════
function renderOptimizerOutput() {
  const el = document.getElementById('optimizer-output');
  if (!el) return;
  if (!lastOptimizerResult) {
    el.innerHTML = `<div class="empty"><div class="empty-icon">⚡</div>Configure your preferences above and tap "Optimize Now" to generate an AI-powered study plan.</div>`;
  }
}

async function runOptimizer() {
  if (!state.apiKey) {
    showToast('⚠️ Add your Gemini API key in Settings first.');
    return;
  }
  const blockSize = document.getElementById('opt-block-size')?.value || '90';
  const peakTime = document.getElementById('opt-peak-time')?.value || 'evening';
  const breakSize = document.getElementById('opt-break-size')?.value || '15';
  const days = document.getElementById('opt-days')?.value || '7';

  const el = document.getElementById('optimizer-output');
  el.innerHTML = `<div class="optimizer-loading"><div class="typing-indicator" style="justify-content:center;"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div><div style="margin-top:10px;font-size:13px;color:var(--text3);">Analyzing your schedule and building an optimized plan…</div></div>`;

  // Build schedule context for the next N days
  const now = new Date();
  const scheduleCtx = [];
  for (let i = 0; i < parseInt(days); i++) {
    const d = new Date(now); d.setDate(now.getDate() + i);
    const ds = d.toISOString().split('T')[0];
    const evs = getEventsForDay(ds, d.getDay());
    if (evs.length) {
      scheduleCtx.push(`${DAYS[d.getDay()]} ${ds}: ` + evs.map(e => `${fmt12(e.start)}-${fmt12(e.end)} ${e.title}`).join(', '));
    } else {
      scheduleCtx.push(`${DAYS[d.getDay()]} ${ds}: Free day`);
    }
  }
  const pendingTasks = state.tasks.filter(t => !isTaskComplete(t)).slice(0, 15);
  const peakMap = { morning:'6 AM–12 PM', afternoon:'12 PM–5 PM', evening:'5 PM–9 PM', night:'9 PM–12 AM' };

  const prompt = `You are an expert academic schedule optimizer for Lazy Panda 🐼.

STUDENT'S EXISTING SCHEDULE (next ${days} days):
${scheduleCtx.join('\n')}

PENDING TASKS TO FIT IN:
${pendingTasks.map(t => `- ${t.name} (due ${t.due}, ${t.priority} priority)`).join('\n') || 'None'}

OPTIMIZATION PREFERENCES:
- Study block size: ${blockSize} minutes
- Peak focus time: ${peakMap[peakTime]}
- Break between blocks: ${breakSize} minutes
- Plan horizon: ${days} days

YOUR TASK:
1. Find ALL free time slots in the schedule above
2. Assign study/task sessions into those gaps, respecting existing events
3. Place high-priority tasks earlier and in peak focus hours
4. Add short breaks between blocks
5. Return a day-by-day optimized plan

FORMAT your response as a structured plan with each day as a section. For each suggested session include: time, task/subject, duration, and a brief tip. Be specific with times. End with a brief motivational note 🐼.`;

  try {
    const res = await geminiFetch({
      system_instruction: { parts: [{ text: 'You are a precise academic schedule optimizer. Return structured, actionable plans.' }] },
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 2000, temperature: 0.5 }
    });
    const data = await res.json();
    const plan = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Could not generate plan.';
    lastOptimizerResult = plan;
    saveState();

    // Render the plan with action buttons
    el.innerHTML = `<div class="optimizer-result">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;flex-wrap:wrap;gap:8px;">
        <div style="font-size:13px;font-weight:600;color:var(--accent);">⚡ Optimized Plan Ready</div>
        <div style="display:flex;gap:8px;">
          <button class="btn-save" style="font-size:12px;" onclick="addOptimizerEventsToSchedule()">＋ Add to Schedule</button>
          <button class="btn-cancel" style="font-size:12px;" onclick="runOptimizer()">↻ Regenerate</button>
        </div>
      </div>
      <div class="optimizer-plan-text">${plan.replace(/\n/g,'<br>').replace(/\*\*(.*?)\*\*/g,'<b>$1</b>').replace(/##\s*(.*)/g,'<div class="opt-day-header">$1</div>')}</div>
    </div>`;
  } catch(e) {
    el.innerHTML = `<div class="empty">⚠️ Error: ${e.message}</div>`;
  }
}

async function addOptimizerEventsToSchedule() {
  if (!lastOptimizerResult || !state.apiKey) return;
  showToast('🐼 Parsing plan and adding events…');

  const extractPrompt = `Extract all study sessions from this schedule plan and return ONLY a JSON array of events. Each event: {"title":"...","date":"YYYY-MM-DD","start":"HH:MM","end":"HH:MM","category":"study","location":"","recurring":"none"}. Today is ${todayStr()}. Return raw JSON array only, no markdown.\n\nPLAN:\n${lastOptimizerResult}`;

  try {
    const res = await geminiFetch({
      contents: [{ role: 'user', parts: [{ text: extractPrompt }] }],
      generationConfig: { maxOutputTokens: 1500, temperature: 0.1 }
    });
    const data = await res.json();
    let raw = data.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
    raw = raw.replace(/```json|```/g, '').trim();
    const events = JSON.parse(raw);
    let added = 0;
    events.forEach(ev => {
      if (ev.title && ev.date && ev.start && ev.end) {
        state.events.push({ id: 'opt_' + Date.now() + Math.random(), ...ev });
        added++;
      }
    });
    saveState(); render();
    showToast(`✅ Added ${added} study sessions to your schedule!`);
  } catch(e) {
    showToast('⚠️ Could not auto-add events — add them manually from the plan.');
  }
}

// ══════════════════════════════════════════════
//  PHASE 4 — GOOGLE CALENDAR SYNC (Feature 17)
// ══════════════════════════════════════════════
const GCAL_SCOPES = 'https://www.googleapis.com/auth/calendar';
let gCalTokenClient = null;
let gCalAccessToken = null;

function updateGCalUI() {
  const connected = !!gCalAccessToken;
  const clientIdEl = document.getElementById('gcal-client-id');
  if (clientIdEl && state.gcalClientId) clientIdEl.value = state.gcalClientId;
  document.getElementById('gcal-connect-btn').style.display = connected ? 'none' : '';
  document.getElementById('gcal-sync-btn').style.display = connected ? '' : 'none';
  document.getElementById('gcal-import-btn').style.display = connected ? '' : 'none';
  document.getElementById('gcal-disconnect-btn').style.display = connected ? '' : 'none';
  const statusEl = document.getElementById('gcal-status');
  if (connected) {
    statusEl.style.display = 'block';
    statusEl.style.color = 'var(--green)';
    statusEl.textContent = '✅ Connected to Google Calendar';
  }
}

function setGCalStatus(msg, color = 'var(--text3)') {
  const el = document.getElementById('gcal-status');
  if (!el) return;
  el.style.display = 'block';
  el.style.color = color;
  el.textContent = msg;
}

async function loadGISLibrary() {
  if (window.google?.accounts?.oauth2) return true;
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.onload = () => res(true);
    s.onerror = () => rej(new Error('Failed to load Google Identity Services'));
    document.head.appendChild(s);
  });
}

async function connectGoogleCalendar() {
  const clientId = document.getElementById('gcal-client-id')?.value.trim();
  if (!clientId) {
    setGCalStatus('⚠️ Please enter your Google Client ID first.', 'var(--amber)');
    return;
  }
  state.gcalClientId = clientId;
  saveState();
  setGCalStatus('Loading Google Sign-In…', 'var(--text3)');
  try {
    await loadGISLibrary();
    gCalTokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: GCAL_SCOPES,
      callback: (resp) => {
        if (resp.error) { setGCalStatus('❌ Auth error: ' + resp.error, 'var(--coral)'); return; }
        gCalAccessToken = resp.access_token;
        updateGCalUI();
      }
    });
    gCalTokenClient.requestAccessToken({ prompt: 'consent' });
  } catch(e) {
    setGCalStatus('❌ ' + e.message, 'var(--coral)');
  }
}

function disconnectGoogleCalendar() {
  if (gCalAccessToken) window.google?.accounts?.oauth2?.revoke(gCalAccessToken);
  gCalAccessToken = null;
  updateGCalUI();
  const el = document.getElementById('gcal-status');
  if (el) { el.style.display = 'none'; }
}

async function syncToGoogleCalendar() {
  if (!gCalAccessToken) return;
  setGCalStatus('⏳ Syncing events to Google Calendar…', 'var(--text3)');
  const now = new Date();
  const eventsToSync = [];
  for (let i = 0; i < 30; i++) {
    const d = new Date(now); d.setDate(now.getDate() + i);
    const ds = d.toISOString().split('T')[0];
    getEventsForDay(ds, d.getDay()).forEach(ev => eventsToSync.push({ ev, ds }));
  }
  let synced = 0, errors = 0;
  for (const { ev, ds } of eventsToSync.slice(0, 50)) {
    const [sh, sm] = ev.start.split(':').map(Number);
    const [eh, em] = ev.end.split(':').map(Number);
    const startDt = new Date(ds); startDt.setHours(sh, sm, 0, 0);
    const endDt   = new Date(ds); endDt.setHours(eh, em, 0, 0);
    const body = {
      summary: ev.title,
      location: ev.location || '',
      start: { dateTime: startDt.toISOString(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
      end:   { dateTime: endDt.toISOString(),   timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
      description: ev.notes ? `Notes:\n${ev.notes}` : 'Added by Lazy Panda 🐼'
    };
    try {
      const r = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
        method: 'POST',
        headers: { Authorization: `Bearer ${gCalAccessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (r.ok) synced++; else errors++;
    } catch{ errors++; }
  }
  setGCalStatus(`✅ Synced ${synced} events${errors ? ` (${errors} errors)` : ''} to Google Calendar.`, 'var(--green)');
}

async function importFromGoogleCalendar() {
  if (!gCalAccessToken) return;
  setGCalStatus('⏳ Importing from Google Calendar…', 'var(--text3)');
  try {
    const now = new Date();
    const timeMin = now.toISOString();
    const timeMax = new Date(now.getTime() + 30 * 86400000).toISOString();
    const r = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&singleEvents=true&orderBy=startTime&maxResults=50`,
      { headers: { Authorization: `Bearer ${gCalAccessToken}` } }
    );
    const data = await r.json();
    const items = data.items || [];
    let imported = 0;
    items.forEach(item => {
      if (!item.start?.dateTime) return; // skip all-day
      const start = new Date(item.start.dateTime);
      const end   = new Date(item.end.dateTime);
      const ds = start.toISOString().split('T')[0];
      const pad = n => String(n).padStart(2,'0');
      const startStr = `${pad(start.getHours())}:${pad(start.getMinutes())}`;
      const endStr   = `${pad(end.getHours())}:${pad(end.getMinutes())}`;
      const existing = state.events.find(e => e.title === item.summary && e.date === ds && e.start === startStr);
      if (!existing) {
        state.events.push({ id:'gcal_'+item.id, title:item.summary||'Untitled', date:ds, start:startStr, end:endStr, location:item.location||'', category:'other', recurring:'none', notes:item.description||'' });
        imported++;
      }
    });
    saveState(); render();
    setGCalStatus(`✅ Imported ${imported} new events from Google Calendar.`, 'var(--green)');
  } catch(e) {
    setGCalStatus('❌ Import failed: ' + e.message, 'var(--coral)');
  }
}

// ══════════════════════════════════════════════
//  PHASE 4 — WHATSAPP REMINDERS (Feature 19)
// ══════════════════════════════════════════════
function updateWAUI() {
  const phoneEl = document.getElementById('wa-phone');
  const serverEl = document.getElementById('wa-server');
  if (phoneEl && state.waPhone) phoneEl.value = state.waPhone;
  if (serverEl && state.waServer) serverEl.value = state.waServer;
}

function saveWhatsAppConfig() {
  state.waPhone  = document.getElementById('wa-phone')?.value.trim();
  state.waServer = document.getElementById('wa-server')?.value.trim();
  saveState();
  const el = document.getElementById('wa-status');
  if (el) {
    el.style.display = 'block';
    el.style.color = 'var(--green)';
    el.textContent = '✅ WhatsApp config saved.';
  }
}

async function testWhatsApp() {
  const phone  = document.getElementById('wa-phone')?.value.trim();
  const server = document.getElementById('wa-server')?.value.trim();
  const el = document.getElementById('wa-status');
  if (!phone || !server) {
    if (el) { el.style.display='block'; el.style.color='var(--amber)'; el.textContent='⚠️ Enter both phone number and server URL.'; }
    return;
  }
  if (el) { el.style.display='block'; el.style.color='var(--text3)'; el.textContent='⏳ Sending test message…'; }
  try {
    const res = await fetch(`${server}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: phone, message: '🐼 Lazy Panda test message! Your WhatsApp reminders are working.' })
    });
    if (res.ok) {
      if (el) { el.style.color='var(--green)'; el.textContent='✅ Test message sent! Check your WhatsApp.'; }
    } else {
      const d = await res.json().catch(()=>({}));
      if (el) { el.style.color='var(--coral)'; el.textContent='❌ Server error: ' + (d.error || res.status); }
    }
  } catch(e) {
    if (el) { el.style.color='var(--coral)'; el.textContent='❌ Could not reach server: ' + e.message; }
  }
}

async function sendWhatsAppReminder(ev, minsBeforeClass) {
  if (!state.waPhone || !state.waServer) return;
  const msg = `🐼 Lazy Panda Reminder\n\n📚 ${ev.title} starts in ${minsBeforeClass} minutes!\n⏰ ${fmt12(ev.start)} – ${fmt12(ev.end)}${ev.location ? '\n📍 ' + ev.location : ''}`;
  try {
    await fetch(`${state.waServer}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: state.waPhone, message: msg })
    });
  } catch(e) { /* silent — don't interrupt UI */ }
}

// WhatsApp reminder logic is integrated directly into checkUpcomingNotifications() above.

function initializeNavigation() {
  const hashView = location.hash ? location.hash.slice(1) : '';
  const initialView = isValidView(hashView) ? hashView : (isValidView(state.currentView) ? state.currentView : DEFAULT_VIEW);
  history.replaceState(
    { view: DEFAULT_VIEW },
    '',
    location.pathname + location.search
  );
  showView(initialView, { pushHistory: false, persist: false });
  if (initialView !== DEFAULT_VIEW) {
    history.pushState({ view: initialView }, '', '#' + initialView);
  }
}

window.addEventListener('popstate', function(e) {
  const stateObj = e.state || {};
  const openModalId = getOpenModalId();

  if (stateObj.panel === 'chat') {
    closeAllModals();
    closeMobileDrawer(false);
    openChatOverlay(false);
    return;
  }

  if (stateObj.panel === 'drawer') {
    closeAllModals();
    closeChatOverlay(false);
    openMobileDrawer(false);
    return;
  }

  if (stateObj.panel === 'modal' && stateObj.modal) {
    closeChatOverlay(false);
    closeMobileDrawer(false);
    closeAllModals();
    openModal(stateObj.modal, false);
    return;
  }

  closeChatOverlay(false);
  closeMobileDrawer(false);
  if (openModalId) closeModal(openModalId, false);
  showView(isValidView(stateObj.view) ? stateObj.view : DEFAULT_VIEW, { pushHistory: false });
});

// ══════════════════════════════════════════════
// ══════════════════════════════════════════════
loadState();
render();
initializeNavigation();

// Start notification scheduler if already permitted from a previous session
if ('Notification' in window && Notification.permission === 'granted' && state.notificationsEnabled) {
  startNotificationScheduler();
}

// Auto-update timeline every minute
setInterval(() => { renderTimeline(); renderUpcoming(); }, 60000);

// Close modals on overlay click
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => {
    if (e.target === overlay) closeModal(overlay.id);
  });
});

const quickAddPopover = document.getElementById('quick-add-popover');
if (quickAddPopover) {
  quickAddPopover.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveQuickEvent();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      closeQuickAdd();
    }
  });
}

// Global keyboard shortcuts for undo/redo
document.addEventListener('keydown', (e) => {
  const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.platform);
  const ctrlKey = isMac ? e.metaKey : e.ctrlKey;
  
  // Don't trigger shortcuts when typing in input/textarea
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
    return;
  }
  
  // Check if a modal is open (except for Escape to close them)
  const openModal = document.querySelector('.modal-overlay:not(.hidden)');
  if (openModal && e.key !== 'Escape') {
    return;
  }
  
  // Undo: Ctrl/Cmd+Z
  if (ctrlKey && e.key === 'z' && !e.shiftKey) {
    e.preventDefault();
    undoLast();
  }
  // Redo: Ctrl/Cmd+Shift+Z
  else if (ctrlKey && e.key === 'z' && e.shiftKey) {
    e.preventDefault();
    redoLast();
  }
  // N: New event (quick add)
  else if (e.key.toLowerCase() === 'n' && !ctrlKey && !e.altKey) {
    e.preventDefault();
    showQuickAdd(null);
  }
  // T: New task
  else if (e.key.toLowerCase() === 't' && !ctrlKey && !e.altKey) {
    e.preventDefault();
    showAddTaskModal();
  }
  // /: Focus search (if in schedule view)
  else if (e.key === '/' && !ctrlKey && !e.altKey) {
    e.preventDefault();
    if (state.currentView === 'schedule') {
      const search = document.getElementById('schedule-search');
      if (search) search.focus();
    }
  }
  // 1-9: Switch views
  else if (/^[1-9]$/.test(e.key) && !ctrlKey && !e.altKey) {
    const viewNames = ['dashboard','schedule','tasks','deadlines','focus','settings'];
    const idx = parseInt(e.key) - 1;
    if (idx < viewNames.length) {
      e.preventDefault();
      showView(viewNames[idx]);
    }
  }
  // ?: Show help
  else if ((e.key === '?' || (e.shiftKey && e.key === '/')) && !ctrlKey && !e.altKey) {
    e.preventDefault();
    openModal('shortcuts-modal');
  }
  // Escape: Close modal
  else if (e.key === 'Escape' && openModal) {
    e.preventDefault();
    closeModal(openModal.id);
  }
});

window.showView = showView;
window.checkForUpdates = checkForUpdates;
window.updateAppVersionUI = updateAppVersionUI;
