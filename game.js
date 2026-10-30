/* ===== 십이장기 game.js =====
   1) 규칙(순수 함수)  2) 컴퓨터(AI)  3) 화면(UI)
   방향 데이터는 "앞이 위쪽(-1)" 기준으로 적어 두고, 위쪽 플레이어는 앞뒤를 뒤집어서 사용합니다. */
'use strict';

/* ==================== 1. 규칙 ==================== */
const ROWS = 4, COLS = 3;
const HOME_ROW = [3, 0];     // 0번(아래/홍)의 진영 줄, 1번(위/청)의 진영 줄
const SIGN = [1, -1];        // 앞쪽 방향 부호
const DIRS = {
  jang: [[-1,0],[1,0],[0,-1],[0,1]],
  sang: [[-1,-1],[-1,1],[1,-1],[1,1]],
  wang: [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]],
  ja:   [[-1,0]],
  hu:   [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1]]
};
const GLYPH = { jang:'將', sang:'相', wang:'王', ja:'子', hu:'侯' };
const KNAME = { jang:'장', sang:'상', wang:'왕', ja:'자', hu:'후' };
const CODE  = { jang:'J', sang:'S', wang:'W', ja:'a', hu:'h' };

function mk(t, o) { return { t: t, o: o }; }

function createInitialState(first) {
  const board = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  board[3] = [mk('sang',0), mk('wang',0), mk('jang',0)];
  board[2][1] = mk('ja',0);
  board[0] = [mk('jang',1), mk('wang',1), mk('sang',1)];
  board[1][1] = mk('ja',1);
  return { board: board, hands: [[],[]], turn: first, winner: null, reason: null };
}

function cloneState(s) {
  return {
    board: s.board.map(function (r) { return r.slice(); }),
    hands: [s.hands[0].slice(), s.hands[1].slice()],
    turn: s.turn, winner: s.winner, reason: s.reason
  };
}

function genMoves(s, p) {
  const moves = [];
  const sg = SIGN[p];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const pc = s.board[r][c];
      if (!pc || pc.o !== p) continue;
      for (const d of DIRS[pc.t]) {
        const nr = r + d[0] * sg, nc = c + d[1];
        if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) continue;
        const t = s.board[nr][nc];
        if (t && t.o === p) continue;
        moves.push({ k: 'm', fr: r, fc: c, r: nr, c: nc });
      }
    }
  }
  const seen = {};
  for (const h of s.hands[p]) {
    if (seen[h]) continue;
    seen[h] = true;
    for (let r = 0; r < ROWS; r++) {
      if (r === HOME_ROW[1 - p]) continue;     // 상대 진영에는 못 놓음
      for (let c = 0; c < COLS; c++) {
        if (!s.board[r][c]) moves.push({ k: 'd', t: h, r: r, c: c });
      }
    }
  }
  return moves;
}

function kingInRow(s, p, row) {
  for (let c = 0; c < COLS; c++) {
    const pc = s.board[row][c];
    if (pc && pc.t === 'wang' && pc.o === p) return true;
  }
  return false;
}

function findKing(s, p) {
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      const pc = s.board[r][c];
      if (pc && pc.t === 'wang' && pc.o === p) return [r, c];
    }
  return null;
}

function attacksSquare(s, p, tr, tc) {
  const sg = SIGN[p];
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      const pc = s.board[r][c];
      if (!pc || pc.o !== p) continue;
      for (const d of DIRS[pc.t]) {
        if (r + d[0] * sg === tr && c + d[1] === tc) return true;
      }
    }
  return false;
}

// p 의 왕이 상대에게 잡힐 수 있는 상태인가
function isKingAttacked(s, p) {
  const k = findKing(s, p);
  return !!k && attacksSquare(s, 1 - p, k[0], k[1]);
}

