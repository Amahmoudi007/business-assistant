// ⌘K / Ctrl K quick-actions palette: jump to a section or store, or run a common action, from anywhere.
// Built on <dialog> (native focus trap, Esc closes). Focus stays in the input; arrows move the
// highlighted option via aria-activedescendant, Enter runs it.
import { href, navigate } from './router.js';
import { NAV, savedTheme, setTheme, renderShell } from './shell.js';

const QUICK = 'کارهای سریع';
const fa = (n) => Number(n).toLocaleString('fa-IR');
const sectionHref = (id) => href(id === 'overview' ? '/app' : `/app/${id}`);

function commands(me) {
  const dark = savedTheme() !== 'light';
  const { newOrders, unanswered } = me.counts;
  return [
    { group: QUICK, label: 'محصول جدید', icon: 'plus', to: `${sectionHref('products')}${sectionHref('products').includes('?') ? '&' : '?'}new=1` },
    { group: QUICK, label: newOrders ? `بررسی ${fa(newOrders)} سفارش جدید` : 'سفارش‌ها', icon: 'bag', to: sectionHref('orders') },
    { group: QUICK, label: unanswered ? `پاسخ به ${fa(unanswered)} گفتگو` : 'گفتگوها', icon: 'message-square', to: sectionHref('conversations') },
    { group: QUICK, label: 'اتصال فروشگاه جدید', icon: 'store', to: sectionHref('stores') },
    { group: QUICK, label: 'تنظیم دستیار هوشمند', icon: 'sparkles', to: sectionHref('assistant') },
    { group: QUICK, label: dark ? 'پوستهٔ روشن' : 'پوستهٔ تیره', icon: dark ? 'sun' : 'moon', run: () => { setTheme(dark ? 'light' : 'dark'); renderShell(me); } },
    ...NAV.flatMap((g) => g.items.map((i) => ({ group: 'بخش‌ها', label: i.label, icon: i.icon, to: sectionHref(i.id) }))),
    ...me.stores.map((s) => ({ group: 'فروشگاه‌ها', label: s.name, keywords: s.slug, icon: 'store', to: href('/app', { store: s.id }) })),
    ...me.stores.map((s) => ({ group: 'صفحهٔ گفتگوی مشتری', label: `گفتگوی ${s.name}`, keywords: s.slug, icon: 'external', url: `/chat/${encodeURIComponent(s.slug)}` })),
  ];
}

/** Empty query shows the quick actions; otherwise everything whose label or slug contains the query. */
export function filterCommands(all, query) {
  const q = query.trim().toLowerCase();
  return q ? all.filter((c) => `${c.label} ${c.keywords ?? ''}`.toLowerCase().includes(q)) : all.filter((c) => c.group === QUICK);
}

let dialog = null;

export function togglePalette(me) {
  if (dialog) { dialog.close(); return; }
  const all = commands(me);
  let shown = [];
  let active = 0;
  const input = el('input', {
    class: 'palette-input', type: 'text', role: 'combobox', 'aria-expanded': 'true', 'aria-controls': 'palette-list',
    'aria-autocomplete': 'list', 'aria-label': 'جستجو در بخش‌ها، فروشگاه‌ها و کارها', placeholder: 'دنبال چه می‌گردید؟', autocomplete: 'off', spellcheck: false,
  });
  const list = el('div', { class: 'palette-list', id: 'palette-list', role: 'listbox', 'aria-label': 'نتیجه‌ها' });
  const run = (cmd) => {
    dialog.close();
    if (cmd.run) cmd.run();
    else if (cmd.url) window.open(cmd.url, '_blank', 'noopener');
    else navigate(cmd.to);
  };
  const paint = () => {
    shown = filterCommands(all, input.value);
    active = Math.min(active, Math.max(0, shown.length - 1));
    const groups = [];
    shown.forEach((cmd, i) => {
      if (groups.at(-1)?.name !== cmd.group) groups.push({ name: cmd.group, rows: [] });
      groups.at(-1).rows.push(el('div', { class: 'palette-item', role: 'option', id: `pal-${i}`, 'aria-selected': String(i === active), onclick: () => run(cmd) },
        icon(cmd.icon, 'icon icon-sm'), el('span', { text: cmd.label })));
    });
    list.replaceChildren(...(groups.length
      ? groups.map((g) => el('div', { role: 'group', 'aria-label': g.name }, el('div', { class: 'palette-group', 'aria-hidden': 'true', text: g.name }), ...g.rows))
      : [el('div', { class: 'palette-empty', text: 'نتیجه‌ای پیدا نشد' })]));
    if (shown.length) input.setAttribute('aria-activedescendant', `pal-${active}`);
    else input.removeAttribute('aria-activedescendant');
    list.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  };
  input.addEventListener('input', () => { active = 0; paint(); });
  input.addEventListener('keydown', (e) => {
    if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && shown.length) {
      e.preventDefault();
      active = (active + (e.key === 'ArrowDown' ? 1 : -1) + shown.length) % shown.length;
      paint();
    } else if (e.key === 'Enter' && !e.isComposing && shown[active]) {
      e.preventDefault();
      run(shown[active]);
    }
  });
  dialog = el('dialog', { class: 'palette', 'aria-label': 'جستجو و کارهای سریع' },
    el('div', { class: 'palette-search' }, icon('search', 'icon icon-sm'), input, el('kbd', { text: 'Esc' })), list);
  dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); }); // click on the backdrop
  dialog.addEventListener('close', () => { dialog.remove(); dialog = null; });
  document.body.append(dialog);
  paint();
  dialog.showModal();
  input.focus();
}
