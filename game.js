/* 십이장기 - 규칙/AI(코어) + 화면(UI) */
(function (root) {
  'use strict';

  var JANG = 1, SANG = 2, WANG = 3, JA = 4, HU = 5;
  var DIRS = {
    1: [[0, 1], [0, -1], [1, 0], [-1, 0]],
    2: [[1, 1], [-1, 1], [1, -1], [-1, -1]],
    3: [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [-1, 1], [1, -1], [-1, -1]],
    4: [[0, 1]],
    5: [[0, 1], [1, 1], [-1, 1], [1, 0], [-1, 0], [0, -1]]
  };
  var VAL = [0, 30, 30, 0, 10, 22];
  var MATE = 100000, INF = 1000000;

  function inZone(o, y) { return o === 0 ? y === 0 : y === 3; }

  function newState(first) {
    var b = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    b[9] = SANG; b[10] = WANG; b[11] = JANG; b[7] = JA;
    b[0] = JANG | 8; b[1] = WANG | 8; b[2] = SANG | 8; b[4] = JA | 8;
    return { b: b, h: [[], []], turn: first, winner: null, last: null };
  }

  function genMoves(s, p) {
    var out = [], b = s.b, i, k;
    for (i = 0; i < 12; i++) {
      var c = b[i];
      if (!c || (c >> 3) !== p) continue;
      var t = c & 7, x = i % 3, y = (i / 3) | 0, ds = DIRS[t];
      for (k = 0; k < ds.length; k++) {
        var nx = x + ds[k][0];
        var ny = y + (p === 0 ? -ds[k][1] : ds[k][1]);
        if (nx < 0 || nx > 2 || ny < 0 || ny > 3) continue;
        var to = ny * 3 + nx, tc = b[to];
        if (tc && (tc >> 3) === p) continue;
        var cap = tc ? (tc & 7) : 0;
        var sc = cap ? (cap === WANG ? 10000 : 100 + VAL[cap] * 3) : 0;
        if (t === JA && inZone(p, ny)) sc += 60;
        if (t === WANG && inZone(p, ny)) sc += 30;
        out.push({ f: i, t: to, c: cap, s: sc });
      }
    }
    var hand = s.h[p], seen = {};
    for (var j = 0; j < hand.length; j++) {
      var ht = hand[j];
      if (seen[ht]) continue;
      seen[ht] = 1;
      for (i = 0; i < 12; i++) {
        if (b[i]) continue;
        if (inZone(p, (i / 3) | 0)) continue;
        out.push({ f: -1, t: i, d: ht, c: 0, s: -1 });
      }
    }
    return out;
  }

  function apply(s, m) {
    var p = s.turn, b = s.b.slice(), h = [s.h[0].slice(), s.h[1].slice()], winner = null, cap = 0;
    if (m.f < 0) {
      h[p].splice(h[p].indexOf(m.d), 1);
      b[m.t] = m.d | (p << 3);
    } else {
      var t = b[m.f] & 7, tc = b[m.t];
      if (tc) {
        cap = tc & 7;
        if (cap === WANG) winner = p;
        else h[p].push(cap === HU ? JA : cap);
      }
      if (t === JA && inZone(p, (m.t / 3) | 0)) t = HU;
      b[m.f] = 0;
      b[m.t] = t | (p << 3);
    }
    if (winner === null) {
      var o = 1 - p, ki = b.indexOf(WANG | (o << 3));
      if (ki >= 0 && inZone(o, (ki / 3) | 0)) winner = o;
    }
    return { b: b, h: h, turn: 1 - p, winner: winner, last: { f: m.f, t: m.t, c: cap } };
  }

  function key(s) {
    return s.b.join(',') + '|' + s.h[0].slice().sort().join('') + '|' + s.h[1].slice().sort().join('') + '|' + s.turn;
  }
  function kingIndex(s, p) { return s.b.indexOf(WANG | (p << 3)); }
  function kingInZone(s, p) { var k = kingIndex(s, p); return k >= 0 && inZone(p, (k / 3) | 0); }
  function kingAttacked(s, p) {
    var k = kingIndex(s, p);
    if (k < 0) return false;
    var ms = genMoves(s, 1 - p);
    for (var i = 0; i < ms.length; i++) if (ms[i].f >= 0 && ms[i].t === k) return true;
    return false;
  }

  function evaluate(s, p) {
    var sc = 0, i, b = s.b;
    for (i = 0; i < 12; i++) {
      var c = b[i];
      if (!c) continue;
      var o = c >> 3, t = c & 7, y = (i / 3) | 0;
      var prog = o === 0 ? 3 - y : y;
      var v = VAL[t];
      if (t === JA || t === HU) v += prog * 3;
      else if (t === WANG) v += prog * 4;
      else v += prog;
      sc += (o === p) ? v : -v;
    }
    for (var q = 0; q < 2; q++) {
      for (var j = 0; j < s.h[q].length; j++) {
        var hv = VAL[s.h[q][j]] * 0.95 + 5;
        sc += (q === p) ? hv : -hv;
      }
    }
    return sc;
  }
  function terminal(s, ply) {
    if (s.winner === 'draw') return 0;
    return s.winner === s.turn ? (MATE - ply) : -(MATE - ply);
  }
  function byScore(a, b) { return b.s - a.s; }

  function qsearch(s, alpha, beta, ply, ctx, qd) {
    if (s.winner !== null) return terminal(s, ply);
    var me = s.turn;
    if (kingInZone(s, 1 - me)) return search(s, 1, alpha, beta, ply, ctx);
    var stand = evaluate(s, me);
    if (stand >= beta) return stand;
    if (stand > alpha) alpha = stand;
    if (qd <= 0) return stand;
    var ms = genMoves(s, me).filter(function (m) { return m.f >= 0 && m.c; });
    ms.sort(byScore);
    for (var i = 0; i < ms.length; i++) {
      var v = -qsearch(apply(s, ms[i]), -beta, -alpha, ply + 1, ctx, qd - 1);
      if (v >= beta) return v;
      if (v > alpha) alpha = v;
    }
    return alpha;
  }

  function search(s, depth, alpha, beta, ply, ctx) {
    if (s.winner !== null) return terminal(s, ply);
    if ((++ctx.nodes & 1023) === 0 && ctx.deadline && Date.now() > ctx.deadline) ctx.abort = true;
    if (ctx.abort) return 0;
    var me = s.turn;
    if (depth <= 0) {
      if (!kingInZone(s, 1 - me)) return ctx.q ? qsearch(s, alpha, beta, ply, ctx, 3) : evaluate(s, me);
      depth = 1;
    }
    var ms = genMoves(s, me);
    if (!ms.length) return -(MATE - ply);
    ms.sort(byScore);
    var best = -INF;
    for (var i = 0; i < ms.length; i++) {
      var v = -search(apply(s, ms[i]), depth - 1, -beta, -alpha, ply + 1, ctx);
      if (ctx.abort) return 0;
      if (v > best) best = v;
      if (v > alpha) alpha = v;
      if (alpha >= beta) break;
    }
    return best;
  }

  function chooseMove(s, level, repCount) {
    var moves = genMoves(s, s.turn);
    if (!moves.length) return null;
    repCount = repCount || function () { return 0; };
    if (level === 'easy' && Math.random() < 0.3) return moves[(Math.random() * moves.length) | 0];

    var kids = moves.map(function (m) { return { m: m, ns: apply(s, m), sc: 0 }; });
    for (var w = 0; w < kids.length; w++) if (kids[w].ns.winner === s.turn) return kids[w].m;

    function scoreKid(k, depth, ctx, alpha) {
      if (k.ns.winner === 'draw') return 0;
      if (repCount(key(k.ns)) >= 2) return 0;
      return -search(k.ns, depth - 1, -INF, -alpha, 1, ctx);
    }

    if (level !== 'hard') {
      var depth = level === 'easy' ? 1 : 3;
      var noise = level === 'easy' ? 6 : 2;
      var ctx = { nodes: 0, q: level !== 'easy', abort: false, deadline: 0 };
      var bestK = null, bestV = -INF;
      kids.forEach(function (k) {
        var v = scoreKid(k, depth, ctx, INF) + Math.random() * noise;
        if (v > bestV) { bestV = v; bestK = k; }
      });
      return bestK.m;
    }

    var start = Date.now(), limit = 1400, bestMove = kids[0].m;
    kids.sort(function (a, b) { return b.m.s - a.m.s; });
    for (var d = 1; d <= 9; d++) {
      var c2 = { nodes: 0, q: true, abort: false, deadline: start + limit };
      var alpha = -INF, curBest = null;
      for (var i = 0; i < kids.length; i++) {
        var v = scoreKid(kids[i], d, c2, alpha);
        if (c2.abort) break;
        kids[i].sc = v;
        if (v > alpha) { alpha = v; curBest = kids[i]; }
      }
      if (c2.abort) break;
      if (curBest) bestMove = curBest.m;
      kids.sort(function (a, b) { return b.sc - a.sc; });
      if (alpha >= MATE - 50) break;
      if (Date.now() - start > limit) break;
    }
    return bestMove;
  }

  var Core = {
    JANG: JANG, SANG: SANG, WANG: WANG, JA: JA, HU: HU, DIRS: DIRS,
    newState: newState, genMoves: genMoves, apply: apply, key: key,
    kingIndex: kingIndex, kingInZone: kingInZone, kingAttacked: kingAttacked,
    chooseMove: chooseMove, evaluate: evaluate, inZone: inZone
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = Core;
  root.JangiCore = Core;

  if (typeof document === 'undefined') return;

  /* ================= 화면 ================= */
  var GLYPH = { 1: '將', 2: '相', 3: '王', 4: '子', 5: '侯' };
  var KO = { 1: '장', 2: '상', 3: '왕', 4: '자', 5: '후' };
  var CLS = { 1: 'jang', 2: 'sang', 3: 'wang', 4: 'ja', 5: 'hu' };

  var TIPS = [
    ['포로 말 다시 쓰기', '잡은 말은 내 편이 돼요! 포로칸의 말을 필요한 곳에 내려놓고 다시 써 보세요. 상대 말을 모두 잡는 게 목표가 아니라, 왕을 잡거나 우리 왕이 버티는 게 목표예요.'],
    ['빠르게 두기', '내 차례에 빨리 두면, 상대가 고민하는 동안 나도 다음 수를 미리 생각할 수 있어요. 대신 너무 서두르면 실수하니까 말이 잡히는지는 꼭 확인해요.'],
    ['미끼 작전', '일부러 잡힐 수 있는 자리에 말을 내려놓으면, 상대 말이 앞으로 끌려 나와요. 미끼를 문 순간 내가 반격할 수 있는지 먼저 살펴봐요.'],
    ['상을 나란히 놓기', '장은 두 칸만 지킬 수 있지만, 대각선으로 가는 상은 가로로 나란히 두면 세 칸을 모두 막을 수 있어요.'],
    ['왕도 앞으로!', '십이장기의 왕은 모든 방향으로 갈 수 있어서 앞으로 나오면 큰 힘이 돼요. 우리 말을 지켜 주고 상대에게 부담도 줘요. 단, 잡히면 끝이니 주변을 잘 살펴요.'],
    ['예상 밖의 수', '상대가 생각하지 못한 수를 두면 당황해서 실수할 수 있어요. 하지만 이유 없는 이상한 수는 오히려 내가 불리해져요. 이유가 있는 깜짝 수를 노려요.'],
    ['버티기 승리', '내 왕이 상대 진영에 들어가서 상대가 한 번 둔 뒤에도 잡히지 않으면 이겨요. 왕 주변에 상대 말이 없을 때 도전해 봐요.'],
    ['자의 변신', '자는 앞으로만 가지만, 상대 진영에 들어가면 후로 변신해서 훨씬 강해져요. 그런데 후를 잡히면 다시 자가 돼요.']
  ];

  var DEF = { mode: 'ai', level: 'normal', first: 'red', warn: true, dots: true, flip: false };
  var cfg = {};
  try { cfg = JSON.parse(localStorage.getItem('jangi12') || '{}') || {}; } catch (e) { cfg = {}; }
  Object.keys(DEF).forEach(function (k) { if (cfg[k] === undefined) cfg[k] = DEF[k]; });
  function saveCfg() { try { localStorage.setItem('jangi12', JSON.stringify(cfg)); } catch (e) {} }

  var G = { st: null, hist: [], keys: [], sel: null, busy: false, token: 0, reason: '', anim: false };

  function $(id) { return document.getElementById(id); }
  function qsa(sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); }

  var lastTip = -1;
  function showTip() {
    var n;
    do { n = (Math.random() * TIPS.length) | 0; } while (n === lastTip && TIPS.length > 1);
    lastTip = n;
    qsa('.tip-title').forEach(function (e) { e.textContent = TIPS[n][0]; });
    qsa('.tip-body').forEach(function (e) { e.textContent = TIPS[n][1]; });
  }
  function show(id) {
    qsa('.screen').forEach(function (s) { s.classList.toggle('active', s.id === id); });
    if (id === 'screen-main' || id === 'screen-setup') showTip();
    if (id === 'screen-setup') syncSetup();
    window.scrollTo(0, 0);
  }
  function openModal(id) { $(id).classList.add('open'); }
  function closeModal(id) { $(id).classList.remove('open'); }

  var LEVEL_NOTE = {
    easy: '한 수 앞만 보고, 가끔은 아무 데나 둬요. 처음 해 보는 친구에게 좋아요.',
    normal: '몇 수 앞을 내다보고 둬요. 실수하면 바로 잡아요.',
    hard: '아주 깊이 생각해요. 포로를 잘 쓰지 않으면 이기기 어려워요.'
  };
  function syncSetup() {
    qsa('#screen-setup .row').forEach(function (row) {
      var k = row.getAttribute('data-key');
      if (k) {
        qsa('#screen-setup .row[data-key="' + k + '"] .seg button').forEach(function (b) {
          b.classList.toggle('on', b.getAttribute('data-val') === String(cfg[k]));
        });
      }
      var only = row.getAttribute('data-only');
      if (only) row.hidden = only !== cfg.mode;
    });
    qsa('#screen-setup .tog').forEach(function (b) {
      b.classList.toggle('on', !!cfg[b.getAttribute('data-tog')]);
      var only = b.getAttribute('data-only');
      if (only) b.hidden = only !== cfg.mode;
    });
    var fb = qsa('#seg-first button');
    if (cfg.mode === 'ai') { fb[0].textContent = '나 (홍팀)'; fb[1].textContent = '컴퓨터 (청팀)'; }
    else { fb[0].textContent = '홍팀 (아래)'; fb[1].textContent = '청팀 (위)'; }
    $('level-note').textContent = LEVEL_NOTE[cfg.level];
  }

  function pieceHTML(code, withDots, extra) {
    var t = code & 7, o = code >> 3, dots = '';
    if (withDots) {
      DIRS[t].forEach(function (d) {
        var dx = d[0], f = d[1];
        var x = f === 0 ? 50 + dx * 36 : (dx === 0 ? 50 : 50 + dx * 32);
        var yr = f > 0 ? (dx === 0 ? 14 : 28) : (f === 0 ? 56 : 88);
        var top = o === 0 ? yr : 100 - yr;
        dots += '<i style="left:' + x + '%;top:' + top + '%"></i>';
      });
    }
    return '<div class="piece ' + (o ? 'blue' : 'red') + ' ' + CLS[t] + (extra ? ' ' + extra : '') + '">' +
      '<span class="shape rim"></span><span class="shape face"></span>' +
      '<span class="txt"><b class="g">' + GLYPH[t] + '</b><em class="k">' + KO[t] + '</em></span>' + dots + '</div>';
  }

  function teamName(p) {
    if (cfg.mode === 'ai') return p === 0 ? '나(홍팀)' : '컴퓨터(청팀)';
    return p === 0 ? '홍팀(아래)' : '청팀(위)';
  }

  function canAct(p) {
    return G.st && G.st.winner === null && !G.busy && G.st.turn === p && (cfg.mode === 'hot' || p === 0);
  }
  function targetsFor(sel) {
    if (!sel || !G.st) return [];
    var p = G.st.turn, st = G.st;
    return genMoves(st, p).filter(function (m) {
      if (sel.kind === 'cell') return m.f === sel.i;
      return m.f < 0 && m.d === st.h[p][sel.j];
    });
  }

  function render() {
    var st = G.st;
    if (!st) return;
    var over = st.winner !== null;
    var targets = targetsFor(G.sel);
    var tmap = {};
    targets.forEach(function (m) { tmap[m.t] = m; });

    var dangerIdx = -1;
    if (cfg.warn && !over && kingAttacked(st, st.turn)) dangerIdx = kingIndex(st, st.turn);

    var html = '';
    for (var i = 0; i < 12; i++) {
      var y = (i / 3) | 0, c = st.b[i];
      var cl = '';
      if (y === 0) cl += ' zb';
      if (y === 3) cl += ' zr';
      if (G.sel && G.sel.kind === 'cell' && G.sel.i === i) cl += ' sel';
      if (tmap[i]) cl += tmap[i].c ? ' cp' : ' tg';
      if (st.last && (st.last.t === i || st.last.f === i)) cl += ' last';
      if (i === dangerIdx) cl += ' danger';
      if ((c && canAct(c >> 3) && (c >> 3) === st.turn) || tmap[i]) cl += ' can';
      var anim = G.anim && st.last && st.last.t === i ? 'land' : '';
      html += '<div class="cell' + cl + '" data-i="' + i + '">' +
        (i === 0 ? '<small class="zl">청 진영</small>' : '') + (i === 9 ? '<small class="zl">홍 진영</small>' : '') +
        (c ? pieceHTML(c, cfg.dots, anim) : '') + '<span class="mark"></span></div>';
    }
    $('board').innerHTML = html;
    G.anim = false;

    for (var p = 0; p < 2; p++) {
      var hand = st.h[p];
      var th = '<div class="t-label"><i class="gem"></i>' + teamName(p) + '의 포로</div><div class="t-slots">';
      if (!hand.length) th += '<span class="empty">잡은 말이 없어요</span>';
      hand.forEach(function (t, j) {
        var sel = G.sel && G.sel.kind === 'hand' && G.sel.j === j && st.turn === p;
        th += '<div class="hp' + (sel ? ' sel' : '') + (canAct(p) ? ' can' : '') + '" data-p="' + p + '" data-j="' + j + '">' + pieceHTML(t | (p << 3), false) + '</div>';
      });
      th += '</div>';
      $('tray-' + p).innerHTML = th;
      $('tray-' + p).classList.toggle('turn', !over && st.turn === p);
    }

    renderBanner(over);
    $('btn-undo').disabled = undoIndex() < 0;
    $('screen-play').classList.toggle('flip-top', cfg.mode === 'hot' && !!cfg.flip);
    $('btn-result').hidden = !over;
  }

  function renderBanner(over) {
    var st = G.st, b = $('banner'), title, msg;
    b.classList.remove('red', 'blue', 'end', 'alert');
    if (over) {
      b.classList.add('end');
      if (st.winner === 'draw') { title = '무승부'; msg = '같은 모양이 세 번 나왔어요.'; }
      else { title = teamName(st.winner) + ' 승리!'; msg = reasonText(); b.classList.add(st.winner === 0 ? 'red' : 'blue'); }
      $('b-title').textContent = title; $('b-msg').textContent = msg;
      return;
    }
    var t = st.turn;
    b.classList.add(t === 0 ? 'red' : 'blue');
    if (G.busy) { title = '컴퓨터가 생각 중이에요'; msg = '잠깐만 기다려 주세요.'; }
    else {
      title = (cfg.mode === 'ai' && t === 0) ? '내 차례예요' : teamName(t) + ' 차례';
      msg = G.sel ? '점이 찍힌 칸으로 갈 수 있어요. 붉은 테두리는 잡을 수 있는 말이에요.' : '움직일 말이나 포로를 눌러 보세요.';
    }
    var opp = 1 - t;
    if (kingInZone(st, opp)) {
      msg = teamName(opp) + ' 왕이 우리 진영에 들어왔어요! 이번에 잡지 못하면 ' + teamName(opp) + '이 이겨요.';
      b.classList.add('alert');
    } else if (cfg.warn && kingAttacked(st, t) && !G.busy) {
      msg = '왕이 위험해요! 다음 수에 잡힐 수 있어요.';
      b.classList.add('alert');
    }
    $('b-title').textContent = title;
    $('b-msg').textContent = msg;
  }
  function reasonText() {
    if (G.reason === 'capture') return '상대의 왕을 잡았어요!';
    if (G.reason === 'hold') return '왕이 상대 진영에서 한 번의 차례를 버텼어요!';
    if (G.reason === 'stuck') return '상대가 둘 수 있는 수가 없어요.';
    return '';
  }

  function keyCount(k) { var n = 0; for (var i = 0; i < G.keys.length; i++) if (G.keys[i] === k) n++; return n; }

  function undoIndex() {
    if (!G.hist.length) return -1;
    if (cfg.mode !== 'ai') return G.hist.length - 1;
    for (var i = G.hist.length - 1; i >= 0; i--) if (G.hist[i].st.turn === 0) return i;
    return -1;
  }

  function newGame() {
    G.token++;
    var first = cfg.first === 'random' ? ((Math.random() * 2) | 0) : (cfg.first === 'red' ? 0 : 1);
    G.st = newState(first);
    G.hist = []; G.keys = [key(G.st)]; G.sel = null; G.busy = false; G.reason = '';
    closeModal('modal-result');
    render();
    maybeAI();
  }

  function commit(m) {
    G.hist.push({ st: G.st, keys: G.keys.slice(), reason: G.reason });
    var mover = G.st.turn;
    var ns = apply(G.st, m);
    G.keys.push(key(ns));
    G.sel = null; G.anim = true; G.reason = '';
    if (ns.winner !== null) {
      G.reason = ns.last.c === WANG ? 'capture' : 'hold';
    } else if (keyCount(key(ns)) >= 3) {
      ns.winner = 'draw'; G.reason = 'rep';
    } else if (genMoves(ns, ns.turn).length === 0) {
      ns.winner = mover; G.reason = 'stuck';
    }
    G.st = ns;
    render();
    if (ns.winner !== null) {
      var tk = G.token;
      setTimeout(function () { if (tk === G.token && G.st.winner !== null) showResult(); }, 700);
    } else maybeAI();
  }

  function maybeAI() {
    if (!G.st || G.st.winner !== null) return;
    if (cfg.mode === 'ai' && G.st.turn === 1) {
      G.busy = true; render();
      var tk = ++G.token;
      setTimeout(function () {
        if (tk !== G.token) return;
        var m = chooseMove(G.st, cfg.level, keyCount);
        if (tk !== G.token) return;
        G.busy = false;
        if (m) commit(m); else render();
      }, 420);
    }
  }

  function undo() {
    var i = undoIndex();
    if (i < 0) return;
    G.token++; G.busy = false;
    var e = G.hist[i];
    G.st = e.st; G.keys = e.keys; G.reason = e.reason; G.sel = null;
    G.hist.length = i;
    closeModal('modal-result');
    render();
    maybeAI();
  }

  function inProgress() { return G.st && G.st.winner === null && G.hist.length > 0; }
  function confirmLeave() { return !inProgress() || window.confirm('진행 중인 게임이 사라져요. 계속할까요?'); }

  function showResult() {
    var st = G.st, w = st.winner, title, crest;
    if (w === 'draw') { title = '무승부'; crest = '和'; }
    else if (cfg.mode === 'ai') { title = w === 0 ? '승리했어요!' : '컴퓨터가 이겼어요'; crest = w === 0 ? '勝' : '敗'; }
    else { title = teamName(w) + ' 승리!'; crest = '勝'; }
    $('res-title').textContent = title;
    $('res-crest').textContent = crest;
    $('res-msg').textContent = w === 'draw' ? '같은 모양이 세 번 나왔어요.' : reasonText();
    var pt = $('petals');
    pt.innerHTML = '';
    if (w !== 'draw') {
      for (var i = 0; i < 26; i++) {
        var e = document.createElement('i');
        e.style.left = (Math.random() * 100) + '%';
        e.style.animationDelay = (Math.random() * 3) + 's';
        e.style.animationDuration = (4 + Math.random() * 4) + 's';
        e.style.width = e.style.height = (8 + Math.random() * 10) + 'px';
        e.className = Math.random() < 0.5 ? 'gold' : 'rose';
        pt.appendChild(e);
      }
    }
    openModal('modal-result');
  }

  function onCell(i) {
    var st = G.st;
    if (!st || st.winner !== null || G.busy) return;
    var p = st.turn;
    if (!(cfg.mode === 'hot' || p === 0)) return;
    var targets = targetsFor(G.sel);
    for (var k = 0; k < targets.length; k++) {
      if (targets[k].t === i) { commit(targets[k]); return; }
    }
    var c = st.b[i];
    if (c && (c >> 3) === p) {
      if (G.sel && G.sel.kind === 'cell' && G.sel.i === i) G.sel = null;
      else G.sel = { kind: 'cell', i: i };
    } else G.sel = null;
    render();
  }
  function onHand(p, j) {
    if (!canAct(p) || !G.st.h[p][j]) return;
    if (G.sel && G.sel.kind === 'hand' && G.sel.j === j) G.sel = null;
    else G.sel = { kind: 'hand', j: j };
    render();
  }

  var ACT = {
    'go-setup': function () { show('screen-setup'); },
    'setup-back': function () { show('screen-main'); },
    'tip': showTip,
    'rules': function () { openModal('modal-rules'); },
    'close-rules': function () { closeModal('modal-rules'); },
    'start': function () { show('screen-play'); newGame(); },
    'to-main': function () { if (confirmLeave()) { G.token++; G.busy = false; show('screen-main'); } },
    'to-setup': function () { if (confirmLeave()) { G.token++; G.busy = false; closeModal('modal-result'); show('screen-setup'); } },
    'new': function () { if (confirmLeave()) newGame(); },
    'undo': undo,
    'again': newGame,
    'review': function () { closeModal('modal-result'); },
    'show-result': showResult
  };

  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!t || !t.closest) return;
    var a = t.closest('[data-act]');
    if (a) { var fn = ACT[a.getAttribute('data-act')]; if (fn) fn(); return; }
    var seg = t.closest('#screen-setup .seg button[data-val]');
    if (seg) {
      var row = seg.closest('.row');
      cfg[row.getAttribute('data-key')] = seg.getAttribute('data-val');
      saveCfg(); syncSetup(); return;
    }
    var tg = t.closest('#screen-setup .tog');
    if (tg) { var kk = tg.getAttribute('data-tog'); cfg[kk] = !cfg[kk]; saveCfg(); syncSetup(); return; }
    var hp = t.closest('.hp');
    if (hp) { onHand(+hp.getAttribute('data-p'), +hp.getAttribute('data-j')); return; }
    var cell = t.closest('#board .cell');
    if (cell) { onCell(+cell.getAttribute('data-i')); return; }
    if (t.classList && t.classList.contains('overlay')) t.classList.remove('open');
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { closeModal('modal-rules'); closeModal('modal-result'); }
  });

  root.__jangi = { G: G, cfg: cfg, render: render, newGame: newGame, onCell: onCell, onHand: onHand, show: show, showResult: showResult };
  show('screen-main');
})(typeof window !== 'undefined' ? window : globalThis);
