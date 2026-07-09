/* =========================================================
   map-kakao.js — 카카오맵 백엔드 (선택)
   설정에 카카오 JavaScript 키가 있으면 이 백엔드가 쓰여요.
   가게·장소 이름 검색 지원.
   ========================================================= */
(function () {
  const Diary = (window.Diary = window.Diary || {});
  const ui = Diary.ui;
  const BUSAN = { lat: 35.1796, lng: 129.0756 };

  function loadSDK(key) {
    return new Promise((resolve, reject) => {
      if (window.kakao && window.kakao.maps && window.kakao.maps.Map) return resolve(window.kakao);
      let s = document.getElementById('kakao-sdk');
      const onReady = () => {
        try { window.kakao.maps.load(() => resolve(window.kakao)); }
        catch (e) { reject(e); }
      };
      if (!s) {
        s = document.createElement('script');
        s.id = 'kakao-sdk';
        s.async = true;
        s.src = 'https://dapi.kakao.com/v2/maps/sdk.js?appkey=' + encodeURIComponent(key) + '&libraries=services&autoload=false';
        s.addEventListener('load', onReady);
        s.addEventListener('error', () => reject(new Error('카카오 SDK를 불러오지 못했어요')));
        document.head.appendChild(s);
      } else {
        s.addEventListener('load', onReady);
      }
      setTimeout(() => { if (!(window.kakao && window.kakao.maps && window.kakao.maps.Map)) reject(new Error('카카오 SDK 응답 없음')); }, 9000);
    });
  }

  Diary._kakaoBackend = function (key) {
    let kakao = null, map = null, overlays = [], openPopup = null, fitted = false;

    async function init() {
      kakao = await loadSDK(key);
      const container = document.getElementById('map');
      map = new kakao.maps.Map(container, { center: new kakao.maps.LatLng(BUSAN.lat, BUSAN.lng), level: 8 });
      map.addControl(new kakao.maps.ZoomControl(), kakao.maps.ControlPosition.LEFT);
      kakao.maps.event.addListener(map, 'click', closePopup);
      await fitInitial();
      setTimeout(() => map.relayout(), 60);
    }

    async function fitInitial() {
      if (fitted) return; fitted = true;
      try {
        const places = await Diary.store.getAllPlaces();
        if (places.length) {
          const b = new kakao.maps.LatLngBounds();
          places.forEach((p) => b.extend(new kakao.maps.LatLng(p.lat, p.lng)));
          map.setBounds(b);
        }
      } catch (_) {}
    }

    function closePopup() { if (openPopup) { openPopup.setMap(null); openPopup = null; } }

    function markerEl(place) {
      const div = ui.el('div', { class: 'pin', style: 'cursor:pointer', html: Diary.mascots.pinHeart() });
      div.addEventListener('click', (e) => { e.stopPropagation(); showPopup(place); });
      return div;
    }

    function showPopup(place) {
      closePopup();
      const box = ui.el('div', { class: 'kpop' }, [
        ui.el('button', { class: 'kpop__close', type: 'button', html: '×', onClick: closePopup }),
        Diary._buildPlacePopup(place),
      ]);
      openPopup = new kakao.maps.CustomOverlay({ position: new kakao.maps.LatLng(place.lat, place.lng), content: box, yAnchor: 1.32, xAnchor: 0.5, zIndex: 5 });
      openPopup.setMap(map);
    }

    async function refresh() {
      if (!map) return 0;
      overlays.forEach((o) => o.setMap(null)); overlays = [];
      closePopup();
      const places = await Diary.store.getAllPlaces();
      places.forEach((p) => {
        const ov = new kakao.maps.CustomOverlay({ position: new kakao.maps.LatLng(p.lat, p.lng), content: markerEl(p), yAnchor: 1, xAnchor: 0.5, clickable: true });
        ov.setMap(map); overlays.push(ov);
      });
      Diary._updatePlaceCount(places.length);
      return places.length;
    }

    function invalidate() { if (map) setTimeout(() => map.relayout(), 40); }
    function focusPlace(lat, lng) { if (map) { map.setLevel(3); map.setCenter(new kakao.maps.LatLng(lat, lng)); } }

    /* 위치 선택기 (가게 이름 검색 + 지도 클릭) */
    function openPicker(opts) {
      opts = opts || {};
      return new Promise((resolve) => {
        let picked = opts.initial ? { lat: opts.initial[0], lng: opts.initial[1] } : null;
        let decided = false, pmap = null, pmarker = null;

        const searchInput = ui.el('input', { class: 'input', placeholder: '가게·장소 이름으로 검색 (예: 해운대 국밥)' });
        const results = ui.el('div', { class: 'ksearch__results' });
        const mapEl = ui.el('div', { class: 'picker-map', id: 'kpickerMap' });
        const hint = ui.el('div', { class: 'picker-hint', text: '검색하거나 지도를 눌러 위치를 정해요' });

        function setMarker(lat, lng) {
          picked = Object.assign(picked || {}, { lat, lng });
          const pos = new kakao.maps.LatLng(lat, lng);
          if (!pmarker) {
            pmarker = new kakao.maps.Marker({ position: pos, draggable: true });
            pmarker.setMap(pmap);
            kakao.maps.event.addListener(pmarker, 'dragend', () => { const ll = pmarker.getPosition(); picked.lat = ll.getLat(); picked.lng = ll.getLng(); });
          } else pmarker.setPosition(pos);
        }

        function doSearch() {
          const q = searchInput.value.trim(); if (!q) return;
          if (!(kakao.maps.services && kakao.maps.services.Places)) { ui.toast('검색 기능을 쓸 수 없어요'); return; }
          const ps = new kakao.maps.services.Places();
          ps.keywordSearch(q, (data, status) => {
            ui.clear(results);
            if (status !== kakao.maps.services.Status.OK || !data.length) { results.appendChild(ui.el('div', { class: 'picker-hint', style: 'text-align:left', text: '검색 결과가 없어요' })); return; }
            data.slice(0, 8).forEach((d) => {
              results.appendChild(ui.el('div', {
                class: 'ksearch__row',
                onClick: () => {
                  const lat = parseFloat(d.y), lng = parseFloat(d.x);
                  picked = { lat, lng, name: d.place_name, address: d.road_address_name || d.address_name || '' };
                  pmap.setLevel(3); pmap.setCenter(new kakao.maps.LatLng(lat, lng)); setMarker(lat, lng);
                  hint.textContent = '“' + d.place_name + '” 선택됨 · 핀을 끌어 조정 가능';
                },
              }, [
                ui.el('div', { class: 'ksearch__name', text: d.place_name }),
                ui.el('div', { class: 'ksearch__addr', text: d.road_address_name || d.address_name || '' }),
              ]));
            });
          });
        }

        const searchBtn = ui.el('button', { class: 'btn btn--ghost btn--sm', type: 'button', text: '검색', onClick: doSearch });
        searchInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); doSearch(); } });

        const m = ui.openSheet({
          title: '위치 선택',
          body: [ui.el('div', { style: 'display:flex;gap:8px;margin-bottom:8px' }, [searchInput, searchBtn]), results, mapEl, hint],
          footer: [
            ui.el('button', { class: 'btn btn--ghost', type: 'button', text: '취소', onClick: () => m.close() }),
            ui.el('button', { class: 'btn btn--primary', type: 'button', text: '이 위치로 선택', onClick: () => { if (!picked || picked.lat == null) return ui.toast('먼저 위치를 정해주세요'); decided = true; m.close(); resolve(picked); } }),
          ],
          onClose: () => { if (!decided) resolve(null); },
        });

        setTimeout(() => {
          const center = picked ? new kakao.maps.LatLng(picked.lat, picked.lng) : new kakao.maps.LatLng(BUSAN.lat, BUSAN.lng);
          pmap = new kakao.maps.Map(mapEl, { center, level: picked ? 3 : 8 });
          kakao.maps.event.addListener(pmap, 'click', (e) => { const ll = e.latLng; setMarker(ll.getLat(), ll.getLng()); hint.textContent = '위치 선택됨 · 핀을 끌어 조정 가능'; });
          if (picked) setMarker(picked.lat, picked.lng);
          setTimeout(() => pmap.relayout(), 120);
        }, 260);
      });
    }

    return { init, refresh, invalidate, focusPlace, openPicker };
  };
})();