function applyMove(s, m) {
  const ns = cloneState(s);
  const p = s.turn, q = 1 - p;
  if (m.k === 'm') {
    let piece = ns.board[m.fr][m.fc];
    const tgt = ns.board[m.r][m.c];
    if (tgt) {
      if (tgt.t === 'wang') { ns.winner = p; ns.reason = 'capture'; }
      else ns.hands[p].push(tgt.t === 'hu' ? 'ja' : tgt.t);   // 후는 자로 되돌려 포로
    }
    if (piece.t === 'ja' && m.r === HOME_ROW[q]) piece = mk('hu', p);   // 승격
    ns.board[m.fr][m.fc] = null;
    ns.board[m.r][m.c] = piece;
  } else {
    const i = ns.hands[p].indexOf(m.t);
    ns.hands[p].splice(i, 1);
    ns.board[m.r][m.c] = mk(m.t, p);
  }
  ns.turn = q;
  // 상대 왕이 내 진영에서 내 한 턴을 버텼다면 상대 승리
  if (ns.winner === null && kingInRow(ns, q, HOME_ROW[p])) { ns.winner = q; ns.reason = 'hold'; }
  return ns;
}

function posKey(s) {
  let k = '';
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      const p = s.board[r][c];
      k += p ? CODE[p.t] + p.o : '--';
    }
  k += '|' + s.hands[0].slice().sort().join('') + '|' + s.hands[1].slice().sort().join('') + '|' + s.turn;
  return k;
}

/* ==================== 2. 컴퓨터(AI) ==================== */
const VAL = { ja: 100, hu: 190, jang: 300, sang: 300, wang: 0 };
const WIN = 100000, INF = 1e9;

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

function evaluate(s, p) {
  let sc = 0;
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      const pc = s.board[r][c];
      if (!pc) continue;
      const adv = pc.o === 0 ? 3 - r : r;
      let v = VAL[pc.t];
      if (pc.t === 'ja') v += adv * 12;
      else if (pc.t === 'wang') v += adv * 14;
      else v += adv * 4;
      sc += (pc.o === p ? 1 : -1) * v;
    }
  for (const h of s.hands[p]) sc += VAL[h] * 0.92;
  for (const h of s.hands[1 - p]) sc -= VAL[h] * 0.92;
  return sc;
}

function leafScore(s, ply) {
  const t = s.turn;
  if (isKingAttacked(s, 1 - t)) return WIN - ply - 1;                    // 내가 바로 왕을 잡을 수 있음
  if (kingInRow(s, 1 - t, HOME_ROW[t])) return -(WIN - ply - 2);          // 상대 왕이 버티기 성공 직전
  return evaluate(s, t);
}

function moveOrderScore(s, m) {
  if (m.k !== 'm') return 0;
  let sc = 0;
  const t = s.board[m.r][m.c];
  if (t) sc += t.t === 'wang' ? 10000 : VAL[t.t] + 1000;
  const pc = s.board[m.fr][m.fc];
  if (pc.t === 'ja' && m.r === HOME_ROW[1 - s.turn]) sc += 60;
  return sc;
}

function orderMoves(s, moves) {
  const arr = moves.map(function (m) { return { m: m, v: moveOrderScore(s, m) }; });
  arr.sort(function (a, b) { return b.v - a.v; });
  return arr.map(function (x) { return x.m; });
}

function negamax(s, depth, alpha, beta, ply, ctx) {
  if (s.winner !== null) {
    if (s.winner === 'draw') return 0;
    return s.winner === s.turn ? WIN - ply : -(WIN - ply);
  }
  if (depth === 0) return leafScore(s, ply);
  if ((++ctx.nodes & 1023) === 0 && ctx.deadline && Date.now() > ctx.deadline) ctx.abort = true;
  if (ctx.abort) return 0;
  const moves = orderMoves(s, genMoves(s, s.turn));
  if (!moves.length) return -(WIN - ply);
  let best = -INF;
  for (const m of moves) {
    const v = -negamax(applyMove(s, m), depth - 1, -beta, -alpha, ply + 1, ctx);
    if (ctx.abort) return 0;
    if (v > best) best = v;
    if (v > alpha) alpha = v;
    if (alpha >= beta) break;
  }
  return best;
}

