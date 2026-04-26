function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getMonthLabel(date) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
  }).format(date);
}

function getCalendarGrid(date) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startOffset = firstDay.getDay();
  const daysInMonth = lastDay.getDate();
  const cells = [];

  for (let index = 0; index < startOffset; index += 1) {
    cells.push({ day: '', muted: true, today: false });
  }

  const today = new Date();
  const todayYear = today.getFullYear();
  const todayMonth = today.getMonth();
  const todayDate = today.getDate();

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({
      day,
      muted: false,
      today: year === todayYear && month === todayMonth && day === todayDate,
    });
  }

  while (cells.length % 7 !== 0) {
    cells.push({ day: '', muted: true, today: false });
  }

  return cells;
}

export function createCalendarToolModal() {
  let calendarDate = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  function renderCalendar(root) {
    const monthEl = root.querySelector('#tool-calendar-month');
    const gridEl = root.querySelector('#tool-calendar-grid');

    if (!monthEl || !gridEl) return;

    monthEl.textContent = getMonthLabel(calendarDate);
    gridEl.innerHTML = getCalendarGrid(calendarDate)
      .map((cell) => `
        <div class="aspect-square flex items-center justify-center rounded text-sm font-medium ${cell.muted ? 'text-gray-600' : 'text-white'} ${cell.today ? 'bg-blue-600 font-bold' : 'bg-gray-800 hover:bg-gray-700'}">
          ${escapeHtml(cell.day)}
        </div>
      `)
      .join('');
  }

  return {
    id: 'calendar',
    title: 'Calendar',
    subtitle: 'See dates at a glance',
    description: 'Browse months and keep track of today.',
    badge: 'Date',
    render() {
      return `
        <div class="hidden fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4" data-tool-modal="calendar" role="dialog" aria-modal="true" aria-labelledby="tool-calendar-title">
          <div class="absolute inset-0" data-dismiss-modal></div>
          <div class="relative bg-gray-900 border border-gray-700 rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-300">
            <div class="border-b border-gray-700 p-6 flex justify-between items-start bg-gray-800/50">
              <div>
                <p class="text-xs font-black text-indigo-400 uppercase tracking-widest">Calendar</p>
                <h2 id="tool-calendar-title" class="text-2xl font-black text-white mt-1 tracking-tighter italic">Monthly Planner</h2>
              </div>
              <button type="button" class="w-10 h-10 flex items-center justify-center rounded-xl bg-gray-800 text-gray-400 hover:text-white transition" data-close-utility aria-label="Close dialog">✕</button>
            </div>
            <div class="p-6 space-y-6 bg-gray-900">
              <div class="flex justify-between items-center gap-4 bg-gray-800/50 p-2 rounded-2xl border border-gray-800">
                <button type="button" class="w-10 h-10 flex items-center justify-center rounded-xl bg-gray-800 hover:bg-gray-700 text-white transition font-black" data-calendar-nav="prev">←</button>
                <div class="text-sm font-black text-white uppercase tracking-[0.2em]" id="tool-calendar-month"></div>
                <button type="button" class="w-10 h-10 flex items-center justify-center rounded-xl bg-gray-800 hover:bg-gray-700 text-white transition font-black" data-calendar-nav="next">→</button>
              </div>
              <div class="grid grid-cols-7 gap-2">
                ${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => `
                  <div class="text-center text-[10px] font-black text-gray-500 uppercase tracking-widest">${d}</div>
                `).join('')}
              </div>
              <div class="grid grid-cols-7 gap-2" id="tool-calendar-grid"></div>
            </div>
          </div>
        </div>
      `;
    },
    init(root) {
      renderCalendar(root);

      root.addEventListener('click', (event) => {
        const navButton = event.target.closest('[data-calendar-nav]');
        if (!navButton) return;

        calendarDate = new Date(
          calendarDate.getFullYear(),
          calendarDate.getMonth() + (navButton.dataset.calendarNav === 'next' ? 1 : -1),
          1
        );

        renderCalendar(root);
      });
    },
    onOpen(root) {
      renderCalendar(root);
    },
  };
}
