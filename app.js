import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// ---- Supabase Setup ----
const supabase = createClient(
  'https://xhhmxabftbyxrirvvihn.supabase.co',
  'sb_publishable_NZHoIxqqpSvVBP8MrLHCYA_gmg1AbN-'
);

const T = {
  users: 'uNMexs7BYTXQ2_sub_tracker_v1_app_users',
  subs:  'uNMexs7BYTXQ2_sub_tracker_v1_subscriptions',
  pays:  'uNMexs7BYTXQ2_sub_tracker_v1_payments'
};

const CATEGORIES = ['Streaming','Music','Cloud','AI','Fitness','Creative','Entertainment','Web','Other'];
const CYCLES = ['monthly','yearly','weekly','quarterly'];
const CAT_ICONS = {
  Streaming:'fa-tv', Music:'fa-music', Cloud:'fa-cloud',
  AI:'fa-robot', Fitness:'fa-dumbbell', Creative:'fa-palette',
  Entertainment:'fa-gamepad', Web:'fa-globe', Other:'fa-tag'
};

let currentUser = null;
let subscriptions = [];
let payments = [];
let currentTab = 'subs';
let editingId = null;
let lineChart = null;
let barChart = null;

const app = document.getElementById('app');

// ---- Helpers ----
function esc(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function showToast(msg) {
  document.querySelectorAll('.toast').forEach(t => t.remove());
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2800);
}

function fmtMoney(n, currency) {
  currency = currency || 'USD';
  try {
    return new Intl.NumberFormat('en-US', { style:'currency', currency }).format(n);
  } catch { return '$' + Number(n).toFixed(2); }
}

function daysUntil(dateStr) {
  if (!dateStr) return 999;
  const today = new Date(); today.setHours(0,0,0,0);
  const d = new Date(dateStr); d.setHours(0,0,0,0);
  return Math.ceil((d - today) / 86400000);
}

function daysBadge(dateStr) {
  const d = daysUntil(dateStr);
  if (d < 0) return '<span class="days-badge days-urgent"><i class="fas fa-exclamation-circle"></i> Overdue</span>';
  if (d === 0) return '<span class="days-badge days-urgent"><i class="fas fa-bell"></i> Today</span>';
  if (d <= 3) return '<span class="days-badge days-urgent"><i class="fas fa-bell"></i> ' + d + 'd</span>';
  if (d <= 7) return '<span class="days-badge days-soon"><i class="fas fa-clock"></i> ' + d + 'd</span>';
  return '<span class="days-badge days-ok">' + d + 'd</span>';
}

function catClass(cat) {
  return 'cat-' + (cat || 'other').toLowerCase();
}

function catIcon(cat) {
  return CAT_ICONS[cat] || 'fa-tag';
}

function monthlyEquiv(cost, cycle) {
  cost = Number(cost) || 0;
  switch(cycle) {
    case 'weekly': return cost * 4.33;
    case 'quarterly': return cost / 3;
    case 'yearly': return cost / 12;
    default: return cost;
  }
}

// ---- Auth: ensure app_users row ----
async function ensureAppUser(user) {
  try {
    const { data } = await supabase.from(T.users)
      .select('*').eq('user_id', user.id).limit(1);
    if (!data || data.length === 0) {
      await supabase.from(T.users).insert({
        email: user.email,
        display_name: user.email.split('@')[0]
      });
    }
  } catch(e) { console.error('ensureAppUser:', e); }
}

// ===========================
//  AUTH SCREENS
// ===========================
function renderSignUp() {
  app.innerHTML = `
    <div class="auth-container">
      <div class="auth-card">
        <div class="auth-logo">
          <i class="fas fa-receipt" style="color:#818cf8;font-size:2.5rem;"></i>
        </div>
        <div class="auth-title">Subscription Tracker</div>
        <div class="auth-subtitle">Track every recurring charge</div>
        <div style="margin-bottom:14px;">
          <label class="form-label">Email</label>
          <input class="form-input" id="su-email" type="email" placeholder="you@example.com">
        </div>
        <div style="margin-bottom:14px;">
          <label class="form-label">Password</label>
          <input class="form-input" id="su-pass" type="password" placeholder="Min 6 characters">
        </div>
        <div class="auth-error" id="su-err"></div>
        <button class="btn btn-accent btn-full" id="su-btn">
          <i class="fas fa-rocket"></i> Sign Up
        </button>
        <div style="text-align:center;margin-top:12px;">
          <button class="btn-link" id="goto-si">Already have an account? <strong>Sign In</strong></button>
        </div>
      </div>
    </div>`;
  document.getElementById('su-btn').onclick = handleSignUp;
  document.getElementById('goto-si').onclick = renderSignIn;
}

