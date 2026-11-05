'use strict';

/* =====================================================
   CẤU HÌNH
   - Khi có backend AI: đổi USE_MOCK = false và sửa API_URL.
   - KHÔNG để API key trong file JS này (ai cũng xem được).
     Hãy gọi AI từ backend của bạn, JS chỉ gọi backend.
   ===================================================== */
const CONFIG = {
  USE_MOCK: false,
  API_URL: '/api/generate',
  PLACE: 'Hải Phòng',
  HISTORY_KEY: 'thitu.history',
  HISTORY_MAX: 8,
};

const MONTHS = ['một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín', 'mười', 'mười một', 'mười hai'];

const SAMPLE_POEM = {
  title: 'Mùa thu quê mẹ',
  lines: [
    'Chiều thu gió nhẹ qua hiên,',
    'Hương cau thoảng nhớ một miền quê xa.',
    'Trà tàn sương xuống mái nhà,',
    'Mẹ ngồi vá áo tóc ngà thêm sương.',
    'Thu về gợi một nỗi thương,',
    'Lòng ta nhẹ tựa khói hương cuối ngày.',
  ],
};

/* =====================================================
   PHẦN GỌI AI  (chỗ bạn sẽ tích hợp)
   -----------------------------------------------------
   Gửi lên backend:  { topic, emotion, pairs, quality }
   Backend trả về:   { title: "...", lines: ["câu lục", "câu bát", ...] }
   (lines có pairs*2 phần tử, xen kẽ lục – bát)
   ===================================================== */
async function requestPoem(params) {
  if (CONFIG.USE_MOCK) return mockPoem(params);

  const res = await fetch(CONFIG.API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error('Máy chủ báo lỗi ' + res.status + '. Thử lại sau nhé.');
  return normalizePoem(await res.json(), params);
}

function normalizePoem(data, params) {
  const lines = (Array.isArray(data.lines) ? data.lines : [])
    .map((s) => String(s).trim())
    .filter(Boolean);
  if (!lines.length) throw new Error('AI không trả về câu thơ nào.');
  return { title: String(data.title || params.topic).trim(), lines };
}

// Dữ liệu giả để test giao diện khi chưa có AI
function mockPoem(params) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        title: params.topic,
        lines: SAMPLE_POEM.lines.slice(0, params.pairs * 2),
      });
    }, 900);
  });
}

// Prompt mẫu: copy sang backend khi gọi mô hình AI
function buildPrompt({ topic, emotion, pairs }) {
  return (
    `Hãy làm một bài thơ lục bát tiếng Việt về chủ đề "${topic}", cảm xúc ${emotion}, ` +
    `gồm ${pairs} cặp lục bát (${pairs * 2} câu). ` +
    `Luật: câu lục 6 tiếng, câu bát 8 tiếng; tiếng 2, 6, 8 thanh bằng; tiếng 4 thanh trắc; ` +
    `tiếng 6 và 8 của câu bát khác dấu (huyền / không dấu). ` +
    `Gieo vần: tiếng 6 câu lục vần với tiếng 6 câu bát; tiếng 8 câu bát vần với tiếng 6 câu lục kế tiếp. ` +
    `Chỉ trả về JSON: {"title": "...", "lines": ["...", "..."]}`
  );
}

/* =====================================================
   PHÂN TÍCH LUẬT THƠ (chạy ngay trên trình duyệt)
   ===================================================== */
function getTone(word) {
  const d = word.normalize('NFD');
  if (/[\u0301\u0309\u0303\u0323]/.test(d)) return 'trac';   // sắc, hỏi, ngã, nặng
  if (d.includes('\u0300')) return 'huyen';                    // huyền
  return 'ngang';                                              // không dấu
}

function rhymeKey(word) {
  const base = word
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300\u0301\u0309\u0303\u0323]/g, '')
    .normalize('NFC');
  return base.replace(/^(ngh|ng|nh|ch|gh|kh|ph|qu|th|tr|gi|[bcdđghklmnpqrstvx])/, '');
}

function splitToken(tok) {
  const m = tok.match(/^([^\p{L}]*)(\p{L}+)([^\p{L}]*)$/u);
  return m ? { pre: m[1], core: m[2], post: m[3] } : { pre: '', core: tok, post: '' };
}

