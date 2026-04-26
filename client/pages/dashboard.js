import { renderLayout } from '../components/layout.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { api } from '../utils/api.js';
import { authManager } from '../utils/auth.js';

const DASHBOARD_CARDS = [
  { id: 'overview', row: 0, col: 0, span: 2, minHeight: 280 },
  { id: 'status', row: 0, col: 2, span: 1, minHeight: 280 },
  { id: 'activity', row: 1, col: 0, span: 1, minHeight: 250 },
  { id: 'security', row: 1, col: 1, span: 1, minHeight: 250 },
  { id: 'account', row: 1, col: 2, span: 1, minHeight: 250 },
  { id: 'revenue', row: 2, col: 0, span: 1, minHeight: 240 },
  { id: 'modules', row: 2, col: 1, span: 1, minHeight: 240 },
  { id: 'tip', row: 2, col: 2, span: 1, minHeight: 240 },
];

export async function renderDashboard(router) {
  const canAccess = await requireAuth(router);
  if (!canAccess) return;

  const user = authManager.getUser();

  try {
    const response = await api.get('/api/pages/dashboard');
    const data = response.data;
    const content = createDashboardContent(user, data);

    renderLayout(content, router);
    setupDashboardInteractions();
  } catch (error) {
    const content = `
      <div class="max-w-4xl mx-auto px-4 py-16 space-y-6">
        <h1 class="text-3xl font-bold text-gray-900">Dashboard</h1>

        <div class="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-lg">
          Failed to load dashboard data. ${escapeHtml(error.message)}
        </div>
      </div>
    `;

    renderLayout(content, router);
  }
}