async function handleSignUp() {
  const email = document.getElementById('su-email').value.trim();
  const pass = document.getElementById('su-pass').value;
  const err = document.getElementById('su-err');
  err.textContent = '';
  if (!email) return err.textContent = 'Enter your email';
  if (pass.length < 6) return err.textContent = 'Password must be 6+ characters';
  const btn = document.getElementById('su-btn');
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';
  try {
    const { data, error } = await supabase.auth.signUp({
      email, password: pass,
      options: { emailRedirectTo: 'https://sling-gogiapp.web.app/email-confirmed.html' }
    });
    if (error) {
      if (error.message.includes('already') || error.message.includes('registered')) {
        const { data: sid, error: sie } = await supabase.auth.signInWithPassword({ email, password: pass });
        if (sie) { err.textContent = 'Account exists. Incorrect password.'; btn.disabled = false; btn.innerHTML = '<i class="fas fa-rocket"></i> Sign Up'; return; }
        currentUser = sid.user;
        await ensureAppUser(currentUser);
        await loadData();
        renderDashboard();
        return;
      }
      throw error;
    }
    renderCheckEmail(email);
  } catch(e) {
    err.textContent = e.message || 'Sign up failed';
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-rocket"></i> Sign Up';
  }
}

function renderCheckEmail(email) {
  app.innerHTML = `
    <div class="auth-container">
      <div class="auth-card" style="text-align:center;">
        <div style="font-size:3rem;margin-bottom:12px;">
          <i class="fas fa-envelope-open-text" style="color:#818cf8;"></i>
        </div>
        <div class="auth-title" style="font-size:1.4rem;">Check Your Email</div>
        <p style="color:var(--text-dim);line-height:1.6;margin:16px 0 24px;">
          We sent a confirmation link to<br>
          <strong style="color:var(--accent-light);">${esc(email)}</strong><br><br>
          Click the link, then come back to sign in.
        </p>
        <button class="btn btn-accent btn-full" id="goto-si2">
          <i class="fas fa-sign-in-alt"></i> Go to Sign In
        </button>
      </div>
    </div>`;
  document.getElementById('goto-si2').onclick = renderSignIn;
}

function renderSignIn() {
  app.innerHTML = `
    <div class="auth-container">
      <div class="auth-card">
        <div class="auth-logo">
          <i class="fas fa-receipt" style="color:#818cf8;font-size:2.5rem;"></i>
        </div>
        <div class="auth-title">Welcome Back</div>
        <div class="auth-subtitle">Sign in to your tracker</div>
        <div style="margin-bottom:14px;">
          <label class="form-label">Email</label>
          <input class="form-input" id="si-email" type="email" placeholder="you@example.com">
        </div>
        <div style="margin-bottom:14px;">
          <label class="form-label">Password</label>
          <input class="form-input" id="si-pass" type="password" placeholder="Your password">
        </div>
        <div class="auth-error" id="si-err"></div>
        <button class="btn btn-accent btn-full" id="si-btn">
          <i class="fas fa-door-open"></i> Sign In
        </button>
        <div style="text-align:center;margin-top:12px;">
          <button class="btn-link" id="goto-su">Don't have an account? <strong>Sign Up</strong></button>
        </div>
      </div>
    </div>`;
  document.getElementById('si-btn').onclick = handleSignIn;
  document.getElementById('goto-su').onclick = renderSignUp;
}

