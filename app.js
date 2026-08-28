(() => {
  'use strict';

  const STORAGE_KEY = 'camp-belongings-v1';

  const STATUS_ORDER = ['none', 'got', 'unneeded', 'later'];
  const STATUS_META = {
    none: { label: '未選択', icon: '' },
    got: { label: '持った', icon: '✓' },
    unneeded: { label: 'いらない', icon: '✕' },
    later: { label: '後で確認', icon: '?' },
  };
  function nextStatus(s) {
    return STATUS_ORDER[(STATUS_ORDER.indexOf(s) + 1) % STATUS_ORDER.length];
  }

  function uid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'id_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 9);
  }

  function defaultData() {
    const registry = {};
    const I = (name) => {
      if (!registry[name]) registry[name] = { id: uid(), name };
      return registry[name];
    };
    const base = ['テント', 'タープ', 'ペグ', 'ハンマー', 'グランドシート', '寝袋', 'マット', '焚き火台', '薪', '着火剤', 'ライター', 'ランタン', 'テーブル', 'チェア', 'クーラーボックス', '虫除けスプレー', '救急セット', 'ゴミ袋', '軍手', '耐熱グローブ'].map(I);
    const cook = ['バーナー', 'ガス缶', 'クッカーセット', 'スキレット', 'まな板', '包丁', '食器', 'カトラリー', 'キッチンペーパー', '洗剤・スポンジ', 'ラップ', 'アルミホイル'].map(I);
    const ahijo = ['スキレット', 'オリーブオイル', 'ニンニク', 'アヒージョの具材', '耐熱グローブ', 'バゲット'].map(I);
    const fire = ['焚き火台', '薪', '着火剤', '火吹き棒', '耐熱グローブ', '火消し壺'].map(I);
    const clothes = ['着替え', 'タオル', '洗面用具', '常備薬', 'モバイルバッテリー', 'ヘッドライト', '日焼け止め'].map(I);

    const categories = [
      { id: uid(), name: '基本装備', itemIds: base.map(i => i.id) },
      { id: uid(), name: '調理', itemIds: cook.map(i => i.id) },
      { id: uid(), name: 'アヒージョ', itemIds: ahijo.map(i => i.id) },
      { id: uid(), name: '焚き火', itemIds: fire.map(i => i.id) },
      { id: uid(), name: '衣類・身の回り', itemIds: clothes.map(i => i.id) },
    ];

    return {
      items: Object.values(registry),
      categories,
      trips: [],
      currentTripId: null,
    };
  }

  // Migrates old boolean checkedItemIds[] trips into the itemStatus map.
  function normalize(s) {
    s.trips.forEach(t => {
      if (!t.itemStatus) t.itemStatus = {};
      if (Array.isArray(t.checkedItemIds)) {
        t.checkedItemIds.forEach(id => { if (!t.itemStatus[id]) t.itemStatus[id] = 'got'; });
        delete t.checkedItemIds;
      }
    });
    return s;
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.items) && Array.isArray(parsed.categories) && Array.isArray(parsed.trips)) {
          return normalize(parsed);
        }
      }
    } catch (e) { console.warn('load failed', e); }
    const d = defaultData();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(d));
    return d;
  }

  let state = load();

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  // ---------- helpers ----------
  function findItem(id) { return state.items.find(i => i.id === id); }
  function findCategory(id) { return state.categories.find(c => c.id === id); }
  function currentTrip() { return state.trips.find(t => t.id === state.currentTripId) || null; }

  function categoryCountFor(itemId) {
    return state.categories.filter(c => c.itemIds.includes(itemId)).length;
  }

  function statusOf(trip, itemId) {
    return (trip.itemStatus && trip.itemStatus[itemId]) || 'none';
  }

  function isResolved(status) {
    return status === 'got' || status === 'unneeded';
  }

  function fmtDate(iso) {
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    return `${y}年${Number(m)}月${Number(d)}日`;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  // ---------- routing ----------
  const VIEWS = ['checklist', 'trips', 'master'];
  function currentView() {
    const h = (location.hash || '').replace('#', '');
    return VIEWS.includes(h) ? h : 'checklist';
  }

  function goto(view) {
    location.hash = view;
  }

  window.addEventListener('hashchange', render);

  // ---------- render root ----------
  const root = document.getElementById('view-root');

  function render() {
    const view = currentView();
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === view);
    });
    if (view === 'checklist') renderChecklist();
    else if (view === 'trips') renderTrips();
    else if (view === 'master') renderMaster();
  }

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => goto(btn.dataset.view));
  });

  // ================= Checklist view =================
  function renderChecklist() {
    const tpl = document.getElementById('tpl-checklist');
    root.innerHTML = '';
    root.appendChild(tpl.content.cloneNode(true));

    const tripBar = document.getElementById('trip-bar');
    const trip = currentTrip();

    if (!trip) {
      tripBar.innerHTML = `
        <div class="trip-bar-empty">まだキャンプ回がありません。<br>
        <button type="button" class="link" id="go-trips-btn">「キャンプ回」タブで作成してください →</button></div>`;
      document.getElementById('go-trips-btn').addEventListener('click', () => goto('trips'));
      document.getElementById('progress-fill').style.width = '0%';
      document.getElementById('progress-label').textContent = '0 / 0';
      document.getElementById('category-list').innerHTML = '';
      return;
    }

    tripBar.innerHTML = `
      <div class="trip-bar-name">${escapeHtml(trip.name)}</div>
      <div class="trip-bar-date">${trip.date ? fmtDate(trip.date) : '日付未設定'} ・
        <button type="button" class="link" id="switch-trip-btn">切り替える</button>
      </div>`;
    document.getElementById('switch-trip-btn').addEventListener('click', () => goto('trips'));

    const allItemIds = new Set();
    state.categories.forEach(c => c.itemIds.forEach(id => allItemIds.add(id)));
    const total = allItemIds.size;
    const idList = [...allItemIds];
    const resolved = idList.filter(id => isResolved(statusOf(trip, id))).length;
    const laterCount = idList.filter(id => statusOf(trip, id) === 'later').length;
    document.getElementById('progress-fill').style.width = total ? `${Math.round(resolved / total * 100)}%` : '0%';
    document.getElementById('progress-label').textContent = laterCount
      ? `${resolved} / ${total}（後で確認 ${laterCount}）`
      : `${resolved} / ${total}`;

    const listEl = document.getElementById('category-list');
    const emptyHint = document.getElementById('checklist-empty-hint');

    if (state.categories.length === 0) {
      emptyHint.hidden = false;
      listEl.innerHTML = '';
      return;
    }
    emptyHint.hidden = true;

    listEl.innerHTML = state.categories.map(cat => {
      const items = cat.itemIds.map(findItem).filter(Boolean);
      const resolvedCount = items.filter(it => isResolved(statusOf(trip, it.id))).length;
      const rows = items.map(it => {
        const status = statusOf(trip, it.id);
        const shareCount = categoryCountFor(it.id);
        const meta = STATUS_META[status];
        return `
          <li class="item-row status-${status}" data-item-id="${it.id}">
            <span class="status-dot" aria-hidden="true">${meta.icon}</span>
            <span class="item-name">${escapeHtml(it.name)}</span>
            ${shareCount > 1 ? `<span class="shared-badge">他${shareCount - 1}カテゴリ</span>` : ''}
            ${status !== 'none' ? `<span class="status-text">${meta.label}</span>` : ''}
          </li>`;
      }).join('');
      return `
        <div class="category-card">
          <div class="category-head">
            <span>${escapeHtml(cat.name)}</span>
            <span class="cat-count">${resolvedCount} / ${items.length}</span>
          </div>
          <ul class="item-list">${rows || '<li class="item-row"><span class="item-name">アイテムがありません</span></li>'}</ul>
        </div>`;
    }).join('');

    listEl.querySelectorAll('.item-row[data-item-id]').forEach(row => {
      row.addEventListener('click', () => {
        const itemId = row.dataset.itemId;
        const t = currentTrip();
        if (!t) return;
        t.itemStatus[itemId] = nextStatus(statusOf(t, itemId));
        save();
        renderChecklist();
      });
    });
  }

  // ================= Trips view =================
  function renderTrips() {
    const tpl = document.getElementById('tpl-trips');
    root.innerHTML = '';
    root.appendChild(tpl.content.cloneNode(true));

    const form = document.getElementById('trip-new-form');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('trip-name-input').value.trim();
      const date = document.getElementById('trip-date-input').value;
      if (!name) return;
      const trip = { id: uid(), name, date, itemStatus: {} };
      state.trips.unshift(trip);
      state.currentTripId = trip.id;
      save();
      goto('checklist');
    });

    const listEl = document.getElementById('trip-list');
    if (state.trips.length === 0) {
      listEl.innerHTML = '<p class="hint">まだキャンプ回がありません。上のフォームから作成してください。</p>';
      return;
    }

    const allItemIds = new Set();
    state.categories.forEach(c => c.itemIds.forEach(id => allItemIds.add(id)));
    const idList = [...allItemIds];

    listEl.innerHTML = state.trips.map(t => {
      const active = t.id === state.currentTripId;
      const resolved = idList.filter(id => isResolved(statusOf(t, id))).length;
      return `
        <li class="${active ? 'active' : ''}" data-trip-id="${t.id}">
          <div class="trip-info">
            <div class="name">${escapeHtml(t.name)}</div>
            <div class="meta">${t.date ? fmtDate(t.date) : '日付未設定'} ・ 対応済み ${resolved} / ${idList.length}</div>
          </div>
          <button type="button" class="trip-select-btn" data-select="${t.id}">${active ? '選択中' : '選ぶ'}</button>
          <button type="button" class="trip-delete-btn" data-delete="${t.id}" aria-label="削除">🗑️</button>
        </li>`;
    }).join('');

    listEl.querySelectorAll('[data-select]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.currentTripId = btn.dataset.select;
        save();
        goto('checklist');
      });
    });
    listEl.querySelectorAll('[data-delete]').forEach(btn => {
      btn.addEventListener('click', () => {
        const t = state.trips.find(x => x.id === btn.dataset.delete);
        if (!t) return;
        if (!confirm(`「${t.name}」を削除しますか？チェック記録も失われます。`)) return;
        state.trips = state.trips.filter(x => x.id !== t.id);
        if (state.currentTripId === t.id) {
          state.currentTripId = state.trips[0] ? state.trips[0].id : null;
        }
        save();
        renderTrips();
      });
    });
  }

  // ================= Master view =================
  let pickerState = null; // { categoryId, search }

  function renderMaster() {
    const tpl = document.getElementById('tpl-master');
    root.innerHTML = '';
    root.appendChild(tpl.content.cloneNode(true));

    document.getElementById('category-new-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const input = document.getElementById('category-name-input');
      const name = input.value.trim();
      if (!name) return;
      state.categories.push({ id: uid(), name, itemIds: [] });
      save();
      renderMaster();
    });

    const catListEl = document.getElementById('master-category-list');
    catListEl.innerHTML = state.categories.map(cat => {
      const items = cat.itemIds.map(findItem).filter(Boolean);
      const rows = items.map(it => `
        <li>
          <span class="item-name">${escapeHtml(it.name)}</span>
          <button type="button" class="icon-btn" data-remove-from-cat="${cat.id}|${it.id}" aria-label="このカテゴリから外す">✕</button>
        </li>`).join('');
      return `
        <div class="master-category-card" data-cat-id="${cat.id}">
          <div class="master-category-head">
            <input type="text" value="${escapeHtml(cat.name)}" data-rename-cat="${cat.id}">
            <button type="button" class="icon-btn danger" data-delete-cat="${cat.id}" aria-label="カテゴリ削除">🗑️</button>
          </div>
          <ul class="master-item-list-inner">${rows || '<li class="hint" style="border:none;padding:8px 6px;">アイテムがありません</li>'}</ul>
          <button type="button" class="add-item-btn" data-open-picker="${cat.id}">＋ アイテムを追加</button>
        </div>`;
    }).join('') || '<p class="hint">まだカテゴリがありません。上のフォームから追加してください。</p>';

    catListEl.querySelectorAll('[data-rename-cat]').forEach(inp => {
      inp.addEventListener('change', () => {
        const cat = findCategory(inp.dataset.renameCat);
        const v = inp.value.trim();
        if (cat && v) { cat.name = v; save(); }
        renderMaster();
      });
    });
    catListEl.querySelectorAll('[data-delete-cat]').forEach(btn => {
      btn.addEventListener('click', () => {
        const cat = findCategory(btn.dataset.deleteCat);
        if (!cat) return;
        if (!confirm(`カテゴリ「${cat.name}」を削除しますか？（アイテム自体は他のカテゴリに残ります）`)) return;
        state.categories = state.categories.filter(c => c.id !== cat.id);
        save();
        renderMaster();
      });
    });
    catListEl.querySelectorAll('[data-remove-from-cat]').forEach(btn => {
      btn.addEventListener('click', () => {
        const [catId, itemId] = btn.dataset.removeFromCat.split('|');
        const cat = findCategory(catId);
        if (!cat) return;
        cat.itemIds = cat.itemIds.filter(id => id !== itemId);
        save();
        renderMaster();
      });
    });
    catListEl.querySelectorAll('[data-open-picker]').forEach(btn => {
      btn.addEventListener('click', () => openItemPicker(btn.dataset.openPicker));
    });

    const globalListEl = document.getElementById('master-item-list');
    if (state.items.length === 0) {
      globalListEl.innerHTML = '<li class="hint" style="border:none;">まだアイテムがありません。</li>';
    } else {
      globalListEl.innerHTML = state.items.map(it => {
        const cats = state.categories.filter(c => c.itemIds.includes(it.id)).map(c => c.name);
        return `
          <li>
            <input type="text" class="item-name" value="${escapeHtml(it.name)}" data-rename-item="${it.id}" style="border:1px solid var(--line);border-radius:8px;padding:6px 8px;">
            <span class="cat-tags" title="${escapeHtml(cats.join('、'))}">${cats.length ? escapeHtml(cats.join('、')) : '未使用'}</span>
            <button type="button" class="icon-btn danger" data-delete-item="${it.id}" aria-label="削除">🗑️</button>
          </li>`;
      }).join('');
    }

    globalListEl.querySelectorAll('[data-rename-item]').forEach(inp => {
      inp.addEventListener('change', () => {
        const it = findItem(inp.dataset.renameItem);
        const v = inp.value.trim();
        if (it && v) { it.name = v; save(); }
        renderMaster();
      });
    });
    globalListEl.querySelectorAll('[data-delete-item]').forEach(btn => {
      btn.addEventListener('click', () => {
        const it = findItem(btn.dataset.deleteItem);
        if (!it) return;
        if (!confirm(`アイテム「${it.name}」を削除しますか？全カテゴリ・全キャンプ回のチェック記録からも削除されます。`)) return;
        const id = it.id;
        state.items = state.items.filter(i => i.id !== id);
        state.categories.forEach(c => { c.itemIds = c.itemIds.filter(iid => iid !== id); });
        state.trips.forEach(t => { delete t.itemStatus[id]; });
        save();
        renderMaster();
      });
    });

    document.getElementById('export-btn').addEventListener('click', exportData);
    document.getElementById('import-btn').addEventListener('click', () => document.getElementById('import-file').click());
    document.getElementById('import-file').addEventListener('change', importData);
    document.getElementById('reset-btn').addEventListener('click', resetAllData);
  }

  function openItemPicker(categoryId) {
    pickerState = { categoryId, search: '' };
    const tpl = document.getElementById('tpl-item-picker');
    const node = tpl.content.cloneNode(true);
    document.body.appendChild(node);
    const backdrop = document.body.lastElementChild;

    const searchInput = backdrop.querySelector('#picker-search');
    const listEl = backdrop.querySelector('#picker-list');
    const closeBtn = backdrop.querySelector('#picker-close-btn');
    const createBtn = backdrop.querySelector('#picker-create-btn');

    function renderPickerList() {
      const cat = findCategory(pickerState.categoryId);
      const q = pickerState.search.trim();
      const matched = state.items.filter(it => !q || it.name.includes(q));
      if (matched.length === 0) {
        listEl.innerHTML = '<li class="picker-empty">該当するアイテムがありません。新規作成できます。</li>';
        return;
      }
      listEl.innerHTML = matched.map(it => {
        const already = cat.itemIds.includes(it.id);
        return `
          <li class="${already ? 'already' : ''}">
            <span>${escapeHtml(it.name)}</span>
            <button type="button" data-add-item="${it.id}" ${already ? 'disabled' : ''}>${already ? '追加済み' : '追加'}</button>
          </li>`;
      }).join('');
      listEl.querySelectorAll('[data-add-item]').forEach(btn => {
        btn.addEventListener('click', () => {
          const cat2 = findCategory(pickerState.categoryId);
          const itemId = btn.dataset.addItem;
          if (!cat2.itemIds.includes(itemId)) cat2.itemIds.push(itemId);
          save();
          renderPickerList();
          renderMaster();
        });
      });
    }

    searchInput.addEventListener('input', () => {
      pickerState.search = searchInput.value;
      renderPickerList();
    });

    createBtn.addEventListener('click', () => {
      const name = searchInput.value.trim();
      if (!name) { searchInput.focus(); return; }
      let it = state.items.find(i => i.name === name);
      if (!it) {
        it = { id: uid(), name };
        state.items.push(it);
      }
      const cat = findCategory(pickerState.categoryId);
      if (!cat.itemIds.includes(it.id)) cat.itemIds.push(it.id);
      save();
      renderPickerList();
      renderMaster();
      searchInput.value = '';
      pickerState.search = '';
    });

    function closePicker() {
      backdrop.remove();
      pickerState = null;
    }
    closeBtn.addEventListener('click', closePicker);
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) closePicker(); });

    renderPickerList();
    searchInput.focus();
  }

  // ---------- data import / export ----------
  function exportData() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `camp-belongings-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function importData(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (!parsed || !Array.isArray(parsed.items) || !Array.isArray(parsed.categories) || !Array.isArray(parsed.trips)) {
          throw new Error('invalid format');
        }
        if (!confirm('現在のデータを読み込んだ内容で上書きします。よろしいですか？')) return;
        state = normalize(parsed);
        save();
        renderMaster();
        alert('読み込みました。');
      } catch (err) {
        alert('読み込みに失敗しました。ファイル形式を確認してください。');
      } finally {
        e.target.value = '';
      }
    };
    reader.readAsText(file);
  }

  function resetAllData() {
    if (!confirm('全データを削除して初期状態に戻します。元に戻せません。よろしいですか？')) return;
    state = defaultData();
    save();
    goto('checklist');
    render();
  }

  // ---------- init ----------
  render();

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    });
  }
})();
