/* =========================================================
   calendar.js — 달력 뷰 (만난 날 표시 · 날짜 클릭 시 편집기 열기)
   ========================================================= */
(function () {
  const Diary = (window.Diary = window.Diary || {});
  const ui = Diary.ui;
  const el = ui.el;

  const now = new Date();
  let viewYear = now.getFullYear();
  let viewMonth = now.getMonth(); // 0-based
  let selected = ui.todayKey();
  let byDate = {}; // date -> entry (현재 월 렌더 시 채움)

  function titleText() { return `${viewYear}년 ${viewMonth + 1}월`; }

  // 그날의 모든 사진 id (일기 사진 + 장소 사진)
  function collectDayPhotos(entry) {
    const ids = [];
    (entry.photos || []).forEach((id) => ids.push(id));
    (entry.places || []).forEach((p) => { if (p.photo) ids.push(p.photo); });
    return ids;
  }

  async function render() {
    const grid = document.getElementById('calGrid');
    const titleEl = document.getElementById('calTitle');
    if (!grid) return;
    titleEl.textContent = titleText();

    const entries = await Diary.store.getAllEntries();
    byDate = {};
    entries.forEach((e) => { byDate[e.date] = e; });

    ui.clear(grid);
    const first = new Date(viewYear, viewMonth, 1);
    const startWd = first.getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const todayKey = ui.todayKey();
    const mode = Diary.store.getSettings().calendarMode || 'icon';

    for (let i = 0; i < startWd; i++) grid.appendChild(el('div', { class: 'day day--empty' }));

    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(viewYear, viewMonth, d);
      const key = ui.toKey(date);
      const wd = date.getDay();
      const entry = byDate[key];

      const classes = ['day'];
      if (wd === 0) classes.push('day--sun');
      if (wd === 6) classes.push('day--sat');
      if (key === todayKey) classes.push('day--today');
      if (entry) classes.push('day--has');

      const cell = el('button', { class: classes.join(' '), type: 'button', onClick: () => select(key) }, [
        el('span', { class: 'day__num', text: String(d) }),
      ]);

      if (entry) {
        const dayPhotos = collectDayPhotos(entry);
        if (mode === 'photo' && dayPhotos.length) {
          cell.classList.add('day--photo');
          Diary.store.getPhotoURL(dayPhotos[0]).then((u) => {
            if (u) cell.style.backgroundImage =
              'linear-gradient(to top, rgba(20,8,14,.5), rgba(20,8,14,0) 60%), url("' + u + '")';
          });
          if (dayPhotos.length > 1) cell.appendChild(el('span', { class: 'day__count', text: '+' + (dayPhotos.length - 1) }));
        } else {
          const mark = el('div', { class: 'day__mark' });
          if ((entry.places || []).length > 0) mark.innerHTML = Diary.mascots.heart(15);
          else mark.appendChild(el('span', { class: 'day__dot' }));
          cell.appendChild(mark);
        }
      }
      grid.appendChild(cell);
    }

  }

  function select(key) {
    selected = key;
    Diary.entry.open(key); // 날짜를 누르면 그날 기록(사진 업로드·글·장소) 편집기가 바로 열려요
  }

  function prev() {
    viewMonth--; if (viewMonth < 0) { viewMonth = 11; viewYear--; }
    render();
  }
  function next() {
    viewMonth++; if (viewMonth > 11) { viewMonth = 0; viewYear++; }
    render();
  }
  function goToDate(key) {
    const d = ui.parseKey(key);
    viewYear = d.getFullYear(); viewMonth = d.getMonth(); selected = key;
    render();
  }

  Diary.calendar = { render, prev, next, goToDate, select };
})();