async function handleSignIn() {
  const email = document.getElementById('si-email').value.trim();
  const pass = document.getElementById('si-pass').value;
  const err = document.getElementById('si-err');
  err.textContent = '';
  if (!email) return err.textContent = 'Enter your email';
  if (!pass) return err.textContent = 'Enter your password';
  const btn = document.getElementById('si-btn');
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing in...';
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass });
    if (error) {
      if (error.message.includes('not confirmed') || error.message.includes('Email not confirmed')) {
        err.textContent = 'Check your email and click the confirmation link first.';
      } else {
        err.textContent = error.message || 'Sign in failed';
      }
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-door-open"></i> Sign In';
      return;
    }
    currentUser = data.user;
    await ensureAppUser(currentUser);
    await loadData();
    renderDashboard();
  } catch(e) {
    err.textContent = e.message || 'Sign in failed';
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-door-open"></i> Sign In';
  }
}

// ===========================
//  DATA LOADING
// ===========================
async function loadData() {
  try {
    const [sRes, pRes] = await Promise.all([
      supabase.from(T.subs).select('*').order('next_billing', { ascending: true }),
      supabase.from(T.pays).select('*').order('paid_at', { ascending: false }).limit(100)
    ]);
    subscriptions = sRes.data || [];
    payments = pRes.data || [];
  } catch(e) { console.error('loadData:', e); }
}

// ===========================
//  DASHBOARD
// ===========================
function renderDashboard() {
  editingId = null;
  const active = subscriptions.filter(s => s.active !== false);
  const monthlyTotal = active.reduce((sum, s) => sum + monthlyEquiv(s.cost, s.cycle), 0);
  const yearlyTotal = monthlyTotal * 12;
  const upcoming = active.filter(s => daysUntil(s.next_billing) <= 3 && daysUntil(s.next_billing) >= 0);

  app.innerHTML = `
    <!-- Header -->
    <div class="app-header">
      <div class="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <i class="fas fa-receipt text-accent-light text-lg"></i>
          <span class="font-bold text-sm">Subscription Tracker</span>
        </div>
        <button class="text-slate-400 hover:text-rose text-sm" id="signout-btn" title="Sign out">
          <i class="fas fa-sign-out-alt"></i>
        </button>
      </div>
    </div>

    <div class="max-w-lg mx-auto px-4 py-5 space-y-5" id="dashboard">

      <!-- Stats Grid -->
      <div class="grid grid-cols-2 gap-3">
        <div class="stat-card indigo">
          <div class="stat-icon indigo"><i class="fas fa-calendar-alt"></i></div>
          <div class="stat-value">${fmtMoney(monthlyTotal)}</div>
          <div class="stat-label">Monthly Burn</div>
        </div>
        <div class="stat-card emerald">
          <div class="stat-icon emerald"><i class="fas fa-chart-line"></i></div>
          <div class="stat-value">${fmtMoney(yearlyTotal)}</div>
          <div class="stat-label">Yearly Total</div>
        </div>
        <div class="stat-card amber-top">
          <div class="stat-icon amber"><i class="fas fa-layer-group"></i></div>
          <div class="stat-value">${active.length}</div>
          <div class="stat-label">Active Subs</div>
        </div>
        <div class="stat-card rose-top">
          <div class="stat-icon rose"><i class="fas fa-bell"></i></div>
          <div class="stat-value">${upcoming.length}</div>
          <div class="stat-label">Due Soon</div>
        </div>
      </div>

      ${upcoming.length > 0 ? `
        <div class="alert-banner">
          <div class="alert-icon"><i class="fas fa-exclamation-triangle"></i></div>
          <div>
            <div class="text-sm font-semibold text-rose">${upcoming.length} subscription${upcoming.length>1?'s':''} renewing soon</div>
            <div class="text-xs text-slate-400 mt-0.5">${upcoming.map(s => s.name).join(', ')}</div>
          </div>
        </div>
      ` : ''}

      <!-- Tabs -->
      <div class="tab-bar">
        <button class="tab-btn ${currentTab==='subs'?'active':''}" data-tab="subs">
          <i class="fas fa-layer-group"></i> Subs
        </button>
        <button class="tab-btn ${currentTab==='chart'?'active':''}" data-tab="chart">
          <i class="fas fa-chart-bar"></i> Charts
        </button>
        <button class="tab-btn ${currentTab==='history'?'active':''}" data-tab="history">
          <i class="fas fa-history"></i> History
        </button>
      </div>

      <div id="tab-content"></div>
    </div>`;

  document.getElementById('signout-btn').onclick = async () => {
    await supabase.auth.signOut();
    currentUser = null;
    renderSignIn();
  };

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.onclick = () => {
      currentTab = btn.dataset.tab;
      renderDashboard();
    };
  });

  if (currentTab === 'subs') renderSubsTab();
  else if (currentTab === 'chart') renderChartTab();
  else renderHistoryTab();
}