// 이 수를 두면 같은 판이 3번째가 되어 무승부라면 0점으로 취급
function rootScore(s, m, depth, alpha, beta, counts, ctx) {
  const child = applyMove(s, m);
  if (child.winner === null && (counts[posKey(child)] || 0) >= 2) return 0;
  return -negamax(child, depth - 1, -beta, -alpha, 1, ctx);
}

function searchHard(s, moves, counts, timeMs, maxDepth) {
  const ctx = { nodes: 0, abort: false, deadline: Date.now() + timeMs };
  let order = orderMoves(s, moves);
  let bestMove = order[0];
  for (let d = 1; d <= maxDepth; d++) {
    let bestV = -INF, curBest = null;
    for (const m of order) {
      const v = rootScore(s, m, d, bestV === -INF ? -INF : bestV, INF, counts, ctx);
      if (ctx.abort) break;
      if (v > bestV) { bestV = v; curBest = m; }
    }
    if (curBest) {
      bestMove = curBest;
      order = [curBest].concat(order.filter(function (x) { return x !== curBest; }));
    }
    if (ctx.abort) break;
    if (Math.abs(bestV) > WIN - 100) break;   // 승패가 이미 보임
  }
  return bestMove;
}

function chooseMove(s, level, counts) {
  counts = counts || {};
  const moves = shuffle(genMoves(s, s.turn));
  if (!moves.length) return null;
  // 왕을 바로 잡을 수 있으면 잡는다
  for (const m of moves) {
    if (m.k === 'm') { const t = s.board[m.r][m.c]; if (t && t.t === 'wang') return m; }
  }
  if (level === 'hard') return searchHard(s, moves, counts, 1400, 9);

  const cfg = level === 'easy' ? { depth: 1, margin: 70, rand: 0.3 } : { depth: 3, margin: 12, rand: 0 };
  if (Math.random() < cfg.rand) return moves[0];
  const ctx = { nodes: 0, abort: false, deadline: 0 };
  const scored = moves.map(function (m) { return { m: m, v: rootScore(s, m, cfg.depth, -INF, INF, counts, ctx) }; });
  let best = -INF;
  for (const x of scored) if (x.v > best) best = x.v;
  const pool = scored.filter(function (x) { return x.v >= best - cfg.margin; });
  return pool[Math.floor(Math.random() * pool.length)].m;
}

/* ==================== 3. 화면(UI) ==================== */
const TIPS = [
  { t: '포로말 재활용하기',
    x: '잡은 말은 내 말이 돼요! 내 차례에 원하는 빈칸(상대 진영 제외)에 내려놓을 수 있어요. 십이장기는 상대 말을 다 잡는 게임이 아니에요. 잡은 말을 어디에 다시 쓰느냐가 핵심이에요.' },
  { t: '빠르게 두기',
    x: '내 차례에 빨리 두면 상대가 생각할 시간이 줄어들어요. 내가 빨리 두고, 상대가 고민하는 동안 나도 다음 수를 같이 생각해 보세요. 다만 상대도 빨리 두면 내 생각 시간도 줄어드니 조심해요!' },
  { t: '말을 미끼로 던지기',
    x: '포로를 내려놓을 때 일부러 잡힐 수 있는 자리에 놓아 보세요. 상대 말이 앞으로 따라 나오게 유도할 수 있어요. 미끼를 문 다음에 내가 이득을 볼 수 있을 때만 써야 해요.' },
  { t: '상을 가로로 나란히',
    x: '장은 상하좌우로만 움직여서 지킬 수 있는 칸이 2칸이에요. 상은 대각선으로 움직여서 사실상 3칸을 모두 막을 수 있어요. 상을 가로로 나란히 놓아 보세요.' },
  { t: '왕도 앞으로 나가요',
    x: '십이장기에서는 왕도 얼마든지 앞으로 나갈 수 있어요! 왕은 모든 방향으로 움직일 수 있어서, 앞으로 나가면 상대가 부담을 느끼고 다른 말도 지켜 줄 수 있어요. 왕의 전진에 성공하면 경기의 주도권을 잡을 수 있어요.' },
  { t: '엉뚱한 수는 양날의 검',
    x: '상대가 예상하기 어려운 수를 두면 처음 보는 상대는 당황할 수 있어요. 하지만 연습을 많이 한 상대에게는 쓸데없는 수가 되어 오히려 손해가 될 수 있어요.' },
  { t: '버티기 승리를 기억해요',
    x: '왕이 상대 진영에 들어가서 다음 내 차례까지 잡히지 않으면 이겨요. 반대로 상대 왕이 우리 진영에 들어오면 꼭 잡아야 해요!' },
  { t: '자는 변신해요',
    x: '자(子)가 상대 진영에 들어가면 후(侯)로 변신해서 대각선 뒤만 빼고 어디로든 갈 수 있어요. 하지만 후가 잡히면 다시 자로 돌아가 상대 포로가 돼요.' }
];

