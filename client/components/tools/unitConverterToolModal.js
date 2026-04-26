const CONVERSION_GROUPS = {
  length: {
    label: 'Length',
    units: {
      meter: 1,
      kilometer: 1000,
      centimeter: 0.01,
      millimeter: 0.001,
      inch: 0.0254,
      foot: 0.3048,
    },
  },
  weight: {
    label: 'Weight',
    units: {
      kilogram: 1,
      gram: 0.001,
      pound: 0.45359237,
      ounce: 0.028349523125,
    },
  },
  currency: {
    label: 'Desk ratios',
    units: {
      unit: 1,
      dozen: 12,
      score: 20,
      gross: 144,
    },
  },
};

function buildOptions(groupKey) {
  return Object.keys(CONVERSION_GROUPS[groupKey].units)
    .map((unit) => `<option value="${unit}">${unit}</option>`)
    .join('');
}

function convert(groupKey, fromUnit, toUnit, inputValue) {
  const value = Number(inputValue);
  if (Number.isNaN(value)) {
    return '0';
  }

  const group = CONVERSION_GROUPS[groupKey];
  const inBaseUnit = value * group.units[fromUnit];
  const converted = inBaseUnit / group.units[toUnit];
  return String(Number(converted.toFixed(6)));
}

export function createUnitConverterToolModal() {
  const state = {
    group: 'length',
  };

  function sync(root) {
    const groupEl = root.querySelector('#tool-converter-group');
    const fromEl = root.querySelector('#tool-converter-from');
    const toEl = root.querySelector('#tool-converter-to');
    const inputEl = root.querySelector('#tool-converter-input');
    const outputEl = root.querySelector('#tool-converter-output');

    if (!groupEl || !fromEl || !toEl || !inputEl || !outputEl) return;

    groupEl.value = state.group;
    fromEl.innerHTML = buildOptions(state.group);
    toEl.innerHTML = buildOptions(state.group);

    const unitKeys = Object.keys(CONVERSION_GROUPS[state.group].units);
    fromEl.value = unitKeys[0];
    toEl.value = unitKeys[1] || unitKeys[0];
    outputEl.value = convert(state.group, fromEl.value, toEl.value, inputEl.value || '0');
  }

  function recalculate(root) {
    const fromEl = root.querySelector('#tool-converter-from');
    const toEl = root.querySelector('#tool-converter-to');
    const inputEl = root.querySelector('#tool-converter-input');
    const outputEl = root.querySelector('#tool-converter-output');

    if (!fromEl || !toEl || !inputEl || !outputEl) return;

    outputEl.value = convert(state.group, fromEl.value, toEl.value, inputEl.value || '0');
  }

  return {
    id: 'converter',
    title: 'Unit Converter',
    subtitle: 'Fast quantity conversions',
    description: 'Convert common lengths, weights, and grouped quantity ratios.',
    badge: 'Convert',
    render() {
      return `
        <div class="hidden fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4" data-tool-modal="converter" role="dialog" aria-modal="true" aria-labelledby="tool-converter-title">
          <div class="absolute inset-0" data-dismiss-modal></div>
          <div class="relative bg-gray-900 border border-gray-700 rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-300">
            <div class="border-b border-gray-700 p-6 flex justify-between items-start bg-gray-800/50">
              <div>
                <p class="text-xs font-black text-indigo-400 uppercase tracking-widest">Conversion</p>
                <h2 id="tool-converter-title" class="text-2xl font-black text-white mt-1 tracking-tighter italic">Unit Converter</h2>
              </div>
              <button type="button" class="w-10 h-10 flex items-center justify-center rounded-xl bg-gray-800 text-gray-400 hover:text-white transition" data-close-utility aria-label="Close dialog">✕</button>
            </div>
            <div class="p-8 space-y-6 bg-gray-900">
              <div class="space-y-2">
                <label class="block text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Measure Category</label>
                <select id="tool-converter-group" class="w-full bg-gray-800 border-none rounded-2xl px-4 py-3 text-white text-sm font-black focus:ring-2 focus:ring-indigo-500/30 transition-all appearance-none cursor-pointer">
                  <option value="length">Length & Distance</option>
                  <option value="weight">Mass & Weight</option>
                  <option value="currency">Desk Quantity Ratios</option>
                </select>
              </div>
              
              <div class="space-y-2">
                <label class="block text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Input Quantity</label>
                <input id="tool-converter-input" class="w-full bg-gray-800 border-none rounded-2xl px-4 py-4 text-white text-2xl font-black focus:ring-2 focus:ring-indigo-500/30 transition-all text-center placeholder:text-gray-700 shadow-inner" type="number" step="any" value="1" />
              </div>
              
              <div class="grid grid-cols-2 gap-4 bg-gray-800/30 p-4 rounded-3xl border border-gray-800">
                <div class="space-y-2">
                  <label class="block text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1 text-center">From</label>
                  <select id="tool-converter-from" class="w-full bg-gray-800 border-none rounded-xl px-3 py-2 text-white text-[11px] font-black focus:ring-1 focus:ring-indigo-500/30 appearance-none text-center cursor-pointer"></select>
                </div>
                <div class="space-y-2">
                  <label class="block text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1 text-center">To</label>
                  <select id="tool-converter-to" class="w-full bg-gray-800 border-none rounded-xl px-3 py-2 text-white text-[11px] font-black focus:ring-1 focus:ring-indigo-500/30 appearance-none text-center cursor-pointer"></select>
                </div>
              </div>
              
              <div class="space-y-2">
                <label class="block text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Resulting Value</label>
                <input id="tool-converter-output" class="w-full bg-emerald-950/30 border-2 border-emerald-900/20 rounded-2xl px-4 py-4 text-emerald-400 text-2xl font-black focus:outline-none text-center cursor-default font-mono shadow-lg shadow-emerald-900/10" type="text" readonly />
              </div>
            </div>
          </div>
        </div>
      `;
    },
    init(root) {
      const groupEl = root.querySelector('#tool-converter-group');
      const fromEl = root.querySelector('#tool-converter-from');
      const toEl = root.querySelector('#tool-converter-to');
      const inputEl = root.querySelector('#tool-converter-input');

      groupEl?.addEventListener('change', () => {
        state.group = groupEl.value;
        sync(root);
      });

      fromEl?.addEventListener('change', () => recalculate(root));
      toEl?.addEventListener('change', () => recalculate(root));
      inputEl?.addEventListener('input', () => recalculate(root));

      sync(root);
    },
    onOpen(root) {
      sync(root);
      root.querySelector('#tool-converter-input')?.focus();
    },
  };
}