// ===========================
//  SUBS TAB
// ===========================
function renderSubsTab() {
  const tc = document.getElementById('tab-content');

  tc.innerHTML = `
    <button class="btn btn-accent btn-full" id="add-btn" style="margin-bottom:14px;">
      <i class="fas fa-plus"></i> Add Subscription
    </button>
    <div id="add-form-slot"></div>
    <div class="space-y-3" id="sub-list">
      ${subscriptions.length === 0 ? `
        <div class="empty-state">
          <div class="empty-icon"><i class="fas fa-inbox"></i></div>
          <p class="text-sm">No subscriptions yet. Add your first one!</p>
        </div>
      ` : subscriptions.map((s, i) => subCard(s, i)).join('')}
    </div>`;

  let addOpen = false;
  document.getElementById('add-btn').onclick = () => {
    addOpen = !addOpen;
    const slot = document.getElementById('add-form-slot');
    if (addOpen) {
      slot.innerHTML = subForm(null);
      bindFormEvents(null);
    } else {
      slot.innerHTML = '';
    }
  };

  bindSubCardEvents();
}

function subCard(s, idx) {
  const inactive = s.active === false;
  const days = daysUntil(s.next_billing);
  return `
    <div class="sub-card ${inactive ? 'inactive' : ''}" style="animation-delay:${idx * 0.06}s;" data-id="${s.id}">
      <div class="flex items-start justify-between gap-3">
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 mb-1">
            <span class="cat-badge ${catClass(s.category)}">
              <i class="fas ${catIcon(s.category)}"></i> ${esc(s.category || 'Other')}
            </span>
            ${daysBadge(s.next_billing)}
          </div>
          <div class="sub-name">${esc(s.name)}</div>
          <div class="flex items-baseline gap-2 mt-1">
            <span class="sub-cost">${fmtMoney(s.cost, s.currency)}</span>
            <span class="sub-cycle">/ ${s.cycle || 'month'}</span>
          </div>
          <div class="text-xs text-slate-500 mt-1">
            <i class="far fa-calendar"></i> Next: ${s.next_billing ? new Date(s.next_billing).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' }) : 'N/A'}
          </div>
        </div>
        <div class="flex flex-col items-end gap-2">
          <label class="toggle" title="${inactive ? 'Activate' : 'Pause'}">
            <input type="checkbox" ${!inactive ? 'checked' : ''} data-toggle="${s.id}">
            <span class="toggle-slider"></span>
          </label>
          <div class="flex gap-1">
            <button class="btn btn-outline btn-sm" data-edit="${s.id}" title="Edit">
              <i class="fas fa-pencil-alt text-xs"></i>
            </button>
            <button class="btn btn-danger btn-sm" data-delete="${s.id}" data-name="${esc(s.name)}" title="Delete">
              <i class="fas fa-trash-alt text-xs"></i>
            </button>
          </div>
        </div>
      </div>
      <div id="edit-slot-${s.id}"></div>
    </div>`;
}

function bindSubCardEvents() {
  // Toggle active
  document.querySelectorAll('[data-toggle]').forEach(cb => {
    cb.onchange = async () => {
      const id = cb.dataset.toggle;
      const active = cb.checked;
      try {
        await supabase.from(T.subs).update({ active }).eq('id', id);
        await loadData();
        renderDashboard();
        showToast(active ? 'Subscription activated' : 'Subscription paused');
      } catch(e) { console.error(e); showToast('Failed to update'); }
    };
  });

  // Edit
  document.querySelectorAll('[data-edit]').forEach(btn => {
    btn.onclick = () => {
      const id = btn.dataset.edit;
      if (editingId === id) {
        editingId = null;
        document.getElementById('edit-slot-' + id).innerHTML = '';
        return;
      }
      // Close previous
      if (editingId) {
        const prev = document.getElementById('edit-slot-' + editingId);
        if (prev) prev.innerHTML = '';
      }
      editingId = id;
      const s = subscriptions.find(x => x.id === id);
      const slot = document.getElementById('edit-slot-' + id);
      slot.innerHTML = subForm(s);
      bindFormEvents(s);
    };
  });

  // Delete
  document.querySelectorAll('[data-delete]').forEach(btn => {
    btn.onclick = () => showDeleteModal(btn.dataset.delete, btn.dataset.name);
  });
}