const DEFAULTS = { mode: 'ai', level: 'normal', first: 'p0', warn: true, dirs: true, flip: false };
let S = loadSettings();
const G = { state: null, hist: [], sel: null, legal: [], busy: false, over: false, token: 0, posCounts: {}, last: null };
let lastTip = {};

function $(id) { return document.getElementById(id); }

function loadSettings() {
  try {
    const raw = localStorage.getItem('sipijang_settings');
    if (raw) return Object.assign({}, DEFAULTS, JSON.parse(raw));
  } catch (e) {}
  return Object.assign({}, DEFAULTS);
}
function saveSettings() {
  try { localStorage.setItem('sipijang_settings', JSON.stringify(S)); } catch (e) {}
}

function pname(p) {
  if (S.mode === 'ai') return p === 0 ? '나' : '컴퓨터';
  return p === 0 ? '홍팀' : '청팀';
}

/* ---------- 말 그리기 ---------- */
function pieceSVG(piece, opt) {
  opt = opt || {};
  const showDirs = opt.dirs !== undefined ? opt.dirs : S.dirs;
  const rot = piece.o === 1 ? 180 : 0;
  const glyphRot = (piece.o === 1 && S.flip && S.mode === 'pvp' && !opt.noFlip) ? 180 : 0;
  let dots = '';
  if (showDirs) {
    for (const d of DIRS[piece.t]) {
      const cx = 50 + d[1] * 31;
      const cy = d[0] < 0 ? 22 : (d[0] > 0 ? 86 : 50);
      dots += '<circle class="dot" cx="' + cx + '" cy="' + cy + '" r="4.2"/>';
    }
  }
  return '<svg viewBox="0 0 100 100" class="pcsvg p' + piece.o + ' ' + piece.t + '">' +
    '<g transform="rotate(' + rot + ' 50 50)"><polygon class="body" points="50,3 94,22 88,97 12,97 6,22"/>' + dots + '</g>' +
    '<g transform="rotate(' + glyphRot + ' 50 50)">' +
    '<text class="hanja" x="50" y="43">' + GLYPH[piece.t] + '</text>' +
    '<text class="hangul" x="50" y="68">' + KNAME[piece.t] + '</text></g></svg>';
}

/* ---------- 화면 이동 ---------- */
function go(name) {
  document.querySelectorAll('.screen').forEach(function (el) {
    el.classList.toggle('active', el.id === 'screen-' + name);
  });
  if (name === 'main' || name === 'settings') showTip(name);
  if (name === 'settings') syncSettingsUI();
  window.scrollTo(0, 0);
}

function showTip(name) {
  const box = $('tip-' + name);
  if (!box) return;
  let i;
  do { i = Math.floor(Math.random() * TIPS.length); } while (TIPS.length > 1 && i === lastTip[name]);
  lastTip[name] = i;
  box.querySelector('.tip-title').textContent = TIPS[i].t;
  box.querySelector('.tip-text').textContent = TIPS[i].x;
}