function createDashboardContent(user, data) {
  const safeUser = {
    id: escapeHtml(user?.id ?? 'N/A'),
    username: escapeHtml(user?.username ?? 'User'),
    email: escapeHtml(user?.email ?? 'N/A'),
    role: escapeHtml(user?.role ?? 'user'),
    firmName: escapeHtml(user?.firm_name ?? 'General workspace'),
  };

  const safeStats = {
    pageViews: Number(data?.stats?.pageViews ?? 0).toLocaleString(),
    activeUsers: Number(data?.stats?.activeUsers ?? 0).toLocaleString(),
    revenue: Number(data?.stats?.revenue ?? 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }),
    growth: escapeHtml(data?.stats?.growth ?? '+0%'),
  };

  const safeActivity = Array.isArray(data?.recentActivity) ? data.recentActivity : [];

  const cards = [
    createBoardCard({
      id: 'overview',
      title: 'Operations Overview',
      eyebrow: 'Live workspace',
      body: `
        <div class="dashboard-hero-copy">
          <h1>Dashboard control room</h1>
          <p>
            Welcome back, <strong>${safeUser.username}</strong>. Your authenticated session is active and the
            workspace is running with automatic token refresh.
          </p>
        </div>
        <div class="dashboard-stat-row">
          ${createMetricChip('Page Views', safeStats.pageViews)}
          ${createMetricChip('Active Users', safeStats.activeUsers)}
          ${createMetricChip('Revenue', '$' + safeStats.revenue)}
          ${createMetricChip('Growth', safeStats.growth)}
        </div>
      `,
    }),
    createBoardCard({
      id: 'status',
      title: 'Session Status',
      eyebrow: 'Security posture',
      body: `
        <div class="dashboard-status-stack">
          <div class="dashboard-pill success">Authenticated</div>
          <div class="dashboard-highlight">
            <span>Dual-token session</span>
            <strong>Access 15m / Refresh 30d</strong>
          </div>
          <div class="dashboard-highlight">
            <span>Cookie transport</span>
            <strong>HTTP-only + SameSite strict</strong>
          </div>
          <div class="dashboard-highlight">
            <span>Device tracking</span>
            <strong>Bound to this browser session</strong>
          </div>
        </div>
      `,
    }),
    createBoardCard({
      id: 'activity',
      title: 'Recent Activity',
      eyebrow: 'Feed',
      body: `
        <div class="dashboard-list">
          ${safeActivity.map(activity => `
            <div class="dashboard-list-item">
              <strong>${escapeHtml(activity.action)}</strong>
              <span>${escapeHtml(activity.time)}</span>
            </div>
          `).join('')}
        </div>
      `,
    }),
    createBoardCard({
      id: 'security',
      title: 'Security Layers',
      eyebrow: 'Defense-in-depth',
      body: `
        <div class="dashboard-checklist">
          <div>JWT type checks prevent access/refresh token substitution.</div>
          <div>Refresh tokens are hashed in storage and revocable per device or family.</div>
          <div>CSRF cookies are paired with the X-CSRF-Token header on state-changing requests.</div>
          <div>Rate limiting and account lockouts slow brute-force attempts.</div>
        </div>
      `,
    }),
    createBoardCard({
      id: 'account',
      title: 'Account Snapshot',
      eyebrow: 'Identity',
      body: `
        <div class="dashboard-identity-grid">
          ${createIdentityRow('User ID', safeUser.id)}
          ${createIdentityRow('Username', safeUser.username)}
          ${createIdentityRow('Email', safeUser.email)}
          ${createIdentityRow('Role', safeUser.role)}
          ${createIdentityRow('Workspace', safeUser.firmName)}
        </div>
      `,
    }),
    createBoardCard({
      id: 'revenue',
      title: 'Business Pulse',
      eyebrow: 'KPIs',
      body: `
        <div class="dashboard-pulse-grid">
          <div class="dashboard-pulse-card">
            <span>Revenue signal</span>
            <strong>$${safeStats.revenue}</strong>
          </div>
          <div class="dashboard-pulse-card">
            <span>Growth trend</span>
            <strong>${safeStats.growth}</strong>
          </div>
          <div class="dashboard-pulse-card">
            <span>Engagement</span>
            <strong>${safeStats.pageViews} visits</strong>
          </div>
        </div>
      `,
    }),
    createBoardCard({
      id: 'modules',
      title: 'Core Modules',
      eyebrow: 'Navigation hints',
      body: `
        <div class="dashboard-tag-grid">
          <span>Inventory</span>
          <span>Wages</span>
          <span>Master Roll</span>
          <span>Ledger</span>
          <span>Profile</span>
          <span>Admin</span>
        </div>
        <p class="dashboard-footnote">
          Sidebar-driven navigation keeps module entry points consistent across the app shell.
        </p>
      `,
    }),
    createBoardCard({
      id: 'tip',
      title: 'Operator Notes',
      eyebrow: 'Usage',
      body: `
        <div class="dashboard-note">
          Drag cards to rearrange the workspace on desktop. Layout starts collision-free, stays within the board,
          and falls back to a stacked mobile layout on smaller screens.
        </div>
        <div class="dashboard-note muted">
          Your access token refreshes automatically before expiry while the refresh token remains valid.
        </div>
      `,
    }),
  ];

  return `
    <div class="w-full px-0 py-6 dashboard-page">
      <section class="dashboard-shell">
        <div class="dashboard-topbar">
          <div>
            <h2>Glass Workspace</h2>
            <p>Secure business dashboard</p>
          </div>
          <div class="dashboard-topbar-meta">
            <span>${safeUser.role}</span>
            <span>${safeUser.firmName}</span>
            <span>Drag enabled on desktop</span>
          </div>
        </div>

        <div class="dashboard-board" data-dashboard-board>
          ${cards.join('')}
        </div>
      </section>
    </div>
  `;
}

function createBoardCard({ id, title, eyebrow, body }) {
  const layout = DASHBOARD_CARDS.find(card => card.id === id);

  return `
    <article
      class="dashboard-card"
      data-dashboard-card
      data-card-id="${id}"
      data-row="${layout.row}"
      data-col="${layout.col}"
      data-span="${layout.span}"
      data-min-height="${layout.minHeight}"
    >
      <div class="dashboard-card-header">
        <div>
          <small>${eyebrow}</small>
          <h3>${title}</h3>
        </div>
        <button type="button" class="dashboard-drag-handle" data-drag-handle aria-label="Drag card">+</button>
      </div>
      <div class="dashboard-card-body">${body}</div>
    </article>
  `;
}

function createMetricChip(label, value) {
  return `
    <div class="dashboard-chip">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `;
}

function createIdentityRow(label, value) {
  return `
    <div class="dashboard-identity-row">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `;
}