function subForm(existing) {
  const s = existing || {};
  const isEdit = !!existing;
  return `
    <div class="edit-form mt-4 pt-4" style="border-top:1px solid var(--border);">
      <div class="text-sm font-semibold text-accent-light mb-3">
        <i class="fas ${isEdit ? 'fa-pencil-alt' : 'fa-plus-circle'}"></i>
        ${isEdit ? 'Edit Subscription' : 'New Subscription'}
      </div>
      <div class="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label class="form-label">Name</label>
          <input class="form-input" id="f-name" value="${esc(s.name || '')}" placeholder="Netflix">
        </div>
        <div>
          <label class="form-label">Cost</label>
          <input class="form-input" id="f-cost" type="number" step="0.01" value="${s.cost || ''}" placeholder="9.99">
        </div>
      </div>
      <div class="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label class="form-label">Cycle</label>
          <select class="form-select" id="f-cycle">
            ${CYCLES.map(c => `<option value="${c}" ${s.cycle===c?'selected':''}>${c.charAt(0).toUpperCase()+c.slice(1)}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="form-label">Category</label>
          <select class="form-select" id="f-cat">
            ${CATEGORIES.map(c => `<option value="${c}" ${s.category===c?'selected':''}>${c}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label class="form-label">Next Billing</label>
          <input class="form-input" id="f-date" type="date" value="${s.next_billing ? s.next_billing.split('T')[0] : ''}">
        </div>
        <div>
          <label class="form-label">Currency</label>
          <select class="form-select" id="f-cur">
            <option value="USD" ${(s.currency||'USD')==='USD'?'selected':''}>USD</option>
            <option value="EUR" ${s.currency==='EUR'?'selected':''}>EUR</option>
            <option value="GBP" ${s.currency==='GBP'?'selected':''}>GBP</option>
            <option value="CAD" ${s.currency==='CAD'?'selected':''}>CAD</option>
            <option value="AUD" ${s.currency==='AUD'?'selected':''}>AUD</option>
          </select>
        </div>
      </div>
      <div class="flex gap-2">
        <button class="btn btn-accent btn-full btn-sm" id="f-save">
          <i class="fas fa-check"></i> ${isEdit ? 'Save Changes' : 'Add Subscription'}
        </button>
        <button class="btn btn-outline btn-sm" id="f-cancel">Cancel</button>
      </div>
    </div>`;
}

function bindFormEvents(existing) {
  document.getElementById('f-save').onclick = async () => {
    const name = document.getElementById('f-name').value.trim();
    const cost = parseFloat(document.getElementById('f-cost').value);
    const cycle = document.getElementById('f-cycle').value;
    const category = document.getElementById('f-cat').value;
    const next_billing = document.getElementById('f-date').value || null;
    const currency = document.getElementById('f-cur').value;

    if (!name) return showToast('Enter a name');
    if (isNaN(cost) || cost <= 0) return showToast('Enter a valid cost');

    try {
      if (existing) {
        await supabase.from(T.subs).update({ name, cost, cycle, category, next_billing, currency }).eq('id', existing.id);
        showToast('Subscription updated');
      } else {
        await supabase.from(T.subs).insert({ name, cost, cycle, category, next_billing, currency, active: true });
        showToast('Subscription added!');
      }
      editingId = null;
      await loadData();
      renderDashboard();
    } catch(e) {
      console.error(e);
      showToast('Failed to save');
    }
  };

  document.getElementById('f-cancel').onclick = () => {
    if (existing) {
      editingId = null;
      const slot = document.getElementById('edit-slot-' + existing.id);
      if (slot) slot.innerHTML = '';
    } else {
      document.getElementById('add-form-slot').innerHTML = '';
    }
  };
}

function showDeleteModal(id, name) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-card">
      <div style="font-size:2.5rem;margin-bottom:12px;"><i class="fas fa-trash-alt" style="color:var(--rose);"></i></div>
      <div class="text-lg font-bold mb-2">Delete Subscription?</div>
      <p class="text-sm text-slate-400 mb-5">
        Are you sure you want to delete <strong class="text-white">${name}</strong>? This cannot be undone.
      </p>
      <div class="flex gap-2">
        <button class="btn btn-outline btn-full btn-sm" id="del-cancel">Cancel</button>
        <button class="btn btn-danger btn-full btn-sm" id="del-confirm">
          <i class="fas fa-trash-alt"></i> Delete
        </button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  document.getElementById('del-cancel').onclick = () => overlay.remove();
  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

  document.getElementById('del-confirm').onclick = async () => {
    try {
      await supabase.from(T.subs).delete().eq('id', id);
      overlay.remove();
      await loadData();
      renderDashboard();
      showToast('Subscription deleted');
    } catch(e) {
      console.error(e);
      showToast('Failed to delete');
    }
  };
}

// ===========================
//  CHART TAB
// ===========================
function renderChartTab() {
  const tc = document.getElementById('tab-content');
  tc.innerHTML = `
    <div class="chart-card mb-4">
      <div class="text-sm font-semibold text-accent-light mb-3">
        <i class="fas fa-chart-line"></i> Monthly Spending (6 Months)
      </div>
      <canvas id="line-chart" height="200"></canvas>
    </div>
    <div class="chart-card">
      <div class="text-sm font-semibold text-accent-light mb-3">
        <i class="fas fa-chart-pie"></i> Spending by Category
      </div>
      <canvas id="bar-chart" height="220"></canvas>
    </div>`;

  buildLineChart();
  buildBarChart();
}

function buildLineChart() {
  const ctx = document.getElementById('line-chart');
  if (!ctx) return;

  // Build 6 months of data from payments
  const months = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      label: d.toLocaleDateString('en-US', { month:'short', year:'2-digit' }),
      year: d.getFullYear(),
      month: d.getMonth()
    });
  }

  const spending = months.map(m => {
    return payments
      .filter(p => {
        const d = new Date(p.paid_at);
        return d.getFullYear() === m.year && d.getMonth() === m.month;
      })
      .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  });

  // If no payment data, estimate from subscriptions
  const hasPaymentData = spending.some(v => v > 0);
  const active = subscriptions.filter(s => s.active !== false);
  const estimatedMonthly = active.reduce((sum, s) => sum + monthlyEquiv(s.cost, s.cycle), 0);

  const chartData = hasPaymentData ? spending : months.map(() => estimatedMonthly);
  const chartLabel = hasPaymentData ? 'Actual Spending' : 'Estimated Monthly';

  if (lineChart) lineChart.destroy();
  lineChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: months.map(m => m.label),
      datasets: [{
        label: chartLabel,
        data: chartData,
        borderColor: '#818cf8',
        backgroundColor: 'rgba(99,102,241,0.1)',
        fill: true,
        tension: 0.4,
        pointBackgroundColor: '#818cf8',
        pointBorderColor: '#0b0f1a',
        pointBorderWidth: 2,
        pointRadius: 5
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => '$' + ctx.parsed.y.toFixed(2)
          }
        }
      },
      scales: {
        x: { ticks: { color: '#94a3b8', font: { size: 11 } }, grid: { color: 'rgba(99,102,241,0.06)' } },
        y: { ticks: { color: '#94a3b8', font: { size: 11 }, callback: v => '$' + v }, grid: { color: 'rgba(99,102,241,0.06)' } }
      }
    }
  });
}