/* ---------- 설정 화면 ---------- */
function syncSettingsUI() {
  document.querySelectorAll('.opt-group').forEach(function (g) {
    const key = g.dataset.key;
    g.querySelectorAll('button').forEach(function (b) {
      b.classList.toggle('on', b.dataset.val === S[key]);
    });
  });
  document.querySelectorAll('.ai-only').forEach(function (el) { el.classList.toggle('hidden', S.mode !== 'ai'); });
  document.querySelectorAll('.pvp-only').forEach(function (el) { el.classList.toggle('hidden', S.mode !== 'pvp'); });
  $('firstP0').textContent = S.mode === 'ai' ? '내가 먼저' : '홍팀(아래)';
  $('firstP1').textContent = S.mode === 'ai' ? '컴퓨터가 먼저' : '청팀(위)';
  const desc = { easy: '가끔 실수를 해요. 처음 해 보는 친구에게 좋아요.',
                 normal: '두세 수 앞을 내다봐요. 방심하면 잡혀요.',
                 hard: '여러 수 앞을 깊게 내다봐요. 생각하는 데 시간이 조금 걸려요.' };
  $('levelDesc').textContent = desc[S.level];
  $('optWarn').checked = S.warn;
  $('optDirs').checked = S.dirs;
  $('optFlip').checked = S.flip;
}

/* ---------- 게임 시작/종료 ---------- */
function startGame() {
  G.token++;
  let first = S.first === 'random' ? (Math.random() < 0.5 ? 0 : 1) : (S.first === 'p1' ? 1 : 0);
  G.state = createInitialState(first);
  G.hist = [];
  G.sel = null; G.legal = [];
  G.busy = false; G.over = false; G.last = null;
  G.posCounts = {};
  G.posCounts[posKey(G.state)] = 1;
  $('overlay').classList.add('hidden');
  render();
  scheduleAI();
}

function canAct() {
  return !G.over && !G.busy && (S.mode === 'pvp' || G.state.turn === 0);
}

function clearSel() { G.sel = null; G.legal = []; }

function selectBoard(r, c) {
  G.sel = { kind: 'board', r: r, c: c };
  G.legal = genMoves(G.state, G.state.turn).filter(function (m) { return m.k === 'm' && m.fr === r && m.fc === c; });
}

function selectHand(i) {
  const t = G.state.hands[G.state.turn][i];
  G.sel = { kind: 'hand', i: i, t: t };
  G.legal = genMoves(G.state, G.state.turn).filter(function (m) { return m.k === 'd' && m.t === t; });
}

function onCell(r, c) {
  if (!canAct()) return;
  const s = G.state, T = s.turn, pc = s.board[r][c];
  if (G.sel) {
    const mv = G.legal.find(function (m) { return m.r === r && m.c === c; });
    if (mv) { doMove(mv); return; }
  }
  if (pc && pc.o === T) {
    if (G.sel && G.sel.kind === 'board' && G.sel.r === r && G.sel.c === c) clearSel();
    else selectBoard(r, c);
  } else clearSel();
  render();
}

function onHand(p, i) {
  if (!canAct() || p !== G.state.turn) return;
  if (G.sel && G.sel.kind === 'hand' && G.sel.i === i) clearSel();
  else selectHand(i);
  render();
}

function doMove(m) {
  G.hist.push({ state: G.state, counts: Object.assign({}, G.posCounts), last: G.last });
  const ns = applyMove(G.state, m);
  const key = posKey(ns);
  G.posCounts[key] = (G.posCounts[key] || 0) + 1;
  if (ns.winner === null && G.posCounts[key] >= 3) { ns.winner = 'draw'; ns.reason = 'repeat'; }
  if (ns.winner === null && genMoves(ns, ns.turn).length === 0) { ns.winner = 1 - ns.turn; ns.reason = 'nomove'; }
  G.state = ns;
  G.last = { fr: m.fr, fc: m.fc, r: m.r, c: m.c, drop: m.k === 'd' };
  clearSel();
  if (ns.winner !== null) {
    G.over = true;
    render();
    showResult();
    return;
  }
  render();
  scheduleAI();
}

