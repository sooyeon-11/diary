/* =========================================================
   store.js — 데이터 저장소
   entries: 날짜별 일기 (IndexedDB)   photos: 사진 blob (IndexedDB)
   settings: 앱 설정 (localStorage)
   ========================================================= */
(function () {
  const Diary = (window.Diary = window.Diary || {});
  const DB_NAME = 'busan-diary';
  const DB_VERSION = 1;
  let dbPromise = null;

  function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('entries')) db.createObjectStore('entries', { keyPath: 'date' });
        if (!db.objectStoreNames.contains('photos')) db.createObjectStore('photos', { keyPath: 'id' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }

  function tx(storeName, mode) {
    return openDB().then((db) => db.transaction(storeName, mode).objectStore(storeName));
  }
  function reqToPromise(req) {
    return new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); });
  }

  /* ---------- 사진 ---------- */
  function uid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  }

  // 원본 이미지를 리사이즈+압축하여 blob 생성
  async function compressImage(file, maxSize = 1600, quality = 0.82) {
    try {
      let bitmap;
      try { bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
      catch (_) { bitmap = await createImageBitmap(file); }
      let w = bitmap.width, h = bitmap.height;
      const scale = Math.min(1, maxSize / Math.max(w, h));
      w = Math.round(w * scale); h = Math.round(h * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(bitmap, 0, 0, w, h);
      bitmap.close && bitmap.close();
      const blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', quality));
      return blob || file;
    } catch (e) {
      console.warn('이미지 압축 실패, 원본 저장', e);
      return file;
    }
  }

  // 파일 → 사진 저장 → id 반환
  async function addPhoto(file) {
    const blob = await compressImage(file);
    const id = uid();
    const store = await tx('photos', 'readwrite');
    await reqToPromise(store.put({ id, blob }));
    return id;
  }

  async function getPhotoBlob(id) {
    if (!id) return null;
    const store = await tx('photos', 'readonly');
    const rec = await reqToPromise(store.get(id));
    return rec ? rec.blob : null;
  }

  // 캐시된 objectURL 관리
  const urlCache = new Map();
  async function getPhotoURL(id) {
    if (!id) return null;
    if (urlCache.has(id)) return urlCache.get(id);
    const blob = await getPhotoBlob(id);
    if (!blob) return null;
    const url = URL.createObjectURL(blob);
    urlCache.set(id, url);
    return url;
  }

  async function deletePhoto(id) {
    if (!id) return;
    if (urlCache.has(id)) { URL.revokeObjectURL(urlCache.get(id)); urlCache.delete(id); }
    const store = await tx('photos', 'readwrite');
    await reqToPromise(store.delete(id));
  }

  /* ---------- 일기 ---------- */
  async function getEntry(date) {
    const store = await tx('entries', 'readonly');
    return (await reqToPromise(store.get(date))) || null;
  }

  async function getAllEntries() {
    const store = await tx('entries', 'readonly');
    const all = await reqToPromise(store.getAll());
    all.sort((a, b) => (a.date < b.date ? 1 : -1)); // 최신순
    return all;
  }

  function normalizeEntry(e) {
    return {
      date: e.date,
      note: e.note || '',
      photos: Array.isArray(e.photos) ? e.photos : [],
      places: Array.isArray(e.places) ? e.places : [],
      updatedAt: Date.now(),
    };
  }

  async function putEntry(entry) {
    const e = normalizeEntry(entry);
    const store = await tx('entries', 'readwrite');
    await reqToPromise(store.put(e));
    return e;
  }

  // 빈 일기면 자동 삭제
  async function saveOrRemove(entry) {
    const e = normalizeEntry(entry);
    if (!e.note.trim() && e.photos.length === 0 && e.places.length === 0) {
      await deleteEntry(e.date, true);
      return null;
    }
    return putEntry(e);
  }

  async function deleteEntry(date, keepPhotosCleaned) {
    const existing = await getEntry(date);
    if (existing) {
      // 연결된 사진들 정리
      const ids = [];
      (existing.photos || []).forEach((id) => ids.push(id));
      (existing.places || []).forEach((p) => { if (p.photo) ids.push(p.photo); });
      for (const id of ids) await deletePhoto(id);
    }
    const store = await tx('entries', 'readwrite');
    await reqToPromise(store.delete(date));
  }

  // 모든 장소를 평평하게 (지도용): { ...place, date }
  async function getAllPlaces() {
    const entries = await getAllEntries();
    const out = [];
    entries.forEach((e) => {
      (e.places || []).forEach((p) => {
        if (typeof p.lat === 'number' && typeof p.lng === 'number') out.push(Object.assign({ date: e.date }, p));
      });
    });
    return out;
  }

  /* ---------- 설정 (localStorage) ---------- */
  // 카카오 JavaScript 키(공개용 — 도메인 등록으로 보호됨). 여기에 내장해두면 모든 기기에서 자동 적용.
  const DEFAULT_KAKAO_KEY = 'a8b3eea0260d2ee45270ce0e2522e174';
  const SKEY = 'busan-diary.settings';
  function getSettings() {
    const defaults = { title: '우리의 여행 일기', firstMet: '', calendarMode: 'icon', kakaoKey: DEFAULT_KAKAO_KEY };
    try { return Object.assign(defaults, JSON.parse(localStorage.getItem(SKEY) || '{}')); }
    catch (_) { return defaults; }
  }
  function setSettings(patch) {
    const s = Object.assign(getSettings(), patch);
    localStorage.setItem(SKEY, JSON.stringify(s));
    return s;
  }

  /* ---------- 백업 내보내기 / 불러오기 ---------- */
  function blobToDataURL(blob) {
    return new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(blob); });
  }
  async function dataURLToBlob(dataURL) { return (await fetch(dataURL)).blob(); }

  async function exportBackup() {
    const entries = await getAllEntries();
    const photoIds = new Set();
    entries.forEach((e) => {
      (e.photos || []).forEach((id) => photoIds.add(id));
      (e.places || []).forEach((p) => { if (p.photo) photoIds.add(p.photo); });
    });
    const photos = {};
    for (const id of photoIds) {
      const blob = await getPhotoBlob(id);
      if (blob) photos[id] = await blobToDataURL(blob);
    }
    return {
      app: 'busan-diary',
      version: 1,
      exportedAt: new Date().toISOString(),
      settings: getSettings(),
      entries,
      photos,
    };
  }

  async function importBackup(data, mode = 'merge') {
    if (!data || data.app !== 'busan-diary') throw new Error('올바른 백업 파일이 아니에요.');
    if (mode === 'replace') {
      const s1 = await tx('entries', 'readwrite'); await reqToPromise(s1.clear());
      const s2 = await tx('photos', 'readwrite'); await reqToPromise(s2.clear());
      urlCache.forEach((u) => URL.revokeObjectURL(u)); urlCache.clear();
    }
    // 사진 복원
    if (data.photos) {
      const store = await tx('photos', 'readwrite');
      for (const id in data.photos) {
        const blob = await dataURLToBlob(data.photos[id]);
        await reqToPromise(store.put({ id, blob }));
      }
    }
    // 일기 복원
    if (Array.isArray(data.entries)) {
      for (const e of data.entries) await putEntry(e);
    }
    if (data.settings) setSettings(data.settings);
    return true;
  }

  async function estimateUsage() {
    if (navigator.storage && navigator.storage.estimate) {
      try { const { usage } = await navigator.storage.estimate(); return usage || 0; } catch (_) {}
    }
    return null;
  }

  Diary.store = {
    uid, addPhoto, getPhotoBlob, getPhotoURL, deletePhoto,
    getEntry, getAllEntries, putEntry, saveOrRemove, deleteEntry, getAllPlaces,
    getSettings, setSettings, DEFAULT_KAKAO_KEY,
    exportBackup, importBackup, estimateUsage,
  };
})();
