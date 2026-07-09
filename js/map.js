/* =========================================================
   map.js — 지도 디스패처 + 기본(Leaflet) 백엔드
   카카오 키가 설정돼 있으면 카카오맵(map-kakao.js)을 쓰고,
   없거나 실패하면 이 Leaflet 지도로 자동 폴백해요.
   ========================================================= */
(function () {
  const Diary = (window.Diary = window.Diary || {});
  const ui = Diary.ui;
  const BUSAN = [35.1796, 129.0756];

  /* 장소 팝업 DOM (두 백엔드 공용) */
  function buildPopup(place) {
    const wrap = ui.el('div', { class: 'pop' });
    if (place.photo) {
      const img = ui.el('img', { class: 'pop__img', alt: place.name || '', style: 'cursor:zoom-in', onClick: () => ui.lightbox([place.photo], 0) });
      Diary.store.getPhotoURL(place.photo).then((u) => { if (u) img.src = u; });
      wrap.appendChild(img);
    }
    wrap.appendChild(ui.el('div', { class: 'pop__name', text: place.name || '이름 없는 장소' }));
    if (place.address) wrap.appendChild(ui.el('div', { class: 'pop__addr', text: place.address }));
    wrap.appendChild(ui.el('div', { class: 'pop__date', text: '📅 ' + ui.formatKorean(place.date) }));
    wrap.appendChild(ui.el('button', {
      class: 'pop__btn', type: 'button', text: '이 날 일기 보기',
      onClick: () => { if (Diary.app) Diary.app.openEntry(place.date); },
    }));
    return wrap;
  }
  Diary._buildPlacePopup = buildPopup;

  function updateCount(n) {
    const el = document.getElementById('placeCount');
    if (el) el.textContent = n
      ? `우리가 다녀온 곳 ${n}곳`
      : '아직 기록된 곳이 없어요 — 아래 ＋버튼을 눌러보세요';
  }
  Diary._updatePlaceCount = updateCount;

  /* ============ 기본 Leaflet 백엔드 ============ */
  Diary._leafletBackend = function () {
    const TILE = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
    const TILE_OPTS = { subdomains: 'abcd', maxZoom: 19, detectRetina: true, attribution: '&copy; OpenStreetMap &copy; CARTO' };
    let map = null, layer = null, fitted = false;

    function heartIcon() {
      return L.divIcon({ className: 'pin-wrap', html: '<div class="pin">' + Diary.mascots.pinHeart() + '</div>', iconSize: [44, 52], iconAnchor: [22, 50], popupAnchor: [0, -46] });
    }

    function init() {
      return new Promise((resolve) => {
        map = L.map('map', { center: BUSAN, zoom: 12, minZoom: 6, maxZoom: 19 });
        L.tileLayer(TILE, TILE_OPTS).addTo(map);
        layer = L.layerGroup().addTo(map);
        map.zoomControl.setPosition('bottomleft');
        fitInitial();
        setTimeout(() => { map.invalidateSize(); resolve(); }, 60);
      });
    }

    async function fitInitial() {
      if (fitted) return; fitted = true;
      try {
        const places = await Diary.store.getAllPlaces();
        if (places.length && map) map.fitBounds(L.latLngBounds(places.map((p) => [p.lat, p.lng])), { padding: [60, 60], maxZoom: 15 });
      } catch (_) {}
    }

    async function refresh() {
      if (!map) return 0;
      const places = await Diary.store.getAllPlaces();
      layer.clearLayers();
      places.forEach((p) => {
        const mk = L.marker([p.lat, p.lng], { icon: heartIcon() });
        mk.bindPopup(() => buildPopup(p), { closeButton: true, autoPan: true });
        mk.addTo(layer);
      });
      updateCount(places.length);
      return places.length;
    }

    function invalidate() { if (map) setTimeout(() => map.invalidateSize(), 40); }
    function focusPlace(lat, lng) { if (map) map.setView([lat, lng], 15, { animate: true }); }

    function openPicker(opts) {
      opts = opts || {};
      return new Promise((resolve) => {
        let picked = opts.initial ? { lat: opts.initial[0], lng: opts.initial[1] } : null;
        let decided = false, pmap = null, marker = null;

        const mapEl = ui.el('div', { class: 'picker-map', id: 'pickerMap' });
        const hint = ui.el('div', { class: 'picker-hint', text: '지도를 눌러 다녀온 위치를 콕 찍어주세요' });
        const locBtn = ui.el('button', {
          class: 'btn btn--ghost btn--sm', type: 'button', text: '📍 현재 위치',
          onClick: () => {
            if (!navigator.geolocation) return ui.toast('현재 위치를 쓸 수 없어요');
            hint.textContent = '현재 위치를 찾는 중…';
            navigator.geolocation.getCurrentPosition(
              (pos) => { const ll = [pos.coords.latitude, pos.coords.longitude]; setMarker(ll[0], ll[1]); pmap.setView(ll, 15); hint.textContent = '현재 위치로 이동했어요'; },
              () => { hint.textContent = '위치 권한을 확인해 주세요'; }
            );
          },
        });

        const m = ui.openSheet({
          title: '위치 선택',
          body: [ui.el('div', { style: 'display:flex;justify-content:flex-end;margin-bottom:8px' }, [locBtn]), mapEl, hint],
          footer: [
            ui.el('button', { class: 'btn btn--ghost', type: 'button', text: '취소', onClick: () => m.close() }),
            ui.el('button', { class: 'btn btn--primary', type: 'button', text: '이 위치로 선택', onClick: () => { if (!picked) return ui.toast('먼저 지도를 눌러 위치를 찍어주세요'); decided = true; m.close(); resolve(picked); } }),
          ],
          onClose: () => { if (pmap) pmap.remove(); if (!decided) resolve(null); },
        });

        function setMarker(lat, lng) {
          picked = { lat, lng };
          if (!marker) { marker = L.marker([lat, lng], { icon: heartIcon(), draggable: true }).addTo(pmap); marker.on('dragend', () => { const ll = marker.getLatLng(); picked = { lat: ll.lat, lng: ll.lng }; }); }
          else marker.setLatLng([lat, lng]);
          hint.textContent = '위치가 선택됐어요 · 핀을 끌어 미세조정할 수 있어요';
        }

        setTimeout(() => {
          const center = picked ? [picked.lat, picked.lng] : BUSAN;
          pmap = L.map(mapEl, { center, zoom: picked ? 15 : 12, minZoom: 6, maxZoom: 19 });
          L.tileLayer(TILE, TILE_OPTS).addTo(pmap);
          pmap.on('click', (e) => setMarker(e.latlng.lat, e.latlng.lng));
          if (picked) setMarker(picked.lat, picked.lng);
          setTimeout(() => pmap.invalidateSize(), 120);
        }, 260);
      });
    }

    return { init, refresh, invalidate, focusPlace, openPicker };
  };

  /* ============ 디스패처 ============ */
  let active = null, readyResolve;
  const ready = new Promise((r) => { readyResolve = r; });

  async function initHome() {
    const key = (Diary.store.getSettings().kakaoKey || '').trim();
    if (key && Diary._kakaoBackend) {
      const kb = Diary._kakaoBackend(key);
      try { await kb.init(); active = kb; readyResolve(); return; }
      catch (e) { console.warn('카카오 지도 로드 실패 → 기본 지도로 대체', e); ui.toast('카카오 지도를 불러오지 못해 기본 지도로 표시해요'); }
    }
    const lb = Diary._leafletBackend();
    await lb.init(); active = lb; readyResolve();
  }
  async function refresh() { await ready; return active ? active.refresh() : 0; }
  function invalidate() { if (active) active.invalidate(); }
  function focusPlace(a, b) { if (active) active.focusPlace(a, b); }
  async function openPicker(o) { await ready; return active ? active.openPicker(o) : null; }

  Diary.map = { initHome, refresh, invalidate, focusPlace, openPicker, BUSAN };
})();
