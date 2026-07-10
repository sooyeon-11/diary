/* =========================================================
   app.js — 메인 컨트롤러 (탭 전환 · 설정 · 백업 · D-day)
   ========================================================= */
(function () {
  const Diary = (window.Diary = window.Diary || {});
  const ui = Diary.ui;
  const el = ui.el;

  let currentView = 'map';

  function field(label, control) {
    return el('div', { class: 'field' }, [el('label', { class: 'field__label', text: label }), control]);
  }
  function pickJSON() {
    return new Promise((resolve) => {
      const inp = el('input', { type: 'file', accept: 'application/json,.json', style: 'display:none' });
      inp.addEventListener('change', () => { resolve(inp.files); setTimeout(() => inp.remove(), 100); });
      document.body.appendChild(inp); inp.click();
    });
  }
  function downloadJSON(obj, filename) {
    const blob = new Blob([JSON.stringify(obj)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = el('a', { href: url, download: filename });
    document.body.appendChild(a); a.click();
    setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 200);
  }

  function showView(name) {
    currentView = name;
    document.querySelectorAll('.view').forEach((v) => { v.hidden = v.id !== 'view-' + name; });
    document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('is-active', t.dataset.view === name));
    if (name === 'map') { Diary.map.invalidate(); Diary.map.refresh(); }
    else if (name === 'cal') Diary.calendar.render();
    else if (name === 'list') Diary.entry.renderList();
  }

  function refresh() {
    Diary.map.refresh();
    if (currentView === 'cal') Diary.calendar.render();
    else if (currentView === 'list') Diary.entry.renderList();
  }

  function diffDays(key) {
    const a = ui.parseKey(key); const b = new Date();
    a.setHours(0, 0, 0, 0); b.setHours(0, 0, 0, 0);
    return Math.floor((b - a) / 86400000);
  }

  function applySettings() {
    const s = Diary.store.getSettings();
    document.getElementById('brandTitle').textContent = s.title || '우리의 여행 일기';
    document.title = s.title || '우리의 여행 일기';
    const dd = document.getElementById('dday');
    if (s.firstMet) {
      const days = diffDays(s.firstMet) + 1;
      dd.hidden = false;
      dd.textContent = days >= 1 ? '함께 ' + days.toLocaleString() + '일' : 'D' + days;
    } else { dd.hidden = true; }
  }

  function openSettings() {
    const s = Diary.store.getSettings();
    const titleEl = el('input', { class: 'input', value: s.title, placeholder: '우리의 여행 일기' });
    const metEl = el('input', { class: 'input', type: 'date', value: s.firstMet || '' });

    const exportBtn = el('button', {
      class: 'btn btn--ghost btn--sm', type: 'button', text: '⬇ 내보내기', style: 'flex:1',
      onClick: async () => { ui.toast('백업 만드는 중…', 1500); const data = await Diary.store.exportBackup(); downloadJSON(data, '부산일기-백업-' + ui.todayKey() + '.json'); },
    });
    const importBtn = el('button', {
      class: 'btn btn--ghost btn--sm', type: 'button', text: '⬆ 불러오기', style: 'flex:1',
      onClick: async () => {
        const files = await pickJSON();
        if (!files || !files.length) return;
        try {
          const data = JSON.parse(await files[0].text());
          const ok = await ui.confirmDialog({ title: '백업 불러오기', message: '지금 기록에 백업 내용을 합쳐요. 계속할까요?', okText: '불러오기' });
          if (!ok) return;
          await Diary.store.importBackup(data, 'merge');
          refresh(); applySettings();
          ui.toast('백업을 불러왔어요');
        } catch (e) { ui.toast('불러오기 실패 · 파일을 확인해 주세요'); }
      },
    });

    const prevKakao = (s.kakaoKey || '').trim();
    const kakaoEl = el('input', { class: 'input', value: s.kakaoKey || '', placeholder: '카카오 JavaScript 키 (선택)' });

    const m = ui.openSheet({
      title: '설정',
      body: [
        el('div', { class: 'set-group-title', text: '우리 이야기' }),
        field('제목', titleEl),
        field('처음 만난 날', metEl),
        el('div', { class: 'set-note', text: '처음 만난 날을 넣으면 상단에 함께한 날수가 표시돼요.' }),

        el('div', { class: 'set-group-title', text: '지도 (선택)' }),
        field('카카오 지도 키', kakaoEl),
        el('div', { class: 'set-note', html: '카카오 지도 키가 <b>이미 내장</b>돼 있어서 그대로 두면 돼요. 다른 카카오 키를 쓰고 싶을 때만 여기에 입력하세요.' }),

        el('div', { class: 'set-group-title', text: '백업 · 이동' }),
        el('div', { style: 'display:flex;gap:8px' }, [exportBtn, importBtn]),
        el('div', { class: 'set-note', html: '기록은 이 기기(브라우저)에 저장돼요. 다른 기기로 옮기거나 안전하게 보관하려면 <b>백업 내보내기</b>로 파일을 저장하고, 새 기기에서 <b>불러오기</b> 하세요.' }),

        el('div', { class: 'set-note', style: 'text-align:center;margin-top:26px;color:var(--text-mute)', text: '© youn.so' }),
      ],
      footer: [
        el('button', {
          class: 'btn btn--primary', type: 'button', text: '저장',
          onClick: () => {
            const newKakao = kakaoEl.value.trim();
            Diary.store.setSettings({ title: titleEl.value.trim() || '우리의 여행 일기', firstMet: metEl.value || '', kakaoKey: newKakao });
            applySettings(); m.close();
            if (newKakao !== prevKakao) { ui.toast('지도 설정을 적용하려면 새로고침해요'); setTimeout(() => location.reload(), 800); }
            else ui.toast('설정을 저장했어요');
          },
        }),
      ],
    });
  }

  function init() {
    // 브라우저가 저장공간을 함부로 비우지 않도록 영구 저장 요청 (데이터 보존 강화)
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

    document.getElementById('brandLogo').innerHTML = Diary.mascots.brandLogo();
    applySettings();

    Diary.map.initHome();
    Diary.map.refresh();
    Diary.calendar.render();

    document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => showView(t.dataset.view)));
    document.getElementById('addPlaceFab').addEventListener('click', () => Diary.entry.addPlaceFlow());
    document.getElementById('settingsBtn').addEventListener('click', openSettings);
    document.getElementById('brandBtn').addEventListener('click', () => showView('map'));
    document.getElementById('calPrev').addEventListener('click', () => Diary.calendar.prev());
    document.getElementById('calNext').addEventListener('click', () => Diary.calendar.next());

    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
    }
  }

  Diary.app = { showView, refresh, applySettings, openEntry: (d) => Diary.entry.open(d) };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
