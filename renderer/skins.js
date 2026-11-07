// RamGroupTalk 스킨: 평면·유리·입체 3가지 모양 × 여러 색 조합. 고른 스킨 위에 세부 설정(핵심 색·글꼴·모서리·간격·칸 너비·주제 머리)을 덮어씀.
(function () {
  // S(이름, 어두움, 바탕(css), 사이드바, 카드, 선, 글자, 흐린 글자, 핵심 색)
  const S = (name, dark, bg, side, card, line, fg, muted, acc) => ({ name, dark, bg, side, card, line, fg, muted, acc });
  const SKINS = {
    flat: {
      paper: S('종이', false, '#f4f1ea', '#fbf8f1', '#fffdf8', '#e6e0d3', '#2b2a26', '#7a756a', '#2f4a8a'),
      note: S('노트 그레이', false, '#f7f7f5', '#fbfbfa', '#ffffff', '#e9e9e7', '#37352f', '#787774', '#2383e2'),
      sky: S('하늘', false, '#eaf3fd', '#f5f9ff', '#ffffff', '#d4e3f5', '#1d2b45', '#5d6f90', '#2563eb'),
      blossom: S('벚꽃', false, '#fdf0f3', '#fff7f9', '#ffffff', '#f3dbe3', '#3a2530', '#8a6b79', '#e05a8a'),
      sage: S('세이지', false, '#eef3ec', '#f6f9f4', '#fbfdf9', '#dbe5d6', '#24302a', '#66776b', '#3f8f5f'),
      lilac: S('라일락', false, '#f3f0fb', '#f9f7fe', '#ffffff', '#e3ddf3', '#2d2640', '#76708f', '#7c5cd6'),
      peach: S('피치', false, '#fdf1ec', '#fff8f5', '#ffffff', '#f2ddd3', '#3a2a24', '#8a7066', '#e2684a'),
      mint: S('민트', false, '#e9f7f3', '#f4fbf9', '#ffffff', '#d2ebe4', '#1f3530', '#62807a', '#0f9f86'),
      mono: S('모노', false, '#f2f2f2', '#fafafa', '#ffffff', '#e2e2e2', '#111111', '#6b6b6b', '#111111'),
      graphite: S('그래파이트', true, '#191a1d', '#1f2023', '#232428', '#33353b', '#ececee', '#9fa1a8', '#6aa8ff'),
      midnight: S('미드나잇', true, '#0f1422', '#131a2b', '#182033', '#27314a', '#e8edf8', '#99a6c2', '#7aa2ff'),
      forest: S('밤의 숲', true, '#121a16', '#16201b', '#1a2620', '#2a3b32', '#e5f1ea', '#97b3a4', '#5fd49a'),
      plum: S('플럼', true, '#1c1420', '#221826', '#271c2d', '#3a2b42', '#f2e9f6', '#b6a2c0', '#e28ad6'),
      ocean: S('딥 오션', true, '#0c1a1f', '#102127', '#13262d', '#21404a', '#e2f3f6', '#93b5bd', '#3cc4d8'),
      onyx: S('오닉스', true, '#0a0a0a', '#111111', '#161616', '#262626', '#f5f5f5', '#9a9a9a', '#ff5a5f')
    },
    glass: {
      pastel: S('파스텔 하늘', false, 'linear-gradient(135deg,#dbeafe 0%,#ede9fe 50%,#fce7f3 100%)', '#ffffff', '#ffffff', '#ffffff', '#1e2440', '#5f6788', '#4f6ef7'),
      lavender: S('라벤더 안개', false, 'radial-gradient(circle at 15% 20%,#e9d5ff 0,transparent 45%),radial-gradient(circle at 85% 80%,#c7d2fe 0,transparent 45%),#f5f3ff', '#ffffff', '#ffffff', '#ffffff', '#2a2148', '#6d6590', '#8b5cf6'),
      sunset: S('복숭아 노을', false, 'linear-gradient(160deg,#ffe4d6 0%,#ffd1dc 45%,#e9d5ff 100%)', '#ffffff', '#ffffff', '#ffffff', '#3a2430', '#86677a', '#f05d7c'),
      breeze: S('민트 바람', false, 'linear-gradient(140deg,#d1fae5 0%,#cffafe 50%,#e0e7ff 100%)', '#ffffff', '#ffffff', '#ffffff', '#183335', '#557579', '#0d9488'),
      aurora: S('오로라 라이트', false, 'radial-gradient(circle at 10% 10%,#a7f3d0 0,transparent 40%),radial-gradient(circle at 90% 20%,#bfdbfe 0,transparent 40%),radial-gradient(circle at 50% 100%,#f5d0fe 0,transparent 50%),#f8fafc', '#ffffff', '#ffffff', '#ffffff', '#1d2a3a', '#5d6b80', '#2563eb'),
      cotton: S('솜사탕', false, 'linear-gradient(120deg,#fbcfe8 0%,#ddd6fe 50%,#bae6fd 100%)', '#ffffff', '#ffffff', '#ffffff', '#33263f', '#76668a', '#d946ef'),
      galaxy: S('은하수', true, 'radial-gradient(1px 1px at 20% 30%,#fff 50%,transparent 51%),radial-gradient(1px 1px at 70% 60%,#fff 50%,transparent 51%),radial-gradient(1.5px 1.5px at 40% 80%,#c7d2fe 50%,transparent 51%),radial-gradient(1px 1px at 85% 15%,#fff 50%,transparent 51%),radial-gradient(ellipse at 30% 40%,#3b2a7a 0,transparent 55%),radial-gradient(ellipse at 80% 70%,#1e3a8a 0,transparent 50%),#0b0d1f', '#14162e', '#1b1e3a', '#ffffff', '#eef0ff', '#a9aed4', '#8ea2ff'),
      nightwave: S('밤 물결', true, 'linear-gradient(180deg,#0b0d22 0%,#14123a 60%,#1f1450 100%)', '#121433', '#1a1c40', '#ffffff', '#f0eeff', '#aaa8cc', '#b49cff'),
      neon: S('네온 시티', true, 'radial-gradient(circle at 15% 85%,#ff3cac55 0,transparent 40%),radial-gradient(circle at 85% 15%,#2bd2ff55 0,transparent 40%),#0b0614', '#120b1e', '#1a1128', '#ffffff', '#f7eefb', '#b5a7c4', '#ff5cbc'),
      aurorand: S('오로라 나이트', true, 'radial-gradient(ellipse at 20% 0%,#0f766e88 0,transparent 55%),radial-gradient(ellipse at 80% 10%,#7c3aed66 0,transparent 50%),#071318', '#0d1d22', '#12262c', '#ffffff', '#e6f7f5', '#93b8b4', '#2dd4bf'),
      deepsea: S('심해', true, 'linear-gradient(180deg,#0a2540 0%,#061528 100%)', '#0d2a47', '#11314f', '#ffffff', '#e5f0fb', '#94afcb', '#38bdf8')
    },
    '3d': {
      clay: S('클레이 라벤더', false, 'linear-gradient(160deg,#f4ecff,#e6dcf7)', '#f3ecfd', '#fbf7ff', '#e3d8f3', '#2d2540', '#7a6f92', '#9b6cf0'),
      neu: S('뉴모피즘 그레이', false, 'linear-gradient(160deg,#eceff4,#dde2ea)', '#e8ebf1', '#eef1f6', '#d6dbe4', '#26303f', '#6b7586', '#4f74f0'),
      macaron: S('마카롱', false, 'linear-gradient(160deg,#fff0f3,#ffe0e8 55%,#e8f3ff)', '#fff4f7', '#fffafb', '#f3dbe3', '#3a2630', '#8d6c7a', '#ff6f91'),
      retro: S('레트로 키보드', false, 'linear-gradient(160deg,#efe8d8,#ddd3bf)', '#efe9db', '#f8f3e7', '#ddd2bc', '#3b342a', '#7c7262', '#e0653a'),
      candy: S('민트 캔디', false, 'linear-gradient(160deg,#e6fbf4,#d3efe6)', '#eaf9f3', '#f7fffb', '#cfeae1', '#1f3530', '#62807a', '#14a585'),
      cloud: S('구름 블루', false, 'linear-gradient(160deg,#eef5ff,#dce8fb)', '#ebf2fd', '#f8fbff', '#d5e2f5', '#1d2b45', '#5d6f90', '#3b82f6'),
      darkclay: S('다크 클레이', true, 'linear-gradient(160deg,#23202e,#16141d)', '#1f1c29', '#2a2737', '#3a3649', '#ece8f6', '#a59fba', '#b39cff'),
      navy: S('네이비 실버', true, 'linear-gradient(160deg,#18264a,#0e1628)', '#16223f', '#1d2b4b', '#2c3d63', '#edf1fa', '#9fb0d0', '#8fb3ff'),
      espresso: S('에스프레소', true, 'linear-gradient(160deg,#261d18,#15100e)', '#221a16', '#2d231e', '#43352d', '#f3e9e1', '#bba495', '#e79a5f'),
      darkneu: S('다크 뉴모', true, 'linear-gradient(160deg,#25282e,#1b1d22)', '#22252a', '#292c32', '#363a42', '#e9ebef', '#a0a5b0', '#5eb1ff')
    }
  };
  const KINDS = [['flat', '평면', '깔끔한 기본'], ['glass', '유리', '반투명 배경'], ['3d', '입체', '말랑한 그림자']];

  const hex = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const mix = (a, b, t) => { const x = hex(a), y = hex(b); return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join(''); };
  const isHex = (v) => /^#[0-9a-f]{6}$/i.test(v || '');
  const get = (id) => { if (!id) return null; const [k, n] = String(id).split(':'); return SKINS[k] && SKINS[k][n] ? Object.assign({ kind: k, id }, SKINS[k][n]) : null; };

  const VARS = ['--bg', '--side', '--card', '--line', '--line2', '--hover', '--fg', '--fg2', '--muted', '--faint', '--chip', '--red', '--red-bg', '--sh', '--sh2', '--bgimg', '--acc', '--acc2', '--accbg', '--accbgd', '--font', '--r', '--dn', '--colw', '--hl', '--shc', '--shd', '--onacc'];
  const FONTS = { pretendard: '"Pretendard"', malgun: '"Malgun Gothic","맑은 고딕"' };

  // d: {skin, theme, fontSize, accent, font, radius, density, colw, head}
  function apply(d) {
    d = d || {};
    const root = document.documentElement, s = root.style, k = get(d.skin);
    VARS.forEach((v) => s.removeProperty(v));
    if (k) {
      const dk = k.dark, solidBg = /^#/.test(k.bg) ? k.bg : (dk ? mix(k.side, '#000000', 0.3) : mix(k.card, '#5a6070', 0.05));
      const set = (n, v) => s.setProperty(n, v);
      set('--bg', solidBg); set('--bgimg', k.bg); set('--side', k.side); set('--card', k.card);
      const ln = k.kind === 'glass' ? (dk ? mix(k.card, '#ffffff', 0.12) : mix(k.fg, '#ffffff', 0.86)) : k.line;
      set('--line', ln); set('--line2', mix(ln, k.fg, dk ? 0.12 : 0.1));
      set('--hover', mix(k.side, k.fg, dk ? 0.07 : 0.05)); set('--fg', k.fg); set('--fg2', mix(k.fg, k.muted, 0.35));
      set('--muted', k.muted); set('--faint', mix(k.muted, k.card, 0.35)); set('--chip', mix(k.card, k.fg, dk ? 0.1 : 0.05));
      set('--red', dk ? '#f87171' : '#dc2626'); set('--red-bg', dk ? '#2a1515' : '#fef2f2');
      set('--sh', dk ? '0 1px 2px rgba(0,0,0,.3)' : '0 1px 2px rgba(24,24,27,.05)');
      set('--sh2', dk ? '0 8px 24px rgba(0,0,0,.5)' : '0 8px 24px rgba(24,24,27,.14)');
      set('--hl', dk ? 'rgba(255,255,255,.07)' : 'rgba(255,255,255,.95)');
      set('--shc', dk ? 'rgba(0,0,0,.45)' : mix(k.acc, '#000000', 0.55) + '29');
      set('--shd', dk ? 'rgba(0,0,0,.6)' : mix(k.acc, '#000000', 0.55) + '40');
      root.dataset.theme = dk ? 'dark' : 'light'; root.dataset.look = k.kind;
    } else {
      if (d.theme && d.theme !== 'auto') root.dataset.theme = d.theme; else delete root.dataset.theme;
      delete root.dataset.look;
    }
    // 핵심 색: 직접 고른 색 > 스킨 색 > 기본 파랑
    const acc = isHex(d.accent) ? d.accent : k ? k.acc : '';
    if (acc) {
      const dk = k ? k.dark : root.dataset.theme === 'dark' || (!root.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches);
      const base = k ? k.card : dk ? '#1c1c1f' : '#ffffff';
      s.setProperty('--acc', acc); s.setProperty('--acc2', mix(acc, dk ? '#ffffff' : '#000000', 0.15));
      const lum = hex(acc).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }).reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i], 0);
      s.setProperty('--onacc', lum > 0.4 ? '#141625' : '#ffffff');
      s.setProperty('--accbg', mix(base, acc, dk ? 0.2 : 0.11)); s.setProperty('--accbgd', mix(base, acc, 0.2));
    }
    if (d.font) s.setProperty('--font', (FONTS[d.font] || '"' + String(d.font).replace(/"/g, '') + '"') + ',"Pretendard","Malgun Gothic",sans-serif');
    s.setProperty('--r', ({ sharp: '4px', normal: '10px', round: '16px' })[d.radius] || '10px');
    s.setProperty('--dn', ({ tight: '.72', normal: '1', loose: '1.3' })[d.density] || '1');
    s.setProperty('--colw', ({ narrow: '260px', normal: '300px', wide: '360px' })[d.colw] || '300px');
    root.dataset.head = d.head || 'fill';
    document.body.style.fontSize = (d.fontSize || 15) + 'px';
  }

  window.RGTSkins = { SKINS, KINDS, get, apply, mix };
})();
