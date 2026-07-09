/* =========================================================
   ui.js — 공용 UI 헬퍼 (요소 생성 · 모달 · 토스트 · 포맷)
   ========================================================= */
(function () {
  const Diary = (window.Diary = window.Diary || {});

  /* DOM 요소 생성 헬퍼: el('div', {class:'x'}, [자식…]) */
  function el(tag, props, children) {
    const node = document.createElement(tag);
    if (props) {
      for (const key in props) {
        const val = props[key];
        if (val == null || val === false) continue;
        if (key === 'class') node.className = val;
        else if (key === 'html') node.innerHTML = val;
        else if (key === 'text') node.textContent = val;
        else if (key === 'dataset') Object.assign(node.dataset, val);
        else if (key.startsWith('on') && typeof val === 'function') {
          node.addEventListener(key.slice(2).toLowerCase(), val);
        } else if (key in node && key !== 'list') {
          try { node[key] = val; } catch (_) { node.setAttribute(key, val); }
        } else {
          node.setAttribute(key, val);
        }
      }
    }
    appendChildren(node, children);
    return node;
  }

  function appendChildren(node, children) {
    if (children == null) return;
    if (Array.isArray(children)) {
      children.forEach((c) => appendChildren(node, c));
    } else if (children instanceof Node) {
      node.appendChild(children);
    } else {
      node.appendChild(document.createTextNode(String(children)));
    }
  }

  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

  /* ---------- 모달(바텀시트) ---------- */
  /* open({ title, body, footer, onClose }) → { close } */
  function openSheet(opts) {
    const root = document.getElementById('modalRoot');
    const scrim = el('div', { class: 'modal-scrim' });

    const head = el('div', { class: 'sheet__head' }, [
      el('div', { class: 'sheet__grip' }),
      el('h2', { class: 'sheet__title', text: opts.title || '' }),
      el('button', {
        class: 'iconbtn', type: 'button', 'aria-label': '닫기',
        html: '<svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M6.4 5 5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12 19 6.4 17.6 5 12 10.6z"/></svg>',
        onClick: () => close(),
      }),
    ]);

    const body = el('div', { class: 'sheet__body' });
    if (opts.body) appendChildren(body, opts.body);

    const sheetChildren = [head, body];
    if (opts.footer) {
      sheetChildren.push(el('div', { class: 'sheet__foot' }, opts.footer));
    }
    const sheet = el('div', { class: 'sheet' }, sheetChildren);

    scrim.appendChild(sheet);
    scrim.addEventListener('mousedown', (e) => { if (e.target === scrim) close(); });
    root.appendChild(scrim);
    document.body.style.overflow = 'hidden';

    // 애니메이션 트리거
    requestAnimationFrame(() => scrim.classList.add('is-open'));

    let closed = false;
    function close(result) {
      if (closed) return;
      closed = true;
      scrim.classList.remove('is-open');
      setTimeout(() => {
        scrim.remove();
        if (!document.querySelector('.modal-scrim')) document.body.style.overflow = '';
        if (opts.onClose) opts.onClose(result);
      }, 220);
    }

    return { close, scrim, sheet, body };
  }

  /* ---------- 확인 대화 ---------- */
  function confirmDialog({ title, message, okText = '확인', danger = false }) {
    return new Promise((resolve) => {
      let decided = false;
      const m = openSheet({
        title: title || '확인',
        body: [el('p', { class: 'set-note', style: 'font-size:14px;color:var(--text)', text: message || '' })],
        footer: [
          el('button', { class: 'btn btn--ghost', type: 'button', text: '취소', onClick: () => { decided = true; m.close(); resolve(false); } }),
          el('button', { class: 'btn ' + (danger ? 'btn--danger' : 'btn--primary'), type: 'button', text: okText, onClick: () => { decided = true; m.close(); resolve(true); } }),
        ],
        onClose: () => { if (!decided) resolve(false); },
      });
    });
  }

  /* ---------- 토스트 ---------- */
  function toast(message, ms = 2000) {
    const root = document.getElementById('toastRoot');
    const t = el('div', { class: 'toast', text: message });
    root.appendChild(t);
    requestAnimationFrame(() => t.classList.add('is-show'));
    setTimeout(() => {
      t.classList.remove('is-show');
      setTimeout(() => t.remove(), 250);
    }, ms);
  }

  /* ---------- 날짜 포맷 ---------- */
  const WD = ['일', '월', '화', '수', '목', '금', '토'];

  function todayKey() { return toKey(new Date()); }

  function toKey(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function parseKey(key) {
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  function formatKorean(key) {
    const d = parseKey(key);
    return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${WD[d.getDay()]})`;
  }

  function formatShort(key) {
    const d = parseKey(key);
    return `${d.getMonth() + 1}.${d.getDate()} (${WD[d.getDay()]})`;
  }

  /* ---------- 사진 확대 뷰어(라이트박스) ---------- */
  function lightbox(photoIds, startIndex) {
    photoIds = (photoIds || []).filter(Boolean);
    if (!photoIds.length) return;
    let idx = Math.max(0, Math.min(startIndex || 0, photoIds.length - 1));
    const multi = photoIds.length > 1;

    const img = el('img', { class: 'lightbox__img', alt: '' });
    const counter = el('div', { class: 'lightbox__counter' });
    const btnClose = el('button', { class: 'lightbox__close', type: 'button', html: '×', onClick: close });
    const btnPrev = el('button', { class: 'lightbox__nav lightbox__prev', type: 'button', html: '‹', onClick: (e) => { e.stopPropagation(); go(-1); } });
    const btnNext = el('button', { class: 'lightbox__nav lightbox__next', type: 'button', html: '›', onClick: (e) => { e.stopPropagation(); go(1); } });

    const overlay = el('div', { class: 'lightbox' }, [btnClose, multi ? btnPrev : null, img, multi ? btnNext : null, multi ? counter : null]);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

    let sx = 0;
    overlay.addEventListener('touchstart', (e) => { sx = e.touches[0].clientX; }, { passive: true });
    overlay.addEventListener('touchend', (e) => { const dx = e.changedTouches[0].clientX - sx; if (multi && Math.abs(dx) > 50) go(dx < 0 ? 1 : -1); });

    async function show() {
      const url = await Diary.store.getPhotoURL(photoIds[idx]);
      if (url) img.src = url;
      counter.textContent = (idx + 1) + ' / ' + photoIds.length;
    }
    function go(d) { idx = (idx + d + photoIds.length) % photoIds.length; show(); }
    function onKey(e) { if (e.key === 'Escape') close(); else if (e.key === 'ArrowLeft') go(-1); else if (e.key === 'ArrowRight') go(1); }
    function close() {
      document.removeEventListener('keydown', onKey);
      overlay.classList.remove('is-open');
      setTimeout(() => overlay.remove(), 200);
    }

    document.getElementById('modalRoot').appendChild(overlay);
    document.addEventListener('keydown', onKey);
    requestAnimationFrame(() => overlay.classList.add('is-open'));
    show();
  }

  Diary.ui = {
    el, clear, appendChildren, openSheet, confirmDialog, toast, lightbox,
    todayKey, toKey, parseKey, formatKorean, formatShort, WD,
  };
})();