function scheduleAI() {
  if (G.over || S.mode !== 'ai' || G.state.turn !== 1) return;
  G.busy = true;
  render();
  const tok = ++G.token;
  setTimeout(function () {
    if (tok !== G.token) return;
    const m = chooseMove(G.state, S.level, G.posCounts);
    if (tok !== G.token) return;
    G.busy = false;
    if (m) doMove(m); else { G.state.winner = 0; G.state.reason = 'nomove'; G.over = true; render(); showResult(); }
  }, 450);
}

function undo() {
  if (G.busy || !G.hist.length) return;
  let idx = -1;
  if (S.mode === 'ai') {
    for (let i = G.hist.length - 1; i >= 0; i--) if (G.hist[i].state.turn === 0) { idx = i; break; }
  } else idx = G.hist.length - 1;
  if (idx < 0) return;
  const h = G.hist[idx];
  G.hist.length = idx;
  G.state = h.state; G.posCounts = h.counts; G.last = h.last;
  G.over = false; G.token++; G.busy = false;
  clearSel();
  $('overlay').classList.add('hidden');
  render();
  scheduleAI();
}

/* ---------- 결과 ---------- */
function showResult() {
  const s = G.state;
  let title, text;
  if (s.winner === 'draw') {
    title = '무승부';
    text = '같은 판이 3번 나와서 승부가 나지 않았어요.';
  } else {
    const w = s.winner;
    if (S.mode === 'ai') title = w === 0 ? '승리!' : '아쉽게 졌어요';
    else title = pname(w) + ' 승리!';
    if (s.reason === 'capture') {
      text = S.mode === 'ai' ? (w === 0 ? '상대 왕을 잡았어요!' : '내 왕이 잡혔어요.') : pname(w) + '이 상대 왕을 잡았어요!';
    } else if (s.reason === 'hold') {
      text = S.mode === 'ai' ? (w === 0 ? '내 왕이 상대 진영에서 한 턴을 버텼어요!' : '컴퓨터 왕이 내 진영에서 한 턴을 버텼어요.')
                             : pname(w) + '의 왕이 상대 진영에서 한 턴을 버텼어요!';
    } else text = '더 이상 둘 수 있는 수가 없어요.';
  }
  $('resTitle').textContent = title;
  $('resText').textContent = text;
  $('overlay').classList.remove('hidden');
}

