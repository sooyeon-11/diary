/* =========================================================
   entry.js — 일기 편집기 · 장소 편집 · 모아보기 렌더
   ========================================================= */
(function () {
  const Diary = (window.Diary = window.Diary || {});
  const ui = Diary.ui;
  const el = ui.el;

  function field(label, control) {
    return el('div', { class: 'field' }, [el('label', { class: 'field__label', text: label }), control]);
  }

  function pickFiles(multiple) {
    return new Promise((resolve) => {
      const inp = el('input', { type: 'file', accept: 'image/*', multiple: !!multiple, style: 'display:none' });
      inp.addEventListener('change', () => { resolve(inp.files); setTimeout(() => inp.remove(), 100); });
      document.body.appendChild(inp);
      inp.click();
    });
  }

  function refsOf(entry) {
    const s = new Set();
    (entry.photos || []).forEach((id) => s.add(id));
    (entry.places || []).forEach((p) => { if (p.photo) s.add(p.photo); });
    return s;
  }

  /* ---------- 장소 편집기 ---------- */
  // openPlaceEditor({ place, withDate, date }) → Promise<{place, date?} | null>
  function openPlaceEditor(opts) {
    opts = opts || {};
    return new Promise((resolve) => {
      const base = opts.place
        ? JSON.parse(JSON.stringify(opts.place))
        : { id: Diary.store.uid(), name: '', address: '', lat: null, lng: null, photo: null };
      let coords = base.lat != null && base.lng != null ? { lat: base.lat, lng: base.lng } : null;
      const originalPhoto = base.photo || null;
      let photoId = base.photo || null;
      const addedHere = new Set();
      let decided = false, saved = false;

      const nameEl = el('input', { class: 'input', placeholder: '예) 해운대 소문난 국밥집', value: base.name });
      const addrEl = el('input', { class: 'input', placeholder: '주소 또는 위치 설명 (선택)', value: base.address });

      const locBtn = el('button', {
        class: 'btn btn--ghost', type: 'button', style: 'height:46px',
        onClick: async () => {
          const r = await Diary.map.openPicker({ initial: coords ? [coords.lat, coords.lng] : null });
          if (r) {
            coords = { lat: r.lat, lng: r.lng };
            if (r.name && !nameEl.value.trim()) nameEl.value = r.name;
            if (r.address && !addrEl.value.trim()) addrEl.value = r.address;
            updateLoc();
          }
        },
      });
      function updateLoc() { locBtn.textContent = coords ? '📍 위치 선택됨 · 다시 고르기' : '🗺️ 지도에서 위치 선택'; }
      updateLoc();

      const photoBox = el('div');
      function renderPhoto() {
        ui.clear(photoBox);
        if (photoId) {
          const img = el('img', { alt: '', style: 'width:100%;height:150px;object-fit:cover;border-radius:12px;border:1px solid var(--line-soft);cursor:zoom-in', onClick: () => Diary.ui.lightbox([photoId], 0) });
          Diary.store.getPhotoURL(photoId).then((u) => { if (u) img.src = u; });
          photoBox.appendChild(img);
          photoBox.appendChild(el('button', {
            class: 'link-btn', type: 'button', text: '사진 삭제',
            onClick: () => { if (addedHere.has(photoId)) { Diary.store.deletePhoto(photoId); addedHere.delete(photoId); } photoId = null; renderPhoto(); },
          }));
        } else {
          photoBox.appendChild(el('button', {
            class: 'photo-add', type: 'button', style: 'aspect-ratio:auto;height:88px;flex-direction:row;gap:8px',
            onClick: async () => {
              const files = await pickFiles(false);
              if (!files || !files.length) return;
              const id = await Diary.store.addPhoto(files[0]);
              addedHere.add(id); photoId = id; renderPhoto();
            },
          }, [el('span', { text: '＋' }), el('span', { text: '장소 사진 추가' })]));
        }
      }
      renderPhoto();

      let dateEl = null;
      const body = [];
      if (opts.withDate) {
        dateEl = el('input', { class: 'input', type: 'date', value: opts.date || ui.todayKey() });
        body.push(field('방문한 날', dateEl));
      }
      body.push(field('장소 이름', nameEl), field('주소 · 설명', addrEl), field('위치', locBtn), field('사진', photoBox));

      const m = ui.openSheet({
        title: opts.place ? '장소 수정' : '다녀온 곳 추가',
        body,
        footer: [
          el('button', { class: 'btn btn--ghost', type: 'button', text: '취소', onClick: () => m.close() }),
          el('button', {
            class: 'btn btn--primary', type: 'button', text: '저장',
            onClick: () => {
              if (!coords) return ui.toast('지도에서 위치를 선택해 주세요');
              const place = { id: base.id, name: nameEl.value.trim(), address: addrEl.value.trim(), lat: coords.lat, lng: coords.lng, photo: photoId };
              decided = true; saved = true; m.close();
              resolve(opts.withDate ? { place, date: dateEl.value || ui.todayKey() } : { place });
            },
          }),
        ],
        onClose: () => {
          if (!saved) {
            addedHere.forEach((id) => { if (id !== originalPhoto) Diary.store.deletePhoto(id); });
            if (!decided) resolve(null);
          }
        },
      });
    });
  }

  /* ---------- 일기 편집기 ---------- */
  async function open(date) {
    const existing = await Diary.store.getEntry(date);
    const draft = existing ? JSON.parse(JSON.stringify(existing)) : { date, note: '', photos: [], places: [] };
    const originalRefs = refsOf(existing || {});
    const addedIds = new Set();
    let saved = false;

    const noteEl = el('textarea', { class: 'textarea', placeholder: '그날의 이야기를 적어보세요…', value: draft.note });
    const photoGrid = el('div', { class: 'photo-grid' });
    const placeWrap = el('div', { class: 'dp-places' });

    function renderPhotos() {
      ui.clear(photoGrid);
      draft.photos.forEach((id, idx) => {
        const cell = el('div', { class: 'photo-cell' });
        const img = el('img', { alt: '', style: 'cursor:zoom-in', onClick: () => Diary.ui.lightbox(draft.photos, idx) });
        Diary.store.getPhotoURL(id).then((u) => { if (u) img.src = u; });
        cell.appendChild(img);
        cell.appendChild(el('button', {
          class: 'photo-cell__del', type: 'button', text: '×',
          onClick: () => { draft.photos = draft.photos.filter((x) => x !== id); renderPhotos(); },
        }));
        photoGrid.appendChild(cell);
      });
      photoGrid.appendChild(el('button', {
        class: 'photo-add', type: 'button',
        onClick: async () => {
          const files = await pickFiles(true);
          if (!files || !files.length) return;
          ui.toast('사진 저장 중…', 1200);
          for (const f of files) { const id = await Diary.store.addPhoto(f); addedIds.add(id); draft.photos.push(id); }
          renderPhotos();
        },
      }, [el('span', { text: '＋' }), el('span', { text: '사진' })]));
    }

    function renderPlaces() {
      ui.clear(placeWrap);
      if (!draft.places.length) {
        placeWrap.appendChild(el('div', { class: 'set-note', text: '아직 추가한 장소가 없어요. 다녀온 식당·카페·명소를 담아보세요.' }));
      }
      draft.places.forEach((p, idx) => {
        const img = p.photo
          ? el('img', { class: 'place-card__img', alt: '' })
          : el('div', { class: 'place-card__img place-card__img--ph', html: Diary.mascots.heart(30) });
        if (p.photo) Diary.store.getPhotoURL(p.photo).then((u) => { if (u) img.src = u; });
        placeWrap.appendChild(el('div', { class: 'place-card' }, [
          img,
          el('div', {
            class: 'place-card__txt', style: 'cursor:pointer',
            onClick: async () => { const r = await openPlaceEditor({ place: p }); if (r && r.place) { if (r.place.photo && !originalRefs.has(r.place.photo)) addedIds.add(r.place.photo); draft.places[idx] = r.place; renderPlaces(); } },
          }, [
            el('div', { class: 'place-card__name', text: p.name || '이름 없는 장소' }),
            p.address ? el('div', { class: 'place-card__addr', text: p.address }) : null,
          ]),
          el('button', { class: 'place-card__del', type: 'button', html: '×', onClick: () => { draft.places.splice(idx, 1); renderPlaces(); } }),
        ]));
      });
    }

    renderPhotos();
    renderPlaces();

    const addPlaceBtn = el('button', {
      class: 'link-btn', type: 'button', text: '＋ 장소 추가',
      onClick: async () => {
        const r = await openPlaceEditor({});
        if (r && r.place) { if (r.place.photo && !originalRefs.has(r.place.photo)) addedIds.add(r.place.photo); draft.places.push(r.place); renderPlaces(); }
      },
    });

    const footer = [];
    if (existing) {
      footer.push(el('button', {
        class: 'btn btn--danger btn--sm', type: 'button', text: '삭제',
        onClick: async () => {
          const ok = await ui.confirmDialog({ title: '일기 삭제', message: '이 날의 기록과 사진이 모두 지워져요. 삭제할까요?', okText: '삭제', danger: true });
          if (!ok) return;
          await Diary.store.deleteEntry(date);
          saved = true; m.close();
          if (Diary.app) Diary.app.refresh();
          ui.toast('기록을 삭제했어요');
        },
      }));
    }
    footer.push(el('button', {
      class: 'btn btn--primary', type: 'button', text: '저장',
      onClick: async () => {
        draft.note = noteEl.value;
        await Diary.store.saveOrRemove(draft);
        // 참조 안 되는 사진 정리
        const finalRefs = refsOf(draft);
        const union = new Set([...originalRefs, ...addedIds]);
        for (const id of union) if (!finalRefs.has(id)) await Diary.store.deletePhoto(id);
        saved = true; m.close();
        if (Diary.app) Diary.app.refresh();
        ui.toast('기록을 저장했어요 💗');
      },
    }));

    const m = ui.openSheet({
      title: ui.formatKorean(date),
      body: [
        field('그날의 기록', noteEl),
        el('div', { class: 'field' }, [el('label', { class: 'field__label', text: '사진' }), photoGrid]),
        el('div', { class: 'field' }, [
          el('div', { class: 'section-label' }, ['다녀온 곳', addPlaceBtn]),
          placeWrap,
        ]),
      ],
      footer,
      onClose: () => {
        if (!saved) { addedIds.forEach((id) => { if (!originalRefs.has(id)) Diary.store.deletePhoto(id); }); }
      },
    });
  }

  /* ---------- 지도 FAB: 빠른 장소 추가 ---------- */
  async function addPlaceFlow() {
    const r = await openPlaceEditor({ withDate: true, date: ui.todayKey() });
    if (!r || !r.place) return;
    const date = r.date;
    const existing = await Diary.store.getEntry(date);
    const entry = existing || { date, note: '', photos: [], places: [] };
    entry.places = entry.places || [];
    entry.places.push(r.place);
    await Diary.store.saveOrRemove(entry);
    if (Diary.app) Diary.app.refresh();
    Diary.map.focusPlace(r.place.lat, r.place.lng);
    ui.toast('다녀온 곳을 기록했어요 💗');
  }

  /* ---------- 모아보기 ---------- */
  function entryCard(e) {
    const entryPhotos = [];
    (e.photos || []).forEach((id) => entryPhotos.push(id));
    (e.places || []).forEach((p) => { if (p.photo) entryPhotos.push(p.photo); });
    const coverId = entryPhotos[0] || null;
    const cover = coverId
      ? el('img', {
          class: 'entry-card__cover', alt: '', style: 'cursor:zoom-in',
          onClick: (ev) => { ev.stopPropagation(); Diary.ui.lightbox(entryPhotos, 0); },
        })
      : el('div', { class: 'entry-card__cover', style: 'display:flex;align-items:center;justify-content:center', html: Diary.mascots.cloud(64) });
    if (coverId) Diary.store.getPhotoURL(coverId).then((u) => { if (u) cover.src = u; });

    const meta = el('div', { class: 'entry-card__meta' });
    if ((e.photos || []).length) meta.appendChild(el('span', { text: '📷 ' + e.photos.length + '장' }));
    if ((e.places || []).length) meta.appendChild(el('span', { text: '📍 ' + e.places.length + '곳' }));

    return el('div', { class: 'entry-card', onClick: () => open(e.date) }, [
      cover,
      el('div', { class: 'entry-card__body' }, [
        el('div', { class: 'entry-card__date', text: ui.formatKorean(e.date) }),
        e.note ? el('div', { class: 'entry-card__note', text: e.note }) : null,
        meta,
      ]),
    ]);
  }

  async function renderList() {
    const box = document.getElementById('entryList');
    if (!box) return;
    const entries = await Diary.store.getAllEntries();
    ui.clear(box);
    if (!entries.length) {
      box.appendChild(el('div', { class: 'empty' }, [
        el('div', { class: 'empty__art', html: Diary.mascots.heart(84) }),
        el('div', { class: 'empty__title', text: '아직 기록이 없어요' }),
        el('div', { class: 'empty__desc', html: '지도의 <b>＋다녀온 곳</b> 버튼이나<br>달력에서 첫 추억을 남겨보세요' }),
      ]));
      return;
    }
    entries.forEach((e) => box.appendChild(entryCard(e)));
  }

  Diary.entry = { open, addPlaceFlow, renderList, openPlaceEditor };
})();