function setupDashboardInteractions() {
  const board = document.querySelector('[data-dashboard-board]');
  const cards = Array.from(document.querySelectorAll('[data-dashboard-card]'));
  const desktopMedia = window.matchMedia('(min-width: 1024px)');
  const layoutById = new Map(DASHBOARD_CARDS.map(card => [card.id, card]));

  if (!board || !cards.length) return;

  let zIndex = cards.length + 1;
  let dragState = null;

  const setBoardHeight = value => {
    board.style.height = `${Math.max(value, 0)}px`;
  };

  const applyPosition = (card, x, y) => {
    card.dataset.x = String(x);
    card.dataset.y = String(y);
    card.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  };

  const clampCardPosition = (card, rawX, rawY) => {
    const boardRect = board.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    const maxX = Math.max(0, boardRect.width - cardRect.width);
    const maxY = Math.max(0, boardRect.height - cardRect.height);

    return {
      x: Math.min(Math.max(0, rawX), maxX),
      y: Math.min(Math.max(0, rawY), maxY),
    };
  };

  const syncDesktopLayout = () => {
    if (!desktopMedia.matches) {
      board.style.height = '';
      cards.forEach(card => {
        card.style.width = '';
        card.style.minHeight = '';
        card.style.transform = '';
      });
      return;
    }

    const boardWidth = board.clientWidth;
    const gap = 28;
    const columns = 3;
    const columnWidth = (boardWidth - gap * (columns - 1)) / columns;

    if (columnWidth <= 0) return;

    cards.forEach(card => {
      const meta = layoutById.get(card.dataset.cardId);
      if (!meta) return;

      const width = (columnWidth * meta.span) + (gap * (meta.span - 1));
      card.style.width = `${width}px`;
      card.style.minHeight = `${meta.minHeight}px`;
      card.style.transform = 'translate3d(0, 0, 0)';
    });

    const rowHeights = new Map();
    cards.forEach(card => {
      const row = Number(card.dataset.row || 0);
      const height = Math.ceil(card.offsetHeight);
      rowHeights.set(row, Math.max(rowHeights.get(row) || 0, height));
    });

    const rowOffsets = [];
    let runningOffset = 0;
    const maxRow = Math.max(...cards.map(card => Number(card.dataset.row || 0)));
    for (let row = 0; row <= maxRow; row += 1) {
      rowOffsets[row] = runningOffset;
      runningOffset += (rowHeights.get(row) || 0) + gap;
    }

    cards.forEach(card => {
      const meta = layoutById.get(card.dataset.cardId);
      if (!meta) return;

      const x = (columnWidth + gap) * meta.col;
      const y = rowOffsets[meta.row] || 0;
      applyPosition(card, x, y);
    });

    setBoardHeight(runningOffset - gap);
  };

  cards.forEach(card => {
    const handle = card.querySelector('[data-drag-handle]');
    if (!handle) return;

    handle.addEventListener('pointerdown', event => {
      if (!desktopMedia.matches) return;

      event.preventDefault();
      const cardX = Number(card.dataset.x || 0);
      const cardY = Number(card.dataset.y || 0);

      dragState = {
        card,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        initialX: cardX,
        initialY: cardY,
      };

      zIndex += 1;
      card.style.zIndex = String(zIndex);
      card.classList.add('is-dragging');
      handle.setPointerCapture(event.pointerId);
    });

    handle.addEventListener('pointermove', event => {
      if (!dragState || dragState.pointerId !== event.pointerId) return;

      const deltaX = event.clientX - dragState.startX;
      const deltaY = event.clientY - dragState.startY;
      const nextPosition = clampCardPosition(
        dragState.card,
        dragState.initialX + deltaX,
        dragState.initialY + deltaY
      );

      applyPosition(dragState.card, nextPosition.x, nextPosition.y);
    });

    const stopDragging = event => {
      if (!dragState || dragState.pointerId !== event.pointerId) return;

      dragState.card.classList.remove('is-dragging');
      dragState = null;
    };

    handle.addEventListener('pointerup', stopDragging);
    handle.addEventListener('pointercancel', stopDragging);
  });

  syncDesktopLayout();
  window.addEventListener('resize', syncDesktopLayout, { passive: true });
  desktopMedia.addEventListener('change', syncDesktopLayout);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