function analyze(lines) {
  const rows = lines.map((text, i) => {
    const isBat = i % 2 === 1;
    const need = isBat ? 8 : 6;
    const tokens = text.trim().split(/\s+/).map(splitToken);
    const tones = tokens.map((t) => getTone(t.core));
    const isB = (k) => tones[k - 1] !== 'trac';

    let ok = tokens.length === need && isB(2) && !isB(4) && isB(6) && (!isBat || isB(8));
    if (ok && isBat) ok = tones[5] !== tones[7]; // tiếng 6 và 8 khác dấu
    return { text, isBat, tokens, ok };
  });

  // Chuỗi vần lục bát: [L6,B6] – [B8,L6,B6] – [B8,L6,B6] …
  const groups = [];
  let g = [];
  rows.forEach((r) => {
    if (r.tokens[5]) g.push(r.tokens[5]);
    if (r.isBat) {
      groups.push(g);
      g = r.tokens[7] ? [r.tokens[7]] : [];
    }
  });
  if (g.length) groups.push(g);

  const rhymeGroups = groups.filter((x) => x.length >= 2);
  rhymeGroups.forEach((grp) => grp.forEach((t) => (t.rhyme = true)));
  const badRhymes = rhymeGroups.filter((grp) => new Set(grp.map((t) => rhymeKey(t.core))).size > 1);

  return { rows, rhymeGroups, badRhymes };
}

/* =====================================================
   GIAO DIỆN
   ===================================================== */
const $ = (sel) => document.querySelector(sel);

const el = {
  topic: $('#chu-de'),
  chips: document.querySelectorAll('.chip'),
  emotion: $('#cam-xuc'),
  pairs: $('#so-cap'),
  quality: $('#chat-luong'),
  btnGenerate: $('#btn-generate'),
  btnCopy: $('#btn-copy'),
  btnExport: $('#btn-export'),
  btnClear: $('#btn-clear'),
  recent: $('#recent-list'),
  card: $('#card'),
  title: $('#poem-title'),
  poem: $('#poem'),
  sign: $('#poem-sign'),
  notes: $('#notes-text'),
};

let current = null; // bài thơ đang hiển thị

function make(tag, text, cls) {
  const n = document.createElement(tag);
  if (text) n.textContent = text;
  if (cls) n.className = cls;
  return n;
}

function renderPoem(poem, a) {
  el.title.textContent = poem.title;
  el.poem.replaceChildren();

  a.rows.forEach((r) => {
    const p = make('p', '', r.isBat ? 'l2' : 'l1');
    r.tokens.forEach((t, i) => {
      if (i) p.append(' ');
      if (t.rhyme) p.append(t.pre, make('u', t.core), t.post);
      else p.append(t.pre + t.core + t.post);
    });
    el.poem.append(p);
  });

  const d = poem.ts ? new Date(poem.ts) : new Date();
  el.sign.textContent = `${CONFIG.PLACE}, tháng ${MONTHS[d.getMonth()]}`;
}

function renderNotes(a) {
  el.notes.replaceChildren();
  const total = a.rows.length;
  const bad = a.rows.map((r, i) => (r.ok ? 0 : i + 1)).filter(Boolean);

  el.notes.append(
    make(
      'p',
      bad.length === 0
        ? `Cả ${total} câu đều đúng B–T–B; tiếng 6 và 8 câu bát khác dấu.`
        : `${total - bad.length}/${total} câu đúng luật. Cần xem lại: câu ${bad.join(', ')}.`
    )
  );

  const rhyme = make('p', 'Vần gieo: ');
  rhyme.append(make('u', a.rhymeGroups.map((g) => g.map((t) => t.core).join(' – ')).join(', ')));
  rhyme.append('.');
  el.notes.append(rhyme);

  if (a.badRhymes.length) {
    el.notes.append(
      make('p', 'Vần chưa khớp: ' + a.badRhymes.map((g) => g.map((t) => t.core).join(' – ')).join('; ') + '.')
    );
  }
  el.notes.append(make('p', 'Việc xét vần là gần đúng, có thể bỏ sót vần thông.'));
}

function show(poem) {
  current = poem;
  const a = analyze(poem.lines);
  renderPoem(poem, a);
  renderNotes(a);
  renderHistory();
}

function showEmpty() {
  current = null;
  el.title.textContent = '';
  el.sign.textContent = '';
  el.notes.replaceChildren();
  el.poem.replaceChildren(make('p', 'Nhập chủ đề rồi bấm “Sinh thơ”.', 'poem-empty'));
  renderHistory();
}

/* ---------- Lịch sử (lưu trên trình duyệt) ---------- */
function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem(CONFIG.HISTORY_KEY)) || [];
  } catch {
    return [];
  }
}
function saveHistory(list) {
  try {
    localStorage.setItem(CONFIG.HISTORY_KEY, JSON.stringify(list));
  } catch {
    /* bỏ qua nếu trình duyệt chặn lưu trữ */
  }
}
function addHistory(poem) {
  saveHistory([poem, ...loadHistory()].slice(0, CONFIG.HISTORY_MAX));
}

