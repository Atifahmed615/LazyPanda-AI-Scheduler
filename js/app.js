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

let state = { events: [], tasks: [], attendance: [], grades: [], apiKey: '', theme: 'dark', accent: '#7c6ff7' };

function loadState() {
  try {
    const saved = localStorage.getItem('classflow_state');
    if (saved) { state = { ...state, ...JSON.parse(saved) }; }
    else { state.events = defaultEvents(); state.tasks = defaultTasks(); state.theme = 'dark'; state.accent = '#7c6ff7'; }
    if (!state.events.length) state.events = defaultEvents();
    if (!state.attendance) state.attendance = [];
    if (!state.grades) state.grades = [];
    if (!state.notifMinutes) state.notifMinutes = 10;
    if (state.notificationsEnabled === undefined) state.notificationsEnabled = false;
    if (!state.gcalClientId) state.gcalClientId = '';
    if (!state.waPhone) state.waPhone = '';
    if (!state.waServer) state.waServer = '';
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
  try { localStorage.setItem('classflow_state', JSON.stringify(state)); } catch(e) {}
}

function resetData() {
  if (!confirm('Reset all events, tasks, attendance and grades?')) return;
  state.events = defaultEvents();
  state.tasks = defaultTasks();
  state.attendance = [];
  state.grades = [];
  saveState();
  render();
}

// ══════════════════════════════════════════════
//  HELPERS
// ══════════════════════════════════════════════
function todayStr() { return new Date().toISOString().split('T')[0]; }
function nowMins() { const n=new Date(); return n.getHours()*60+n.getMinutes(); }
function timeMins(t) { const [h,m]=t.split(':').map(Number); return h*60+m; }
function fmt12(t) {
  const [h,m]=t.split(':').map(Number);
  const ampm=h>=12?'PM':'AM';
  return `${h%12||12}:${String(m).padStart(2,'0')} ${ampm}`;
}

function getEventsForDay(targetDateStr, targetDayOfWeek) {
  const seen = new Set();
  return state.events.filter(ev => {
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

function getAllEvents() {
  return [...state.events].sort((a,b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return timeMins(a.start)-timeMins(b.start);
  });
}

// ══════════════════════════════════════════════
//  RENDER
// ══════════════════════════════════════════════
function render() {
  renderUpcoming();
  renderTimeline();
  renderTasks();
  renderAllEvents();
  renderAllTasks();
  renderDeadlines();
  renderAttendanceSummary();
  renderGrades();
  renderConflictBanner();
  const schedView = document.getElementById('view-schedule');
  if (schedView && !schedView.classList.contains('hidden')) renderCalendar();
  updateBadge();
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
    <div class="upcoming-name">${ev.title}</div>
    <div class="upcoming-meta">${fmt12(ev.start)} – ${fmt12(ev.end)}${ev.location ? ' · '+ev.location : ''}</div>
    <div class="upcoming-timer" id="timer-display">--:--</div>
    <div class="upcoming-timer-label">until class starts</div>
    <div class="upcoming-actions">
      <button class="btn-ghost" onclick="deleteEvent('${ev.id}')">Remove</button>
      <button class="btn-ghost" onclick="editEvent('${ev.id}')">Edit</button>
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
    const past = timeMins(ev.end) < now;
    const active = timeMins(ev.start) <= now && timeMins(ev.end) > now;
    const hasNotes = ev.notes && ev.notes.trim().length > 0;
    return `<div class="timeline-item" onclick="editEvent('${ev.id}')" style="${past?'opacity:0.45':''}${active?';background:var(--surface2);border-color:var(--border2)':''}">
      <div class="timeline-time">${fmt12(ev.start)}</div>
      <div class="timeline-dot" style="background:${cat.dot}"></div>
      <div class="timeline-content">
        <div class="timeline-title">${ev.title}${active?' <span style="font-size:10px;color:var(--green);font-weight:600;margin-left:6px;">● LIVE</span>':''}</div>
        <div class="timeline-sub">${fmt12(ev.start)} – ${fmt12(ev.end)}${ev.location?' · '+ev.location:''}</div>
      </div>
      <div style="display:flex;align-items:center;gap:6px;flex-shrink:0;">
        ${hasNotes ? `<span class="notes-chip" onclick="event.stopPropagation();openNotesViewer('${ev.id}')">📝</span>` : ''}
        <span class="badge" style="background:${cat.bg};color:${cat.badge}">${cat.label}</span>
      </div>
    </div>`;
  }).join('');
}

function renderTasks() {
  const today = todayStr();

  const todayTasks = state.tasks.filter(t => t.due <= today && !t.done);
  const upcomingTasks = state.tasks.filter(t => t.due > today && !t.done);

  const renderTask = (t) => `<div class="task-item">
    <div class="task-check${t.done?' done':''}" onclick="toggleTask('${t.id}')"></div>
    <div class="task-text">
      <div class="task-name${t.done?' done':''}">${t.name}</div>
      <div class="task-due">${t.due}</div>
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
    const hasNotes = ev.notes && ev.notes.trim().length > 0;
    return `<div class="timeline-item" onclick="editEvent('${ev.id}')">
      <div class="timeline-time" style="width:70px;font-size:10px;">${ev.date}</div>
      <div class="timeline-dot" style="background:${cat.dot}"></div>
      <div class="timeline-content">
        <div class="timeline-title">${ev.title}</div>
        <div class="timeline-sub">${fmt12(ev.start)} – ${fmt12(ev.end)}${ev.location?' · '+ev.location:''}</div>
      </div>
      <div style="display:flex;align-items:center;gap:6px;flex-shrink:0;">
        ${hasNotes ? `<span class="notes-chip" onclick="event.stopPropagation();openNotesViewer('${ev.id}')">📝</span>` : ''}
        <span class="badge" style="background:${cat.bg};color:${cat.badge}">${cat.label}</span>
      </div>
    </div>`;
  }).join('') || '<div class="empty"><div class="empty-icon">📅</div>No events yet.</div>';
}

function renderAllTasks() {
  const el = document.getElementById('all-tasks-list');
  if (!el) return;
  const tasks = [...state.tasks].sort((a,b)=>{
    if(a.done!==b.done) return a.done?1:-1;
    return a.due.localeCompare(b.due);
  });
  el.innerHTML = tasks.map(t => `<div class="task-item" style="border-bottom:1px solid var(--border);padding:10px 0;">
    <div class="task-check${t.done?' done':''}" onclick="toggleTask('${t.id}')"></div>
    <div class="task-text">
      <div class="task-name${t.done?' done':''}">${t.name}</div>
      <div class="task-due">Due: ${t.due} · ${t.priority} priority</div>
    </div>
    <div class="priority-dot" style="background:${PRIORITY_COLORS[t.priority]||'#9090a8'}"></div>
    <span onclick="deleteTask('${t.id}')" style="font-size:14px;color:var(--text3);cursor:pointer;margin-left:8px;padding:4px;">✕</span>
  </div>`).join('') || '<div class="empty"><div class="empty-icon">✅</div>No tasks yet.</div>';
}

function updateBadge() {
  const today = todayStr();
  const count = state.tasks.filter(t => !t.done && t.due <= today).length;
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

function renderCalendar() {
  const headerEl = document.getElementById('cal-header');
  if (!headerEl) return;
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
       const cat = CAT_COLORS[ev.category] || CAT_COLORS.other;
       evHtml += `<div class="cal-event" onclick="editEvent('${ev.id}')" style="top:${top}px; height:${height}px; background:var(--surface2); border:1px solid var(--border); border-left:3px solid ${cat.dot}; color:var(--text);">
         <div class="cal-event-title">${ev.title}</div>
         <div style="font-size:8px; opacity:0.8;">${fmt12(ev.start)}</div>
       </div>`;
    });

    let gridLines = `<div class="cal-grid-lines">`;
    for(let h=0; h<24; h++) gridLines += `<div class="cal-grid-line"></div>`;
    gridLines += `</div>`;

    daysHtml += `<div class="cal-day-col">${gridLines}${evHtml}</div>`;
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
const views = ['dashboard','schedule','tasks','deadlines','focus','attendance','grades','notes-chat','optimizer','settings'];
function showView(v) {
  // Close drawer if it was open (drawer items: attendance, grades, notes-chat, optimizer, settings)
  closeMobileDrawer();
  
  // Set view visibility
  views.forEach(id => {
    const el = document.getElementById('view-'+id);
    if (el) el.classList.toggle('hidden', id!==v);
    const nav = document.getElementById('nav-'+id);
    if(nav) nav.classList.toggle('active', id===v);
    const mnav = document.getElementById('mnav-'+id);
    if(mnav) mnav.classList.toggle('active', id===v);
  });
  
  // Highlight "More" tab if viewing overflow items (attendance, grades, notes-chat, optimizer, settings)
  const overflowViews = ['attendance', 'grades', 'notes-chat', 'optimizer', 'settings'];
  const mnavMore = document.getElementById('mnav-more');
  if(mnavMore) {
    mnavMore.classList.toggle('active', overflowViews.includes(v));
  }
  
  const titles = { dashboard:'Dashboard', schedule:'Schedule', tasks:'Tasks', deadlines:'Deadlines', focus:'Focus', attendance:'Attendance', grades:'GPA Tracker', 'notes-chat':'Chat with Notes', optimizer:'Schedule Optimizer', settings:'Settings' };
  document.getElementById('mobile-title').textContent = titles[v] || v;
  if(v==='settings') {
    const keyEl = document.getElementById('settings-api-key');
    if(keyEl) keyEl.value = state.apiKey||'';
    const themeEl = document.getElementById('settings-theme');
    if(themeEl) themeEl.value = state.theme || 'dark';
    const accentEl = document.getElementById('settings-accent');
    if(accentEl) accentEl.value = state.accent || '#7c6ff7';
    updateNotifStatusUI();
    updateGCalUI();
    updateWAUI();
  }
  if(v==='schedule') { requestAnimationFrame(() => { renderCalendar(); }); }
  if(v==='deadlines') renderDeadlines();
  if(v==='attendance') { renderAttendanceSummary(); renderAttendanceLog(); }
  if(v==='grades') renderGrades();
  if(v==='notes-chat') renderNotesDocs();
  if(v==='optimizer') renderOptimizerOutput();
}

// ══════════════════════════════════════════════
//  MOBILE DRAWER (MORE MENU)
// ══════════════════════════════════════════════
function toggleMobileDrawer() {
  const drawer = document.getElementById('mobile-drawer');
  const overlay = document.getElementById('mobile-drawer-overlay');
  if(!drawer || !overlay) return;
  
  const isOpen = drawer.classList.contains('open');
  drawer.classList.toggle('open');
  overlay.classList.toggle('open');
}

function closeMobileDrawer() {
  const drawer = document.getElementById('mobile-drawer');
  const overlay = document.getElementById('mobile-drawer-overlay');
  if(!drawer || !overlay) return;
  
  drawer.classList.remove('open');
  overlay.classList.remove('open');
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
  document.getElementById('ev-notes').value = '';
  document.getElementById('event-modal').classList.remove('hidden');
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
  document.getElementById('ev-notes').value = ev.notes||'';
  document.getElementById('event-modal').classList.remove('hidden');
}
function saveEvent() {
  const title = document.getElementById('ev-title').value.trim();
  if (!title) { alert('Please enter a title'); return; }
  const ev = {
    id: editingEventId || 'e'+Date.now(),
    title,
    date: document.getElementById('ev-date').value,
    start: document.getElementById('ev-start').value,
    end: document.getElementById('ev-end').value,
    category: document.getElementById('ev-category').value,
    location: document.getElementById('ev-location').value.trim(),
    recurring: document.getElementById('ev-recurring').value,
    notes: document.getElementById('ev-notes').value.trim(),
  };
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
function deleteEvent(id) {
  state.events = state.events.filter(e=>e.id!==id);
  saveState(); render();
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
    const hasNotes = ev.notes && ev.notes.trim().length > 0;
    return `<div class="timeline-item" onclick="editEvent('${ev.id}')">
      <div class="timeline-time" style="width:70px;font-size:10px;">${ev.date}</div>
      <div class="timeline-dot" style="background:${cat.dot}"></div>
      <div class="timeline-content">
        <div class="timeline-title">${ev.title}</div>
        <div class="timeline-sub">${fmt12(ev.start)} – ${fmt12(ev.end)}${ev.location?' · '+ev.location:''}</div>
      </div>
      <div style="display:flex;align-items:center;gap:6px;flex-shrink:0;">
        ${hasNotes ? `<span class="notes-chip" onclick="event.stopPropagation();openNotesViewer('${ev.id}')">📝</span>` : ''}
        <span class="badge" style="background:${cat.bg};color:${cat.badge}">${cat.label}</span>
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
    id: 'e' + Date.now(),
    date: newDate,
    recurring: 'none',   // Bug D fix: never inherit the source's recurrence
  };

  state.events.push(newEvent);
  saveState();
  render();
  showToast(`✓ Event "${ev.title}" duplicated for ${newDate}`);
}

// ══════════════════════════════════════════════
//  CLASS NOTES VIEWER (Feature 8)
// ══════════════════════════════════════════════
let viewingNotesEventId = null;
function openNotesViewer(id) {
  const ev = state.events.find(e => e.id === id);
  if (!ev) return;
  viewingNotesEventId = id;
  document.getElementById('notes-modal-title').textContent = `📝 ${ev.title}`;
  document.getElementById('notes-modal-meta').textContent =
    `${ev.date} · ${fmt12(ev.start)} – ${fmt12(ev.end)}${ev.location ? ' · ' + ev.location : ''}`;
  const body = document.getElementById('notes-modal-body');
  body.textContent = ev.notes && ev.notes.trim() ? ev.notes : '(No notes yet — click Edit Notes to add some.)';
  body.style.color = ev.notes && ev.notes.trim() ? 'var(--text)' : 'var(--text3)';
  document.getElementById('notes-modal').classList.remove('hidden');
}
function editEventFromNotes() {
  closeModal('notes-modal');
  if (viewingNotesEventId) editEvent(viewingNotesEventId);
}

// ══════════════════════════════════════════════
//  TASKS CRUD
// ══════════════════════════════════════════════
function showAddTaskModal() {
  document.getElementById('tk-name').value = '';
  document.getElementById('tk-due').value = todayStr();
  document.getElementById('tk-priority').value = 'medium';
  document.getElementById('task-modal').classList.remove('hidden');
}
function saveTask() {
  const name = document.getElementById('tk-name').value.trim();
  if (!name) { alert('Please enter a task name'); return; }
  state.tasks.push({
    id: 't'+Date.now(),
    name,
    due: document.getElementById('tk-due').value,
    priority: document.getElementById('tk-priority').value,
    done: false,
  });
  saveState(); render();
  closeModal('task-modal');
}
function toggleTask(id) {
  const t = state.tasks.find(t=>t.id===id);
  if (t) { 
    t.done = !t.done; 
    if (t.done && navigator.vibrate) navigator.vibrate(40);
    saveState(); render(); 
  }
}
function deleteTask(id) {
  state.tasks = state.tasks.filter(t=>t.id!==id);
  saveState(); render();
}

function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

// ══════════════════════════════════════════════
//  MOBILE CHAT
// ══════════════════════════════════════════════
function openChatOverlay() {
  const overlay = document.getElementById('chat-overlay');
  overlay.classList.add('open');
  document.getElementById('chat-close-btn').style.display = '';
  document.getElementById('chat-fab').style.display = 'none';
  requestAnimationFrame(() => {
    const msgsEl = document.getElementById('chat-messages');
    if (msgsEl) msgsEl.scrollTop = msgsEl.scrollHeight;
  });
}
function closeChatOverlay() {
  const overlay = document.getElementById('chat-overlay');
  overlay.classList.remove('open');
  document.getElementById('chat-close-btn').style.display = 'none';
  document.getElementById('chat-fab').style.display = '';
}

// ══════════════════════════════════════════════
//  API KEY
// ══════════════════════════════════════════════
function saveApiKey() {
  const key = document.getElementById('settings-api-key').value.trim();
  state.apiKey = key;
  saveState();
  const statusEl = document.getElementById('api-key-status');
  if (key) { statusEl.textContent = '✓ Key saved'; statusEl.style.color='var(--green)'; }
  else { statusEl.textContent = 'Key cleared'; statusEl.style.color='var(--text3)'; }
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
  const pendingTasks = state.tasks.filter(t=>!t.done);
  const attStats = getAttendanceStats();
  const gpa = calcGPA();

  return `You are Lazy Panda 🐼, an intelligent academic scheduling assistant powered by Gemini AI embedded in a student's scheduling app.

CURRENT DATE & TIME: ${today.toDateString()}, ${today.toLocaleTimeString()}
TODAY IS: ${DAYS[today.getDay()]}

TODAY'S SCHEDULE:
${todayEvs.length ? todayEvs.map(e=>`- ${e.title} | ${fmt12(e.start)}–${fmt12(e.end)} | ${e.location||'N/A'} | ${e.category}`).join('\n') : 'No events today'}

ALL UPCOMING EVENTS (next 30):
${allEvs.map(e=>`- ${e.title} | ${e.date} | ${fmt12(e.start)}–${fmt12(e.end)} | ${e.location||'N/A'} | ${e.recurring||'once'}`).join('\n')}

PENDING TASKS:
${pendingTasks.length ? pendingTasks.map(t=>`- ${t.name} | Due: ${t.due} | ${t.priority} priority`).join('\n') : 'No pending tasks'}

ATTENDANCE SUMMARY:
${Object.keys(attStats).length ? Object.entries(attStats).map(([s,d])=>`- ${s}: ${Math.round((d.present+d.late*0.5)/d.total*100)}% (${d.present}P/${d.absent}A/${d.late}L of ${d.total})`).join('\n') : 'No attendance records'}

CURRENT GPA: ${gpa || 'Not calculated yet'}

STUDENT CONTEXT: Atif is an MS (AI) student at NED University of Engineering & Technology, Karachi. Spring 2026 cohort. Courses: CS-5137 Machine Learning, CS-5103 Mathematics for AI.

YOUR CAPABILITIES:
You can help the user manage their schedule through conversation. When a user wants to add/edit/delete events or tasks, respond in a friendly way AND include a JSON action block at the END of your response in this exact format:

ACTION:{"type":"create_event","data":{"title":"...","date":"YYYY-MM-DD","start":"HH:MM","end":"HH:MM","category":"class|study|meeting|personal|other","location":"...","recurring":"none|daily|weekly|weekends"}}

ACTION:{"type":"create_task","data":{"name":"...","due":"YYYY-MM-DD","priority":"high|medium|low"}}

ACTION:{"type":"delete_event","data":{"id":"..."}}

ACTION:{"type":"delete_task","data":{"id":"..."}}

Only include the ACTION block when actually performing an operation. Always be conversational, helpful, and proactive about suggesting study sessions or reminders. You can also give advice on attendance (warn if below 75%) and GPA improvement. If info is missing, ask clarifying questions before executing.`;
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
        const ev = { id: 'e'+Date.now()+Math.random(), ...action.data };
        state.events.push(ev);
        result = `Event "${ev.title}" added on ${ev.date} at ${fmt12(ev.start)}`;
        saveState(); render();
      } else if (action.type === 'create_task') {
        const task = { id: 't'+Date.now()+Math.random(), done: false, ...action.data };
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

async function sendMessage() {
  const input = document.getElementById('chat-input');
  const msg = input.value.trim();
  if (!msg) return;

  input.value = ''; input.style.height = '';
  addMsg('user', msg);
  chatHistory.push({ role: 'user', parts: [{ text: msg }] });

  document.getElementById('chat-send').disabled = true;
  document.getElementById('ai-chat-status').textContent = 'Thinking…';
  showTyping();
  document.getElementById('quick-chips').style.display = 'none';

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
      saveState();
      render();
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
    .filter(t => !t.done)
    .map(t => ({ ...t, _diff: deadlineDiffLabel(t.due) }))
    .sort((a, b) => a._diff.urgency - b._diff.urgency || a.due.localeCompare(b.due));

  if (!pending.length) {
    el.innerHTML = `<div class="empty"><div class="empty-icon">🎉</div>No pending deadlines!</div>`;
    return;
  }

  el.innerHTML = pending.map(t => {
    const { label, color } = t._diff;
    const pColor = PRIORITY_COLORS[t.priority] || '#9090a8';
    const barPct = Math.max(5, Math.min(100, 100 - (t._diff.urgency * 18)));
    return `<div class="deadline-card">
      <div class="deadline-card-top">
        <div class="deadline-title">${t.name}</div>
        <div class="deadline-badge" style="color:${color};background:${color}22;">${label}</div>
      </div>
      <div class="deadline-meta">
        <span style="color:${pColor};font-size:11px;font-weight:600;text-transform:uppercase;">${t.priority} priority</span>
        <span style="color:var(--text3);font-size:11px;">Due ${t.due}</span>
      </div>
      <div class="deadline-bar-track">
        <div class="deadline-bar-fill" style="width:${barPct}%;background:${color};"></div>
      </div>
      <div style="display:flex;gap:8px;margin-top:10px;">
        <button class="btn-add" style="font-size:11px;" onclick="toggleTask('${t.id}')">✓ Mark Done</button>
        <button class="btn-add" style="font-size:11px;" onclick="deleteTask('${t.id}')">✕ Remove</button>
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
  document.getElementById('attendance-modal').classList.remove('hidden');
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
    return `<div class="att-card${warn ? ' att-warn' : ''}">
      <div class="att-subject">${subj}</div>
      <div class="att-pct" style="color:${color};">${pct}%</div>
      <div class="att-bar-track"><div class="att-bar-fill" style="width:${pct}%;background:${color};"></div></div>
      <div class="att-counts">
        <span style="color:var(--green);">✅ ${s.present}</span>
        <span style="color:var(--coral);">❌ ${s.absent}</span>
        <span style="color:var(--amber);">🕐 ${s.late}</span>
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
      <div class="timeline-time" style="width:70px;font-size:10px;">${r.date}</div>
      <div style="font-size:16px;flex-shrink:0;">${STATUS_ICON[r.status] || '—'}</div>
      <div class="timeline-content">
        <div class="timeline-title">${r.subject}</div>
        <div class="timeline-sub">${r.status.charAt(0).toUpperCase()+r.status.slice(1)}${r.note ? ' · ' + r.note : ''}</div>
      </div>
      <span onclick="deleteAttendance('${r.id}')" style="font-size:14px;color:var(--text3);cursor:pointer;padding:4px;">✕</span>
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
  document.getElementById('grade-modal').classList.remove('hidden');
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

    return `<div class="grade-subject-block">
      <div class="grade-subject-header">
        <div>
          <div class="grade-subject-name">${subj}</div>
          <div style="font-size:11px;color:var(--text3);">${grades[0].credits || 3} credit hrs · ${weightedPct.toFixed(1)}% avg</div>
        </div>
        <div style="text-align:right;">
          <div class="grade-letter" style="color:${color};">${letter}</div>
          <div style="font-size:11px;color:var(--text3);">${gp.toFixed(1)} GP</div>
        </div>
      </div>
      ${grades.map(g => {
        const pct = (g.score / g.total * 100).toFixed(1);
        const { letter: gl } = gradeToLetter(parseFloat(pct));
        return `<div class="grade-item">
          <div class="grade-item-name">${g.name} <span style="color:var(--text3);font-size:10px;">(${g.weight}% weight)</span></div>
          <div style="display:flex;align-items:center;gap:10px;">
            <span style="font-size:12px;color:var(--text2);">${g.score}/${g.total} · ${pct}% · ${gl}</span>
            <span onclick="showAddGradeModal('${g.id}')" style="cursor:pointer;color:var(--text3);font-size:12px;">✏️</span>
            <span onclick="deleteGrade('${g.id}')" style="cursor:pointer;color:var(--text3);font-size:12px;">✕</span>
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
    const pending = state.tasks.filter(t => !t.done && t.due === todayStr());
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
        <b>${c.date}</b>: "${c.a.title}" (${fmt12(c.a.start)}–${fmt12(c.a.end)}) overlaps with "${c.b.title}" (${fmt12(c.b.start)}–${fmt12(c.b.end)})
      </div>`).join('')}
    </div>
    <span onclick="this.parentElement.parentElement.remove()" style="cursor:pointer;color:var(--text3);margin-left:auto;padding:2px 6px;font-size:14px;">✕</span>
  </div>`;
  const dashboard = document.getElementById('view-dashboard');
  if (dashboard) dashboard.insertAdjacentElement('afterbegin', banner);
}

// ══════════════════════════════════════════════
//  PHASE 3 — DAILY BRIEFING (Feature 9)
// ══════════════════════════════════════════════
async function triggerDailyBriefing() {
  if (!state.apiKey) {
    addMsg('ai', '⚠️ Please add your Gemini API key in Settings first.');
    return;
  }
  const today = new Date();
  const todayEvs = getTodayEvents();
  const pending = state.tasks.filter(t => !t.done && t.due <= todayStr());
  const conflicts = detectAllConflicts();
  const attStats = getAttendanceStats();
  const lowAtt = Object.entries(attStats).filter(([,s]) => s.total && Math.round((s.present + s.late*0.5)/s.total*100) < 75);

  const prompt = `Give me a motivating, concise daily briefing for ${today.toDateString()} (${DAYS[today.getDay()]}). Cover:
1. Today's schedule (${todayEvs.length} events: ${todayEvs.map(e=>e.title).join(', ') || 'none'})
2. Priority tasks (${pending.length} pending: ${pending.slice(0,3).map(t=>t.name).join(', ') || 'none'})
3. Attendance warnings if any (${lowAtt.map(([s])=>s).join(', ') || 'all good'})
4. ${conflicts.length ? conflicts.length + ' schedule conflicts detected' : 'No conflicts'}
5. One motivational tip for the day

Keep it friendly, panda-themed 🐼, under 200 words.`;

  document.getElementById('chat-input').value = prompt;
  await sendMessage();
}

// ══════════════════════════════════════════════
//  PHASE 3 — EXAM MODE (Feature 7)
// ══════════════════════════════════════════════
let examModeActive = false;

function triggerExamMode() {
  if (!state.apiKey) {
    addMsg('ai', '⚠️ Please add your Gemini API key in Settings first.');
    return;
  }
  const pending = state.tasks.filter(t => !t.done);
  const upcoming = getAllEvents().filter(ev => ev.date >= todayStr()).slice(0, 20);

  const prompt = `I want to enter EXAM MODE. Please:
1. Identify any upcoming exams or high-stakes assessments from my tasks: ${pending.map(t=>t.name).join(', ') || 'none listed'}
2. Look at my schedule for the next 2 weeks: ${upcoming.map(e=>`${e.date} ${e.title}`).join(', ')}
3. Build me a focused revision plan — suggest specific study sessions I should add (give me exact times and durations)
4. Warn me about any schedule conflicts that would eat into study time
5. Tell me which subjects need the most attention based on my tasks

Be structured, use a clear plan format, and be encouraging 🐼`;

  document.getElementById('chat-input').value = prompt;
  sendMessage();
  examModeActive = true;
  showToast('🎯 Exam Mode activated!');
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
      systemPrompt: `You are Lazy Panda 🐼, an academic scheduling assistant. Answer briefly and helpfully. Today is ${new Date().toDateString()}.`
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
// In-memory document store: { id, name, type, text, size }
let uploadedDocs = [];

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
let lastOptimizerResult = null;

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
  const pendingTasks = state.tasks.filter(t => !t.done).slice(0, 15);
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

// ══════════════════════════════════════════════
// ══════════════════════════════════════════════
render();

// Start notification scheduler if already permitted from a previous session
if ('Notification' in window && Notification.permission === 'granted' && state.notificationsEnabled) {
  startNotificationScheduler();
}

// Auto-update timeline + notifications every minute
setInterval(() => { renderTimeline(); renderUpcoming(); checkUpcomingNotifications(); }, 60000);

// Close modals on overlay click
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => {
    if (e.target === overlay) overlay.classList.add('hidden');
  });
});
window.showView = showView;