/* ---------- 그리기 ---------- */
function render() {
  const s = G.state;
  if (!s) return;
  const T = s.turn;
  const acting = canAct();

  // 판
  let html = '';
  const dangerPlayer = (S.warn && !G.over && (S.mode === 'pvp' || T === 0) && isKingAttacked(s, T)) ? T : -1;
  const kingPos = dangerPlayer >= 0 ? findKing(s, dangerPlayer) : null;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const pc = s.board[r][c];
      const cls = ['cell'];
      if (r === 0) cls.push('home1');
      if (r === 3) cls.push('home0');
      if (G.sel && G.sel.kind === 'board' && G.sel.r === r && G.sel.c === c) cls.push('selected');
      if (G.legal.some(function (m) { return m.r === r && m.c === c; })) cls.push(pc ? 'capture' : 'target');
      if (G.last && ((G.last.r === r && G.last.c === c) || (!G.last.drop && G.last.fr === r && G.last.fc === c))) cls.push('last');
      if (kingPos && kingPos[0] === r && kingPos[1] === c) cls.push('danger');
      if (acting && ((pc && pc.o === T) || G.legal.some(function (m) { return m.r === r && m.c === c; }) || G.sel)) cls.push('clickable');
      let zone = '';
      if (r === 0) zone = '<span class="zone">' + (S.mode === 'ai' ? '컴퓨터 진영' : '청 진영') + '</span>';
      if (r === 3) zone = '<span class="zone">' + (S.mode === 'ai' ? '내 진영' : '홍 진영') + '</span>';
      if (c !== 0) zone = '';
      html += '<div class="' + cls.join(' ') + '" data-r="' + r + '" data-c="' + c + '">' + zone +
        (pc ? '<div class="pc">' + pieceSVG(pc) + '</div>' : '') + '</div>';
    }
  }
  $('board').innerHTML = html;

  // 포로
  for (let p = 0; p < 2; p++) {
    const tray = $('tray' + p);
    let th = '';
    s.hands[p].forEach(function (h, i) {
      const sel = G.sel && G.sel.kind === 'hand' && G.sel.i === i && p === T;
      const ready = acting && p === T;
      th += '<div class="hand-piece' + (ready ? ' ready' : '') + (sel ? ' selected' : '') + '" data-p="' + p + '" data-i="' + i + '">' +
        pieceSVG({ t: h, o: p }) + '</div>';
    });
    if (!s.hands[p].length) th = '<span class="empty">잡은 말이 없어요</span>';
    tray.innerHTML = th;
    $('lbl' + p).textContent = (S.mode === 'ai' ? (p === 0 ? '내 포로' : '컴퓨터의 포로') : (p === 0 ? '홍팀(아래)의 포로' : '청팀(위)의 포로'));
  }

  updateStatus();
  $('btnUndo').disabled = G.busy || !G.hist.length ||
    (S.mode === 'ai' && !G.hist.some(function (h) { return h.state.turn === 0; }));
}

function updateStatus() {
  const s = G.state, T = s.turn;
  const chip = $('turnChip');
  if (G.over) { chip.textContent = '게임 끝'; chip.className = 'turn-chip end'; }
  else {
    chip.className = 'turn-chip p' + T;
    if (S.mode === 'ai') chip.textContent = T === 0 ? '내 차례' : '컴퓨터 차례';
    else chip.textContent = T === 0 ? '홍팀(아래) 차례' : '청팀(위) 차례';
  }
  const msgs = [];
  if (!G.over) {
    const o = 1 - T;
    if (kingInRow(s, o, HOME_ROW[T])) {
      if (S.mode === 'ai') {
        if (T === 0) msgs.push(['danger', '컴퓨터 왕이 내 진영에 들어왔어요! 이번 턴에 잡지 못하면 져요!']);
        else msgs.push(['good', '내 왕이 컴퓨터 진영에 들어갔어요. 잡히지 않고 버티면 이겨요!']);
      } else {
        msgs.push([ 'danger', pname(o) + ' 왕이 상대 진영에 들어왔어요! ' + pname(T) + '이 이번 턴에 잡지 못하면 ' + pname(o) + ' 승리!' ]);
      }
    }
    if (S.warn && (S.mode === 'pvp' || T === 0) && isKingAttacked(s, T)) {
      msgs.push(['danger', (S.mode === 'ai' ? '내' : pname(T)) + ' 왕이 위험해요! 왕을 피하거나 상대 말을 잡으세요.']);
    }
    if (G.busy) msgs.push(['hint', '컴퓨터가 생각하고 있어요...']);
    else if (G.sel && G.sel.kind === 'board') msgs.push(['hint', '점이 찍힌 칸으로 움직일 수 있어요. (빨간 테두리는 잡을 수 있는 말)']);
    else if (G.sel && G.sel.kind === 'hand') msgs.push(['hint', '내려놓을 빈칸을 눌러요.']);
    else msgs.push(['hint', '움직일 말이나 포로를 눌러서 골라요.']);
  } else {
    msgs.push(['hint', '"되돌리기"로 한 수 물러서 다시 둘 수 있어요.']);
  }
  $('msgBox').innerHTML = msgs.map(function (m) { return '<div class="msg ' + m[0] + '">' + m[1] + '</div>'; }).join('');
  const lv = { easy: '쉬움', normal: '보통', hard: '어려움' }[S.level];
  $('info').textContent = S.mode === 'ai' ? '컴퓨터 대결 · ' + lv : '2명이 함께';
}