function buildBarChart() {
  const ctx = document.getElementById('bar-chart');
  if (!ctx) return;

  const active = subscriptions.filter(s => s.active !== false);
  const catMap = {};
  active.forEach(s => {
    const cat = s.category || 'Other';
    catMap[cat] = (catMap[cat] || 0) + monthlyEquiv(s.cost, s.cycle);
  });

  const labels = Object.keys(catMap);
  const values = Object.values(catMap);
  const colors = labels.map(l => {
    const map = {
      Streaming:'#f87171', Music:'#c084fc', Cloud:'#38bdf8',
      AI:'#34d399', Fitness:'#fb923c', Creative:'#f472b6',
      Entertainment:'#fbbf24', Web:'#2dd4bf', Other:'#94a3b8'
    };
    return map[l] || '#94a3b8';
  });

  if (barChart) barChart.destroy();
  barChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Monthly Cost',
        data: values,
        backgroundColor: colors.map(c => c + '33'),
        borderColor: colors,
        borderWidth: 1.5,
        borderRadius: 6,
        barThickness: 32
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => '$' + ctx.parsed.y.toFixed(2) + '/mo'
          }
        }
      },
      scales: {
        x: { ticks: { color: '#94a3b8', font: { size: 10 } }, grid: { display: false } },
        y: { ticks: { color: '#94a3b8', font: { size: 11 }, callback: v => '$' + v }, grid: { color: 'rgba(99,102,241,0.06)' } }
      }
    }
  });
}

