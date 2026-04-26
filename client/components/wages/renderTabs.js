export function renderTabs({ activeTab }) {
  const baseClass = "px-3 py-1.5 text-[10px] font-black uppercase rounded transition-all";
  const activeClass = "bg-white text-slate-900 shadow-sm border border-slate-200";
  const inactiveClass = "text-slate-400 hover:text-slate-600";

  return `
      <div class="flex p-0.5 bg-slate-100 rounded-lg gap-0.5">
        <button 
          class="${baseClass} flex-1 ${activeTab === 'create' ? activeClass : inactiveClass}" 
          data-action="switch-tab"
          data-tab="create"
        >
          📝 Create
        </button>
        <button 
          class="${baseClass} flex-1 ${activeTab === 'manage' ? activeClass : inactiveClass}" 
          data-action="switch-tab"
          data-tab="manage"
        >
          ✔️ Manage
        </button>
      </div>
    `;
}