/* ---------- 규칙 / 장식 ---------- */
function buildHelp() {
  const info = [
    ['wang', '왕(王)', '모든 방향 1칸. 잡히면 져요.'],
    ['jang', '장(將)', '앞, 뒤, 왼쪽, 오른쪽 1칸.'],
    ['sang', '상(相)', '대각선 4방향 1칸.'],
    ['ja', '자(子)', '앞으로만 1칸.'],
    ['hu', '후(侯)', '자가 상대 진영에 들어가면 변신. 대각선 뒤만 빼고 모두 1칸.']
  ];
  $('helpPieces').innerHTML = info.map(function (x) {
    return '<div class="help-piece">' + pieceSVG({ t: x[0], o: 0 }, { dirs: true, noFlip: true }) +
      '<div><b>' + x[1] + '</b><br>' + x[2] + '</div></div>';
  }).join('');
}

function buildDeco() {
  $('deco').innerHTML = ['sang', 'wang', 'jang', 'ja'].map(function (t, i) {
    return pieceSVG({ t: t, o: i % 2 === 0 ? 0 : 0 }, { dirs: false, noFlip: true });
  }).join('');
}

/* ---------- 초기화 ---------- */
function init() {
  buildHelp();
  buildDeco();

  $('btnToSettings').onclick = function () { go('settings'); };
  $('btnMainHelp').onclick = function () { $('helpModal').classList.remove('hidden'); };
  $('btnGameHelp').onclick = function () { $('helpModal').classList.remove('hidden'); };
  $('helpClose').onclick = function () { $('helpModal').classList.add('hidden'); };
  $('btnSetBack').onclick = function () { go('main'); };
  $('btnStart').onclick = function () { go('game'); startGame(); };

  document.querySelectorAll('[data-tip-next]').forEach(function (b) {
    b.onclick = function () { showTip(b.dataset.tipNext); };
  });

  document.querySelectorAll('.opt-group').forEach(function (g) {
    g.addEventListener('click', function (e) {
      const b = e.target.closest('button');
      if (!b) return;
      S[g.dataset.key] = b.dataset.val;
      saveSettings();
      syncSettingsUI();
    });
  });
  $('optWarn').onchange = function (e) { S.warn = e.target.checked; saveSettings(); if (G.state) render(); };
  $('optDirs').onchange = function (e) { S.dirs = e.target.checked; saveSettings(); };
  $('optFlip').onchange = function (e) { S.flip = e.target.checked; saveSettings(); };

  $('board').addEventListener('click', function (e) {
    const cell = e.target.closest('.cell');
    if (cell) onCell(+cell.dataset.r, +cell.dataset.c);
  });
  ['tray0', 'tray1'].forEach(function (id) {
    $(id).addEventListener('click', function (e) {
      const h = e.target.closest('.hand-piece');
      if (h) onHand(+h.dataset.p, +h.dataset.i);
    });
  });

  $('btnUndo').onclick = undo;
  $('btnRestart').onclick = startGame;
  $('btnGameSettings').onclick = function () { G.token++; G.busy = false; go('settings'); };
  $('btnGameMain').onclick = function () { G.token++; G.busy = false; go('main'); };

  $('resAgain').onclick = startGame;
  $('resView').onclick = function () { $('overlay').classList.add('hidden'); };
  $('resSettings').onclick = function () { $('overlay').classList.add('hidden'); go('settings'); };
  $('resMain').onclick = function () { $('overlay').classList.add('hidden'); go('main'); };

  go('main');
}

if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', init);
if (typeof module !== 'undefined') {
  module.exports = { createInitialState, genMoves, applyMove, posKey, chooseMove, isKingAttacked, kingInRow, HOME_ROW };
}