// ===========================
//  HISTORY TAB
// ===========================
function renderHistoryTab() {
  const tc = document.getElementById('tab-content');

  if (payments.length === 0) {
    tc.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon"><i class="fas fa-receipt"></i></div>
        <p class="text-sm">No payment history yet.</p>
        <p class="text-xs text-slate-500 mt-1">Payments will appear here as subscriptions renew.</p>
      </div>`;
    return;
  }

  // Group by month
  const grouped = {};
  payments.forEach(p => {
    const d = new Date(p.paid_at);
    const key = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(p);
  });

  tc.innerHTML = Object.entries(grouped).map(([month, items]) => {
    const total = items.reduce((s, p) => s + (Number(p.amount) || 0), 0);
    return `
      <div class="mb-5">
        <div class="flex items-center justify-between mb-2">
          <span class="text-sm font-semibold text-slate-300">${month}</span>
          <span class="text-xs font-bold text-accent-light">${fmtMoney(total)}</span>
        </div>
        <div class="space-y-2">
          ${items.map(p => {
            const sub = subscriptions.find(s => s.id === p.subscription_id);
            const cat = sub ? sub.category : 'Other';
            return `
              <div class="payment-item">
                <div class="payment-icon ${catClass(cat)}" style="background:${catBg(cat)};">
                  <i class="fas ${catIcon(cat)}"></i>
                </div>
                <div class="flex-1 min-w-0">
                  <div class="text-sm font-semibold">${sub ? esc(sub.name) : 'Unknown'}</div>
                  <div class="text-xs text-slate-500">${new Date(p.paid_at).toLocaleDateString('en-US', { month:'short', day:'numeric' })}</div>
                </div>
                <div class="text-sm font-bold">${fmtMoney(p.amount)}</div>
              </div>`;
          }).join('')}
        </div>
      </div>`;
  }).join('');
}

function catBg(cat) {
  const map = {
    Streaming:'rgba(239,68,68,0.12)', Music:'rgba(168,85,247,0.12)',
    Cloud:'rgba(56,189,248,0.12)', AI:'rgba(52,211,153,0.12)',
    Fitness:'rgba(251,146,60,0.12)', Creative:'rgba(244,114,182,0.12)',
    Entertainment:'rgba(251,191,36,0.12)', Web:'rgba(45,212,191,0.12)',
    Other:'rgba(148,163,184,0.12)'
  };
  return map[cat] || map.Other;
}

// ===========================
//  REALTIME
// ===========================
function setupRealtime() {
  supabase.channel('sub-tracker')
    .on('postgres_changes', { event: '*', schema: 'public', table: T.subs }, async () => {
      await loadData();
      if (currentTab === 'subs' || currentTab === 'chart') renderDashboard();
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: T.pays }, async () => {
      await loadData();
      if (currentTab === 'history' || currentTab === 'chart') renderDashboard();
    })
    .subscribe();
}

// ===========================
//  INIT
// ===========================
async function init() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      currentUser = user;
      await ensureAppUser(currentUser);
      await loadData();
      renderDashboard();
      setupRealtime();
    } else {
      renderSignUp();
    }
  } catch(e) {
    console.error('Init error:', e);
    renderSignUp();
  }
}

init();
