/* =========================================================
   mascots.js — 구름 · 하트 마스코트 SVG (보내주신 스티커 재현)
   로고 / 파비콘 / 지도 핀에 재사용
   ========================================================= */
(function () {
  const Diary = (window.Diary = window.Diary || {});

  const COLOR = {
    cloud: '#bfe2f0', cloudLine: '#8cc2d8', cloudFace: '#405d6b',
    heart: '#c6b4ec', heartLine: '#9f86d8', heartFace: '#4a3e6b',
    pink: '#ff8da1', pinkLine: '#ee547c', pinkFace: '#7c2f49',
    blush: 'rgba(255,138,160,.5)',
  };

  /* 구름 실루엣(원들의 합) — 테두리는 살짝 키운 복제로 표현 */
  function cloudShapes(fill) {
    return (
      `<ellipse cx="60" cy="66" rx="42" ry="18" fill="${fill}"/>` +
      `<circle cx="36" cy="58" r="20" fill="${fill}"/>` +
      `<circle cx="84" cy="58" r="20" fill="${fill}"/>` +
      `<circle cx="50" cy="42" r="18" fill="${fill}"/>` +
      `<circle cx="72" cy="40" r="19" fill="${fill}"/>` +
      `<circle cx="60" cy="52" r="24" fill="${fill}"/>`
    );
  }

  function cloudFace() {
    return (
      `<ellipse cx="46" cy="62" rx="4" ry="2.6" fill="${COLOR.blush}"/>` +
      `<ellipse cx="76" cy="62" rx="4" ry="2.6" fill="${COLOR.blush}"/>` +
      `<circle cx="52" cy="55" r="3.3" fill="${COLOR.cloudFace}"/>` +
      `<circle cx="70" cy="55" r="3.3" fill="${COLOR.cloudFace}"/>` +
      `<path d="M53 62 Q61 69 69 62" fill="none" stroke="${COLOR.cloudFace}" stroke-width="3" stroke-linecap="round"/>`
    );
  }

  function cloud(size) {
    const s = size || 40;
    return (
      `<svg viewBox="0 0 120 100" width="${s}" height="${(s * 100) / 120}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">` +
      `<g transform="translate(60,56) scale(1.07) translate(-60,-56)">${cloudShapes(COLOR.cloudLine)}</g>` +
      cloudShapes(COLOR.cloud) +
      cloudFace() +
      `</svg>`
    );
  }

  /* 하트 (단일 패스라 테두리는 stroke로) */
  const HEART_D =
    'M60 98 C60 98 14 71 14 41 C14 26 25 16 38 16 C48 16 56 22 60 31 ' +
    'C64 22 72 16 82 16 C95 16 106 26 106 41 C106 71 60 98 60 98 Z';

  function heartFace(faceColor) {
    return (
      `<ellipse cx="43" cy="53" rx="4" ry="2.6" fill="${COLOR.blush}"/>` +
      `<ellipse cx="77" cy="53" rx="4" ry="2.6" fill="${COLOR.blush}"/>` +
      `<circle cx="49" cy="46" r="3.3" fill="${faceColor}"/>` +
      `<circle cx="71" cy="46" r="3.3" fill="${faceColor}"/>` +
      `<path d="M52 54 Q60 62 68 54" fill="none" stroke="${faceColor}" stroke-width="3" stroke-linecap="round"/>`
    );
  }

  function heart(size, opts) {
    opts = opts || {};
    const s = size || 40;
    const fill = opts.fill || COLOR.heart;
    const line = opts.line || COLOR.heartLine;
    const face = opts.face || COLOR.heartFace;
    return (
      `<svg viewBox="0 0 120 112" width="${s}" height="${(s * 112) / 120}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">` +
      `<path d="${HEART_D}" fill="${fill}" stroke="${line}" stroke-width="4" stroke-linejoin="round"/>` +
      heartFace(face) +
      `</svg>`
    );
  }

  /* 헤더 로고: 구름 + 살짝 겹친 하트 */
  function brandLogo() {
    return (
      `<svg viewBox="0 0 148 104" width="38" height="27" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">` +
      `<g transform="translate(-2,2)">` +
      `<g transform="translate(60,56) scale(1.07) translate(-60,-56)">${cloudShapes(COLOR.cloudLine)}</g>` +
      cloudShapes(COLOR.cloud) + cloudFace() +
      `</g>` +
      `<g transform="translate(78,34) scale(0.52)">` +
      `<path d="${HEART_D}" fill="${COLOR.heart}" stroke="${COLOR.heartLine}" stroke-width="4" stroke-linejoin="round"/>` +
      heartFace(COLOR.heartFace) +
      `</g>` +
      `</svg>`
    );
  }

  /* 지도 핀: 핑크 하트 (테마색) */
  function pinHeart() {
    return heart(44, { fill: COLOR.pink, line: COLOR.pinkLine, face: COLOR.pinkFace });
  }

  Diary.mascots = { cloud, heart, brandLogo, pinHeart, COLOR };
})();