function fmtDate(ts) {
  const d = new Date(ts);
  return String(d.getDate()).padStart(2, '0') + '.' + String(d.getMonth() + 1).padStart(2, '0');
}

function renderHistory() {
  const list = loadHistory();
  el.recent.replaceChildren();

  if (!list.length) {
    el.recent.append(make('li', 'Chưa có bài nào.', 'recent-empty'));
    return;
  }

  list.forEach((item) => {
    const li = make('li', '', 'recent-item' + (current && current.id === item.id ? ' is-current' : ''));
    const a = make('a');
    a.href = '#';
    a.append(
      make('span', item.lines[0].replace(/[,.;]$/, '') + '…', 'recent-title'),
      make('span', `${item.topic} · ${fmtDate(item.ts)}`, 'recent-meta')
    );
    a.addEventListener('click', (e) => {
      e.preventDefault();
      show(item);
    });
    li.append(a);
    el.recent.append(li);
  });
}

/* ---------- Thông báo nhỏ ---------- */
function toast(msg) {
  const t = make('div', msg, 'toast');
  t.setAttribute('role', 'status');
  document.body.append(t);
  setTimeout(() => t.remove(), 2400);
}

/* ---------- Hành động ---------- */
function readParams() {
  return {
    topic: el.topic.value.trim(),
    emotion: el.emotion.value,
    pairs: Number(el.pairs.value),
    quality: el.quality.value,
  };
}

function setLoading(on) {
  el.btnGenerate.disabled = on;
  el.btnGenerate.textContent = on ? 'Đang sáng tác…' : 'Sinh thơ';
  el.card.classList.toggle('is-loading', on);
}

async function onGenerate() {
  const params = readParams();
  if (!params.topic) {
    toast('Hãy nhập chủ đề trước.');
    el.topic.focus();
    return;
  }

  setLoading(true);
  try {
    const poem = await requestPoem(params);
    poem.id = Date.now();
    poem.ts = poem.id;
    poem.topic = params.topic;
    addHistory(poem);
    show(poem);
  } catch (err) {
    toast(err.message || 'Không sinh được thơ. Thử lại nhé.');
  } finally {
    setLoading(false);
  }
}

async function onCopy() {
  if (!current) return toast('Chưa có bài thơ để sao chép.');
  const text = current.title + '\n\n' + current.lines.join('\n');
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = make('textarea');
    ta.value = text;
    document.body.append(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
  toast('Đã sao chép bài thơ.');
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (window.html2canvas) return resolve();
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error('Không tải được thư viện xuất ảnh.'));
    document.head.append(s);
  });
}

async function onExport() {
  if (!current) return toast('Chưa có bài thơ để xuất.');
  try {
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js');
    const canvas = await window.html2canvas(el.card, { scale: 2, backgroundColor: null });
    const a = make('a');
    a.href = canvas.toDataURL('image/png');
    a.download = 'thiep-tho-' + Date.now() + '.png';
    a.click();
    toast('Đã xuất thiệp.');
  } catch (err) {
    toast(err.message || 'Xuất thiệp thất bại.');
  }
}

function onClear() {
  if (current) saveHistory(loadHistory().filter((h) => h.id !== current.id));
  const next = loadHistory()[0];
  if (next) show(next);
  else showEmpty();
}

/* ---------- Gắn sự kiện ---------- */
el.chips.forEach((chip) =>
  chip.addEventListener('click', () => {
    el.topic.value = chip.textContent.trim();
    syncChips();
  })
);

function syncChips() {
  const v = el.topic.value.trim().toLowerCase();
  el.chips.forEach((c) => c.classList.toggle('is-active', c.textContent.trim().toLowerCase() === v));
}

el.topic.addEventListener('input', syncChips);
el.topic.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') onGenerate();
});
el.btnGenerate.addEventListener('click', onGenerate);
el.btnCopy.addEventListener('click', onCopy);
el.btnExport.addEventListener('click', onExport);
el.btnClear.addEventListener('click', onClear);

/* ---------- Khởi động ---------- */
(function init() {
  const saved = loadHistory();
  if (saved.length) show(saved[0]);
  else {
    show({ ...SAMPLE_POEM, id: 0, ts: Date.now(), topic: SAMPLE_POEM.title });
  }
  syncChips();
})();