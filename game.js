/* 십이장기 - game.js */
(function () {
  'use strict';

  /* ===================== 규칙 / 엔진 ===================== */
  var GLYPH = { J: '將', S: '相', W: '王', Z: '子', H: '侯' };
  var DIRS = {
    J: [[-1, 0], [1, 0], [0, -1], [0, 1]],
    S: [[-1, -1], [-1, 1], [1, -1], [1, 1]],
    W: [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [-1, 1], [1, -1], [1, 1]],
    Z: [[-1, 0]],
    H: [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [-1, 1]]
  };
  var OPP = { R: 'B', B: 'R' };
  var ENEMY_ROW = { R: 0, B: 3 };
  var TEAM = { R: '홍팀', B: '청팀' };

  function newState(first) {
    var b = [];
    for (var i = 0; i < 12; i++) b.push(null);
    b[9] = 'RS'; b[10] = 'RW'; b[11] = 'RJ'; b[7] = 'RZ';
    b[0] = 'BJ'; b[1] = 'BW'; b[2] = 'BS'; b[4] = 'BZ';
    return { b: b, h: { R: [], B: [] }, turn: first, pend: { R: false, B: false }, winner: null, reason: null };
  }

  function genMoves(st) {
    var p = st.turn, sign = p === 'R' ? 1 : -1, out = [], b = st.b, i, j, k;
    for (i = 0; i < 12; i++) {
      var c = b[i];
      if (!c || c.charAt(0) !== p) continue;
      var ds = DIRS[c.charAt(1)], r = (i / 3) | 0, col = i % 3;
      for (k = 0; k < ds.length; k++) {
        var nr = r + ds[k][0] * sign, nc = col + ds[k][1];
        if (nr < 0 || nr > 3 || nc < 0 || nc > 2) continue;
        j = nr * 3 + nc;
        if (b[j] && b[j].charAt(0) === p) continue;
        out.push({ k: 'm', f: i, t: j });
      }
    }
    var seen = {};
    for (k = 0; k < st.h[p].length; k++) {
      var t = st.h[p][k];
      if (seen[t]) continue;
      seen[t] = 1;
      for (j = 0; j < 12; j++) {
        if (b[j]) continue;
        if (((j / 3) | 0) === ENEMY_ROW[p]) continue;
        out.push({ k: 'd', p: t, t: j });
      }
    }
    return out;
  }

  function kingInEnemy(st, p) {
    for (var i = 0; i < 12; i++) {
      if (st.b[i] === p + 'W') return ((i / 3) | 0) === ENEMY_ROW[p];
    }
    return false;
  }

  function applyMove(st, mv) {
    var p = st.turn, q = OPP[p];
    var n = {
      b: st.b.slice(),
      h: { R: st.h.R.slice(), B: st.h.B.slice() },
      turn: q,
      pend: { R: st.pend.R, B: st.pend.B },
      winner: null, reason: null
    };
    if (mv.k === 'm') {
      var pc = n.b[mv.f], cap = n.b[mv.t], t = pc.charAt(1);
      if (t === 'Z' && ((mv.t / 3) | 0) === ENEMY_ROW[p]) t = 'H';
      n.b[mv.f] = null;
      n.b[mv.t] = p + t;
      if (cap) {
        var ct = cap.charAt(1);
        if (ct === 'W') { n.winner = p; n.reason = 'capture'; return n; }
        n.h[p].push(ct === 'H' ? 'Z' : ct);
      }
    } else {
      var idx = n.h[p].indexOf(mv.p);
      n.h[p].splice(idx, 1);
      n.b[mv.t] = p + mv.p;
    }
    if (n.pend[q] && kingInEnemy(n, q)) { n.winner = q; n.reason = 'hold'; return n; }
    n.pend[p] = kingInEnemy(n, p);
    return n;
  }

  function stateKey(st) {
    return st.b.map(function (x) { return x || '--'; }).join('') + '|' +
      st.h.R.slice().sort().join('') + '|' + st.h.B.slice().sort().join('') + '|' +
      st.turn + (st.pend.R ? 1 : 0) + (st.pend.B ? 1 : 0);
  }

  function isAttacked(st, p) {
    var ki = st.b.indexOf(p + 'W');
    if (ki < 0) return false;
    var tmp = { b: st.b, h: st.h, turn: OPP[p], pend: st.pend, winner: null };
    var ms = genMoves(tmp);
    for (var i = 0; i < ms.length; i++) if (ms[i].k === 'm' && ms[i].t === ki) return true;
    return false;
  }

  /* ===================== 컴퓨터 ===================== */
  var VAL = { J: 30, S: 30, Z: 12, H: 26, W: 0 };
  var WIN = 100000;
  var TIMEOUT = { timeout: true };

  function evalState(st) {
    var me = st.turn, s = 0, i, c, o, t, v, r, adv;
    for (i = 0; i < 12; i++) {
      c = st.b[i];
      if (!c) continue;
      o = c.charAt(0); t = c.charAt(1);
      v = VAL[t]; r = (i / 3) | 0;
      adv = o === 'R' ? 3 - r : r;
      if (t === 'Z' || t === 'H') v += adv * 3;
      else if (t === 'W') v += adv * 4;
      else v += adv * 0.5;
      s += (o === me) ? v : -v;
    }
    var k;
    for (k = 0; k < st.h[me].length; k++) s += VAL[st.h[me][k]] * 0.9;
    for (k = 0; k < st.h[OPP[me]].length; k++) s -= VAL[st.h[OPP[me]][k]] * 0.9;
    return s;
  }

  function orderMoves(st, moves) {
    var scored = moves.map(function (m) {
      var sc = 0;
      if (m.k === 'm') {
        var cap = st.b[m.t];
        if (cap) sc = cap.charAt(1) === 'W' ? 100000 : 100 + VAL[cap.charAt(1)];
        var pc = st.b[m.f];
        if (pc.charAt(1) === 'Z' && ((m.t / 3) | 0) === ENEMY_ROW[st.turn]) sc += 40;
      } else sc = -5;
      return { m: m, s: sc };
    });
    scored.sort(function (a, b) { return b.s - a.s; });
    return scored.map(function (x) { return x.m; });
  }

  function search(st, depth, alpha, beta, ply, ctx) {
    if (st.winner) return st.winner === st.turn ? (WIN - ply) : -(WIN - ply);
    if (depth <= 0) return evalState(st);
    if (ctx && ((++ctx.n) & 511) === 0 && Date.now() > ctx.dl) throw TIMEOUT;
    var moves = orderMoves(st, genMoves(st));
    if (!moves.length) return 0;
    var best = -Infinity;
    for (var i = 0; i < moves.length; i++) {
      var v = -search(applyMove(st, moves[i]), depth - 1, -beta, -alpha, ply + 1, ctx);
      if (v > best) best = v;
      if (v > alpha) alpha = v;
      if (alpha >= beta) break;
    }
    return best;
  }

  function pickRandom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  function bestAtDepth(st, moves, depth, tol) {
    var scores = [], best = -Infinity, i;
    for (i = 0; i < moves.length; i++) {
      var v = -search(applyMove(st, moves[i]), depth - 1, -Infinity, Infinity, 1, null);
      scores.push(v);
      if (v > best) best = v;
    }
    var pool = [];
    for (i = 0; i < moves.length; i++) if (scores[i] >= best - tol) pool.push(moves[i]);
    return pickRandom(pool);
  }

  function hardSearch(st, maxDepth, limitMs) {
    var moves = orderMoves(st, genMoves(st));
    var ctx = { n: 0, dl: Date.now() + limitMs };
    var result = moves[0];
    for (var d = 1; d <= maxDepth; d++) {
      try {
        var scores = [], best = -Infinity, i;
        for (i = 0; i < moves.length; i++) {
          var v = -search(applyMove(st, moves[i]), d - 1, -Infinity, -(best - 1), 1, ctx);
          scores.push(v);
          if (v > best) best = v;
        }
        var pool = [], ranked = [];
        for (i = 0; i < moves.length; i++) {
          if (scores[i] >= best - 0.5) pool.push(moves[i]);
          ranked.push({ m: moves[i], s: scores[i] });
        }
        result = pickRandom(pool);
        ranked.sort(function (a, b) { return b.s - a.s; });
        moves = ranked.map(function (x) { return x.m; });
        if (best > WIN - 50) break;
      } catch (e) {
        if (e === TIMEOUT) break;
        throw e;
      }
    }
    return result;
  }

  function chooseMove(st, level) {
    var moves = genMoves(st);
    if (!moves.length) return null;
    if (level === 'easy') {
      if (Math.random() < 0.3) return pickRandom(moves);
      return bestAtDepth(st, moves, 1, 0.01);
    }
    if (level === 'normal') return bestAtDepth(st, moves, 3, 0.01);
    return hardSearch(st, 9, 1400);
  }

  /* ===================== 화면 ===================== */
  var TIPS = [
    '잡은 말은 내 말이 돼요! 포로칸에서 꺼내서 내가 원하는 빈칸에 내려놓을 수 있어요. 상대 말을 다 잡는 게 목표가 아니라, 왕을 잡는 게 목표예요.',
    '내 차례에 빨리 두면, 상대가 고민하는 동안 나도 다음 수를 미리 생각할 수 있어요. 하지만 너무 서두르면 실수하니까 조심하세요.',
    '일부러 잡힐 수 있는 곳에 말을 내려놓아 보세요. 상대 말이 앞으로 나오면, 그 말을 다시 잡아서 이득을 볼 수 있어요.',
    '상(相)을 가로로 나란히 놓아 보세요. 장은 두 칸밖에 못 지키지만, 대각선으로 가는 상은 세 칸을 모두 막을 수 있어요.',
    '왕(王)도 앞으로 나갈 수 있어요! 왕이 앞에 서면 다른 말을 지켜 주고, 상대에게 부담을 줘요. 하지만 잡히면 지니까 조심하세요.',
    '가끔은 상대가 생각하지 못한 수를 두면 상대가 당황해요. 하지만 아무 뜻 없는 수는 손해가 될 수 있으니, 이유가 있는 수를 두세요.',
    '내 왕이 상대 진영에 들어가서 한 번 버티면 이겨요. 왕 주변을 상대가 못 잡게 막아 두면 작전 성공!',
    '자(子)가 상대 진영에 들어가면 후(侯)로 변신해서 더 많은 방향으로 갈 수 있어요. 하지만 후를 잡히면 다시 자가 되어 상대 포로가 돼요.'
  ];

  var RULES_HTML =
    '<ul>' +
    '<li><b>판</b> 가로 3칸, 세로 4칸이에요. 각자 앞쪽 한 줄이 내 진영이고, 가운데 두 줄은 중립 지대예요.</li>' +
    '<li><b>장(將)</b> 앞, 뒤, 왼쪽, 오른쪽으로 한 칸씩 가요.</li>' +
    '<li><b>상(相)</b> 대각선 네 방향으로 한 칸씩 가요.</li>' +
    '<li><b>왕(王)</b> 여덟 방향 모두 한 칸씩 가요.</li>' +
    '<li><b>자(子)</b> 앞으로만 한 칸 가요. 상대 진영에 들어가면 <b>후(侯)</b>로 변신해요.</li>' +
    '<li><b>후(侯)</b> 대각선 뒤쪽만 빼고 모든 방향으로 한 칸씩 가요.</li>' +
    '<li><b>잡기</b> 상대 말이 있는 칸으로 가면 잡아요. 잡은 말은 내 포로가 돼요. 후를 잡으면 자로 바뀌어요.</li>' +
    '<li><b>내려놓기</b> 포로를 내 말로 내려놓는 것도 한 번의 차례예요. 빈칸이면 되지만 상대 진영에는 놓을 수 없어요. 쓰기 싫으면 안 써도 돼요.</li>' +
    '<li><b>말은 돌릴 수 없어요.</b> 내려놓은 말은 항상 상대를 바라봐요.</li>' +
    '<li><b>승리 1</b> 상대 왕을 잡으면 이겨요.</li>' +
    '<li><b>승리 2</b> 내 왕이 상대 진영에 들어가서, 상대가 한 번 둔 뒤에도 잡히지 않으면 이겨요. 말을 잡으면서 들어가도 똑같아요.</li>' +
    '<li><b>무승부</b> 같은 모양이 세 번 나오면 비겨요.</li>' +
    '</ul>';

  var DEFAULTS = { mode: 'cpu', diff: 'normal', first: 'R', warn: true, dots: true, flip: false };
  var S = {};
  var G = null;
  var $ = function (id) { return document.getElementById(id); };
  var tipLast = -1;
  var resultTimer = null;

  function loadSettings() {
    var saved = {};
    try { saved = JSON.parse(localStorage.getItem('sibijang_settings') || '{}') || {}; } catch (e) { saved = {}; }
    for (var k in DEFAULTS) S[k] = (saved[k] === undefined) ? DEFAULTS[k] : saved[k];
  }
  function saveSettings() {
    try { localStorage.setItem('sibijang_settings', JSON.stringify(S)); } catch (e) { /* 무시 */ }
  }

  function showScreen(name) {
    ['main', 'setup', 'game'].forEach(function (n) { $('screen-' + n).hidden = (n !== name); });
    $('modal-rules').hidden = true;
    $('modal-result').hidden = true;
    if (name === 'setup') renderOptions();
  }

  function newTip(elId) {
    var i;
    do { i = Math.floor(Math.random() * TIPS.length); } while (i === tipLast && TIPS.length > 1);
    tipLast = i;
    $(elId).textContent = TIPS[i];
  }

  function makeBtn(cls, text, handler) {
    var b = document.createElement('button');
    b.className = cls;
    b.textContent = text;
    b.addEventListener('click', handler);
    return b;
  }

  function fillGroup(id, items, current, onPick) {
    var box = $(id);
    box.innerHTML = '';
    items.forEach(function (it) {
      box.appendChild(makeBtn('opt' + (it[0] === current ? ' on' : ''), it[1], function () { onPick(it[0]); }));
    });
  }

  function renderOptions() {
    var cpu = S.mode === 'cpu';
    fillGroup('opt-mode', [['cpu', '컴퓨터와 대결'], ['hot', '둘이서 대결']], S.mode, function (v) { S.mode = v; saveSettings(); renderOptions(); });
    $('row-diff').hidden = !cpu;
    fillGroup('opt-diff', [['easy', '쉬움'], ['normal', '보통'], ['hard', '어려움']], S.diff, function (v) { S.diff = v; saveSettings(); renderOptions(); });
    fillGroup('opt-first',
      cpu ? [['R', '내가 먼저'], ['B', '컴퓨터 먼저'], ['rand', '무작위']] : [['R', '홍팀 먼저'], ['B', '청팀 먼저'], ['rand', '무작위']],
      S.first, function (v) { S.first = v; saveSettings(); renderOptions(); });
    var box = $('opt-help');
    box.innerHTML = '';
    [['warn', '왕이 위험하면 알려 주기'], ['dots', '말에 이동 방향 점 보기'], ['flip', '위쪽 말 글자 뒤집기 (둘이서 대결)']].forEach(function (it) {
      box.appendChild(makeBtn('opt' + (S[it[0]] ? ' on' : ''), (S[it[0]] ? '켜짐 · ' : '꺼짐 · ') + it[1], function () {
        S[it[0]] = !S[it[0]]; saveSettings(); renderOptions();
      }));
    });
  }

  /* ---------- 게임 진행 ---------- */
  function startGame() {
    if (G) G.id++;
    clearTimeout(resultTimer);
    var first = S.first === 'rand' ? (Math.random() < 0.5 ? 'R' : 'B') : S.first;
    var st = newState(first);
    var counts = {};
    counts[stateKey(st)] = 1;
    G = {
      id: (G ? G.id : 0) + 1,
      cfg: { mode: S.mode, diff: S.diff },
      state: st, hist: [], counts: counts,
      sel: null, last: null, anim: -1, over: null, thinking: false
    };
    showScreen('game');
    renderGame();
    maybeAI();
  }

  function isHumanTurn() {
    if (!G || G.over || G.thinking) return false;
    return G.cfg.mode === 'hot' || G.state.turn === 'R';
  }

  function commit(mv) {
    G.hist.push({ state: G.state, counts: Object.assign({}, G.counts), last: G.last });
    var ns = applyMove(G.state, mv);
    G.state = ns; G.last = mv; G.anim = mv.t; G.sel = null;
    if (ns.winner) {
      G.over = { type: 'win', winner: ns.winner, reason: ns.reason };
    } else {
      var key = stateKey(ns);
      G.counts[key] = (G.counts[key] || 0) + 1;
      if (G.counts[key] >= 3) G.over = { type: 'draw', reason: 'repeat' };
    }
    renderGame();
    if (G.over) {
      var id = G.id;
      resultTimer = setTimeout(function () { if (G && G.id === id) showResult(); }, 700);
      return;
    }
    maybeAI();
  }

  function maybeAI() {
    if (!G || G.over || G.cfg.mode !== 'cpu' || G.state.turn !== 'B') return;
    G.thinking = true;
    renderGame();
    var id = G.id;
    setTimeout(function () {
      if (!G || G.id !== id || G.over) return;
      var mv = chooseMove(G.state, G.cfg.diff);
      G.thinking = false;
      if (mv) commit(mv); else renderGame();
    }, 550);
  }

  function undo() {
    if (!G || G.thinking) return;
    var k = -1, i;
    if (G.cfg.mode === 'cpu') {
      for (i = G.hist.length - 1; i >= 0; i--) { if (G.hist[i].state.turn === 'R') { k = i; break; } }
    } else k = G.hist.length - 1;
    if (k < 0) return;
    var h = G.hist[k];
    G.id++;
    clearTimeout(resultTimer);
    G.state = h.state; G.counts = h.counts; G.last = h.last;
    G.hist.length = k;
    G.over = null; G.sel = null; G.anim = -1; G.thinking = false;
    $('modal-result').hidden = true;
    renderGame();
  }

  function onCell(i) {
    if (!isHumanTurn()) return;
    var st = G.state, p = st.turn, moves = genMoves(st), sel = G.sel, j;
    if (sel) {
      for (j = 0; j < moves.length; j++) {
        var m = moves[j];
        if (m.t !== i) continue;
        if (sel.k === 'c' && m.k === 'm' && m.f === sel.i) { commit(m); return; }
        if (sel.k === 'h' && m.k === 'd' && m.p === st.h[p][sel.idx]) { commit(m); return; }
      }
    }
    var c = st.b[i];
    if (c && c.charAt(0) === p && !(sel && sel.k === 'c' && sel.i === i)) G.sel = { k: 'c', i: i };
    else G.sel = null;
    renderGame();
  }

  function onHand(p, idx) {
    if (!isHumanTurn() || G.state.turn !== p) return;
    if (G.sel && G.sel.k === 'h' && G.sel.idx === idx) G.sel = null;
    else G.sel = { k: 'h', idx: idx };
    renderGame();
  }

  /* ---------- 그리기 ---------- */
  function makePiece(code) {
    var o = code.charAt(0), t = code.charAt(1);
    var el = document.createElement('div');
    el.className = 'piece ' + (o === 'R' ? 'red' : 'blue') + ' t-' + t +
      ((S.flip && G && G.cfg.mode === 'hot' && o === 'B') ? ' flip' : '');
    var g = document.createElement('span');
    g.className = 'glyph';
    g.textContent = GLYPH[t];
    el.appendChild(g);
    if (S.dots) {
      var sign = o === 'R' ? 1 : -1;
      DIRS[t].forEach(function (d) {
        var dot = document.createElement('i');
        dot.className = 'dot';
        dot.style.left = (50 + d[1] * 30) + '%';
        dot.style.top = (50 + d[0] * sign * 30) + '%';
        el.appendChild(dot);
      });
    }
    return el;
  }

  function renderBoard() {
    var st = G.state, board = $('board');
    board.innerHTML = '';
    var human = isHumanTurn(), moves = human ? genMoves(st) : [], targets = {}, sel = G.sel;
    if (human && sel) {
      moves.forEach(function (m) {
        if (sel.k === 'c' && m.k === 'm' && m.f === sel.i) targets[m.t] = true;
        if (sel.k === 'h' && m.k === 'd' && m.p === st.h[st.turn][sel.idx]) targets[m.t] = true;
      });
    }
    var dangerIdx = -1;
    if (human && S.warn && isAttacked(st, st.turn)) dangerIdx = st.b.indexOf(st.turn + 'W');
    for (var i = 0; i < 12; i++) {
      (function (i) {
        var row = (i / 3) | 0, c = st.b[i];
        var cls = 'cell' + (row === 3 ? ' camp-r' : row === 0 ? ' camp-b' : '');
        if (targets[i]) cls += c ? ' capture' : ' target';
        if (sel && sel.k === 'c' && sel.i === i) cls += ' sel';
        if (G.last && (G.last.t === i || (G.last.k === 'm' && G.last.f === i))) cls += ' last';
        var cell = document.createElement('div');
        cell.className = cls;
        if (c) {
          var pe = makePiece(c);
          if (G.anim === i) pe.className += ' land';
          if (dangerIdx === i) pe.className += ' danger';
          cell.appendChild(pe);
        }
        cell.addEventListener('click', function () { onCell(i); });
        board.appendChild(cell);
      })(i);
    }
    G.anim = -1;
  }

  function renderHand(elId, p) {
    var el = $(elId), st = G.state;
    el.innerHTML = '';
    var active = !G.over && st.turn === p;
    el.className = 'hand ' + (p === 'B' ? 'top ' : 'bottom ') + (p === 'R' ? 'red' : 'blue') + (active ? ' active' : '');
    var lab = document.createElement('div');
    lab.className = 'hand-label';
    lab.textContent = TEAM[p] + ' 포로';
    el.appendChild(lab);
    var slots = document.createElement('div');
    slots.className = 'slots';
    if (!st.h[p].length) {
      var em = document.createElement('span');
      em.className = 'empty';
      em.textContent = '비어 있어요';
      slots.appendChild(em);
    }
    st.h[p].forEach(function (t, idx) {
      var slot = document.createElement('div');
      slot.className = 'slot' + (G.sel && G.sel.k === 'h' && G.sel.idx === idx && st.turn === p ? ' sel' : '');
      slot.appendChild(makePiece(p + t));
      slot.addEventListener('click', function () { onHand(p, idx); });
      slots.appendChild(slot);
    });
    el.appendChild(slots);
  }

  function renderBanner() {
    var st = G.state, main, sub = [];
    if (G.over) {
      main = G.over.type === 'draw' ? '무승부로 끝났어요' : '대국이 끝났어요';
    } else if (G.cfg.mode === 'cpu') {
      main = st.turn === 'R' ? '내 차례예요 (홍팀)' : (G.thinking ? '컴퓨터가 생각하고 있어요…' : '컴퓨터 차례 (청팀)');
    } else {
      main = TEAM[st.turn] + ' 차례예요';
    }
    if (!G.over) {
      ['R', 'B'].forEach(function (p) {
        if (st.pend[p] && st.turn === OPP[p]) {
          sub.push(TEAM[p] + ' 왕이 적진에 들어갔어요! 이번에 잡지 못하면 ' + TEAM[p] + ' 승리');
        }
      });
      if (isHumanTurn() && S.warn && isAttacked(st, st.turn)) sub.push('왕이 위험해요! 지켜 주세요');
      if (!sub.length) {
        if (isHumanTurn()) sub.push(G.sel ? '움직일 곳을 눌러 보세요' : '말이나 포로를 눌러 보세요');
        else sub.push(' ');
      }
    } else sub.push(' ');
    $('banner-main').textContent = main;
    $('banner-sub').textContent = sub.join(' / ');
    $('btn-show-result').hidden = !G.over;
    $('banner').className = 'banner' + (G.over ? ' over' : (st.turn === 'R' ? ' r' : ' b'));
  }

  function renderGame() {
    renderBanner();
    renderBoard();
    renderHand('hand-top', 'B');
    renderHand('hand-bottom', 'R');
  }

  /* ---------- 결과 ---------- */
  function showResult() {
    if (!G || !G.over) return;
    var o = G.over, emblem, title, text;
    var reasonText = o.reason === 'capture' ? '상대 왕을 잡았어요.' : '왕이 적진에서 한 번 버텨냈어요.';
    var win = false;
    if (o.type === 'draw') {
      emblem = '和'; title = '무승부'; text = '같은 모양이 세 번 나왔어요. 승부는 다음 판에서!';
    } else if (G.cfg.mode === 'cpu') {
      if (o.winner === 'R') { emblem = '勝'; title = '이겼어요!'; text = reasonText; win = true; }
      else { emblem = '敗'; title = '아쉽게 졌어요'; text = '컴퓨터가 이겼어요. ' + reasonText + ' 다시 도전해 봐요!'; }
    } else {
      emblem = '勝'; title = TEAM[o.winner] + ' 승리!'; text = reasonText; win = true;
    }
    $('result-emblem').textContent = emblem;
    $('result-title').textContent = title;
    $('result-text').textContent = text;
    var petals = $('petals');
    petals.innerHTML = '';
    if (win) {
      for (var i = 0; i < 28; i++) {
        var p = document.createElement('span');
        p.className = 'petal' + (i % 2 ? ' rose' : '');
        p.style.left = Math.floor(Math.random() * 100) + '%';
        p.style.animationDelay = (Math.random() * 3).toFixed(2) + 's';
        p.style.animationDuration = (4 + Math.random() * 3).toFixed(2) + 's';
        petals.appendChild(p);
      }
    }
    $('modal-result').hidden = false;
  }

  /* ---------- 초기화 ---------- */
  function buildHelp() {
    $('rules-body').innerHTML = RULES_HTML;
  }

  function init() {
    loadSettings();
    buildHelp();
    newTip('tip-main');
    newTip('tip-setup');
    $('btn-main-start').addEventListener('click', function () { showScreen('setup'); newTip('tip-setup'); });
    $('btn-main-rules').addEventListener('click', function () { $('modal-rules').hidden = false; });
    $('btn-tip-main').addEventListener('click', function () { newTip('tip-main'); });
    $('btn-tip-setup').addEventListener('click', function () { newTip('tip-setup'); });
    $('btn-setup-back').addEventListener('click', function () { showScreen('main'); newTip('tip-main'); });
    $('btn-setup-start').addEventListener('click', startGame);
    $('btn-g-main').addEventListener('click', function () { if (G) G.id++; showScreen('main'); newTip('tip-main'); });
    $('btn-g-setup').addEventListener('click', function () { if (G) G.id++; showScreen('setup'); newTip('tip-setup'); });
    $('btn-g-undo').addEventListener('click', undo);
    $('btn-g-new').addEventListener('click', startGame);
    $('btn-g-rules').addEventListener('click', function () { $('modal-rules').hidden = false; });
    $('btn-rules-close').addEventListener('click', function () { $('modal-rules').hidden = true; });
    $('btn-show-result').addEventListener('click', showResult);
    $('btn-result-again').addEventListener('click', startGame);
    $('btn-result-view').addEventListener('click', function () { $('modal-result').hidden = true; });
    $('btn-result-setup').addEventListener('click', function () { showScreen('setup'); newTip('tip-setup'); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { $('modal-rules').hidden = true; if (G && G.over) $('modal-result').hidden = true; }
    });
    showScreen('main');
  }

  window.SBJ = {
    core: { newState: newState, genMoves: genMoves, applyMove: applyMove, stateKey: stateKey, chooseMove: chooseMove, kingInEnemy: kingInEnemy, isAttacked: isAttacked },
    ui: { onCell: onCell, onHand: onHand, startGame: startGame, undo: undo, getG: function () { return G; }, settings: S }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
