/* Britain Elects tracker template.
 *
 * A page holds <main id="tracker"></main> and a <script type="application/json" id="tracker-config">
 * with its editorial settings (headline, labels, ranges). The data comes from benma: page.json
 * (index) and page-<group>.json (one per group), written nightly by pipeline/export_page.py.
 * Colours, party names and type come from the style guide's be.js (window.BE).
 *
 * Types: "vi" (party voting intention) and "leader" (positive / negative views of one person,
 * with an optional comparison with predecessors by day in office).
 */
(function () {
  'use strict';
  var BE = window.BE;
  var CFG = JSON.parse(document.getElementById('tracker-config').textContent);
  var ROOT_EL = document.getElementById('tracker');
  var DATA = (CFG.dataBase || 'https://raw.githubusercontent.com/glasgow46239/benma/main/') ;
  var TRACKER_URL = DATA + 'trackers/' + CFG.tracker + '/data/';
  var ARTICLES_URL = DATA + 'site/articles.json';
  var CHART_H = 480, CMP_H = 420;
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var MONTH = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var INK = BE.neutral('ink'), MUTED = BE.neutral('inkMuted'), GRID = BE.neutral('grid'), BASE = BE.neutral('baseline'), HALO = BE.neutral('halo');
  var MINUS = '−';

  /* ---------- helpers ------------------------------------------------------------------ */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function dayOf(y, m, d) { return Math.round(Date.UTC(y, m, d) / 864e5); }
  function isoDay(s) { var p = s.split('-'); return dayOf(+p[0], +p[1] - 1, +p[2]); }
  function parts(day) { var x = new Date(day * 864e5); return { y: x.getUTCFullYear(), m: x.getUTCMonth(), d: x.getUTCDate() }; }
  function longDate(day) { var p = parts(day); return p.d + ' ' + MONTH[p.m] + ' ' + p.y; }
  function shortDate(day) { var p = parts(day); return p.d + ' ' + MON[p.m] + ' ' + p.y; }
  function signed(v) { return Math.abs(v) < 0.05 ? '0.0' : (v > 0 ? '+' : MINUS) + Math.abs(v).toFixed(1); }
  function change(c, days) { return Math.abs(c) < 0.05 ? 'No change on ' + days + ' days ago' : signed(c) + ' on ' + days + ' days ago'; }
  function f1(n) { return n.toFixed(1); }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function pathOf(pts) { var o = ''; for (var i = 0; i < pts.length; i++) o += (i ? 'L' : 'M') + pts[i][0].toFixed(1) + ',' + pts[i][1].toFixed(1); return o; }
  function getJSON(url) { return fetch(url, { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }); }
  function spread(items, gap, lo, hi) {
    var s = items.slice().sort(function (a, b) { return a.y0 - b.y0; }), i;
    s.forEach(function (it) { it.y = Math.max(lo, it.y0); });
    for (i = 1; i < s.length; i++) if (s[i].y < s[i - 1].y + gap) s[i].y = s[i - 1].y + gap;
    if (s.length && s[s.length - 1].y > hi) {
      s[s.length - 1].y = hi;
      for (i = s.length - 2; i >= 0; i--) if (s[i].y > s[i + 1].y - gap) s[i].y = s[i + 1].y - gap;
    }
  }

  /* Series styling: parties come from the style guide; leader pages use the positive / negative pair. */
  var SIGNAL_NAMES = { Positive: ['Positive', 'Pos'], Negative: ['Negative', 'Neg'] };
  function series(k) {
    if (SIGNAL_NAMES[k]) return { name: SIGNAL_NAMES[k][0], the: SIGNAL_NAMES[k][0].toLowerCase(), short: SIGNAL_NAMES[k][1], fill: BE.signal(k, 'fill'), ink: BE.signal(k, 'text') };
    if (k === 'Oth') k = 'oth';
    return { name: BE.name(k, 'general'), the: BE.name(k, 'analysis'), short: BE.name(k, 'short'), fill: BE.fill(k) || '#A9ACA8', ink: BE.text(k) || INK };
  }

  function decodeGroup(raw) {
    Object.keys(raw).forEach(function (p) {
      var P = raw[p];
      P.segs = P.segs.map(function (s) {
        var ds = [s.d0]; s.dd.forEach(function (d) { ds.push(ds[ds.length - 1] + d); });
        return { ds: ds, m: s.m.map(function (v) { return v / 10; }), lo: s.lo.map(function (v, i) { return (s.m[i] - v) / 10; }), hi: s.hi.map(function (v, i) { return (s.m[i] + v) / 10; }), first: s.d0, last: ds[ds.length - 1] };
      });
      P.polls = P.polls.map(function (q) { return [q[0], q[1] / 10]; });
    });
    return raw;
  }
  function valAt(P, day) {
    for (var k = P.segs.length - 1; k >= 0; k--) {
      var s = P.segs[k];
      if (day >= s.first && day <= s.last) {
        var lo = 0, hi = s.ds.length - 1;
        while (hi - lo > 1) { var mid = (lo + hi) >> 1; if (s.ds[mid] <= day) lo = mid; else hi = mid; }
        var span = s.ds[hi] - s.ds[lo], u = span ? (day - s.ds[lo]) / span : 0;
        return s.m[lo] + (s.m[hi] - s.m[lo]) * u;
      }
    }
    return null;
  }

  /* ---------- skeleton ------------------------------------------------------------------ */
  var isLeader = CFG.type === 'leader';
  var chev = '<svg aria-hidden="true" viewBox="0 0 10 14"><path d="M1 5.5 5 1.5 9 5.5M1 8.5 5 12.5 9 8.5" fill="none" stroke="' + INK + '" stroke-width="1.6"/></svg>';
  ROOT_EL.className = 'tr wrap';
  ROOT_EL.innerHTML =
    '<section class="tr-head">' +
      '<div class="tr-meta" data-r="updated">&nbsp;</div>' +
      '<h1 class="tr-title" data-r="title">' + esc(CFG.headline || '') + '</h1>' +
      '<p class="tr-dek" data-r="dek">&nbsp;</p>' +
      '<div class="tr-controls"><label for="tr-group">' + esc(CFG.among) + '</label><div class="tr-select"><select id="tr-group" data-r="select"></select>' + chev + '</div></div>' +
    '</section>' +
    '<section class="tr-cards" aria-label="Latest figures"><div class="tr-asof" data-r="asof">&nbsp;</div><div class="tr-card-grid' + (isLeader ? ' n3' : '') + '" data-r="cards"></div>' +
      (isLeader ? '<div class="tr-rest" data-r="rest"></div>' : '') + '</section>' +
    '<section class="tr-chart" aria-label="Trend chart">' +
      '<div class="tr-plot" data-r="plot" role="img" aria-label="Chart"><div class="tr-status">Loading polling data…</div></div>' +
      '<div class="tr-under"><div class="tr-key">' +
        '<span><i style="width:20px;height:2.5px;background:' + INK + '"></i>Average</span>' +
        '<span><i style="width:20px;height:10px;background:#DDDDDD"></i>Range of uncertainty</span>' +
        '<span><i style="width:6px;height:6px;border-radius:50%;background:#A9ACA8"></i>Individual poll</span>' +
      '</div><div class="tr-seg" role="group" aria-label="Time range" data-r="ranges"></div></div>' +
      '<div class="tr-note" data-r="note"></div><div class="tr-source">Source: Britain Elects poll aggregate.</div>' +
    '</section>' +
    (isLeader && CFG.compare ? compareSkeleton() : '') +
    '<section class="tr-section arts-sec" aria-labelledby="arts-h" data-r="artsec" hidden><div class="arts-head"><h2 id="arts-h">From Britain Elects</h2><a href="https://britainelects.substack.com">All articles on Substack</a></div><div class="arts" data-r="arts"></div></section>';

  function compareSkeleton() {
    return '<section class="tr-section" aria-labelledby="cmp-h"><header><h2 id="cmp-h">' + esc(CFG.compare.title) + '</h2><p>' + esc(CFG.compare.dek) + '</p></header>' +
      '<div class="cmp-body"><div class="cmp-chart"><div class="tr-plot cmp" data-r="cplot" role="img" aria-label="Comparison chart"></div>' +
      '<div class="tr-seg-wrap"><div class="tr-seg" role="group" aria-label="Compare over" data-r="cranges"></div></div></div>' +
      '<div class="cmp-table"><h3 data-r="ctitle"></h3><div class="cmp-row cmp-th"><span></span><span>' + esc(CFG.compare.whoLabel || 'Prime minister') + '</span><span>Net</span><span>Pos</span><span>Neg</span></div>' +
      '<div class="cmp-rows" data-r="crows"></div><p class="cmp-foot">' + esc(CFG.compare.foot || '') + '</p></div></div></section>';
  }
  var R = {};
  ROOT_EL.querySelectorAll('[data-r]').forEach(function (el) { R[el.getAttribute('data-r')] = el; });

  /* ---------- state ------------------------------------------------------------------- */
  var params = new URLSearchParams(location.search);
  var S = {
    index: null, groups: {}, group: params.get('group') || CFG.defaultGroup || 'overall',
    range: CFG.defaultRange != null ? CFG.defaultRange : CFG.ranges.length - 1, hover: null, width: 0,
    cmpRange: CFG.compare ? (CFG.compare.defaultRange || 0) : 0, cmpHover: null, cmpWidth: 0, focus: null, pinned: null
  };

  /* ---------- top: headline, dek, cards (always the latest data) ---------------------- */
  function groupMeta() { return S.index.groups.filter(function (g) { return g.id === S.group; })[0] || S.index.groups[0]; }

  function renderTop() {
    var g = groupMeta(), days = S.index.changeDays || 60, gen = new Date(S.index.generated);
    R.updated.textContent = 'Updated ' + gen.getUTCDate() + ' ' + MONTH[gen.getUTCMonth()] + ' ' + gen.getUTCFullYear();
    R.asof.textContent = 'Latest data, ' + longDate(g.end);
    var html = '';
    if (!isLeader) {
      var sumNow = 0, sumAgo = 0;
      var cards = g.cards.map(function (p) {
        var st = series(p), now = g.latest[p], ago = g.ago[p];
        sumNow += now; sumAgo += ago;
        return { st: st, v: now, chg: now - ago };
      }).sort(function (a, b) { return b.v - a.v; });
      var top = cards[0], second = cards[1];
      if (g.cards.length === 5) cards.push({ st: series('oth'), v: Math.max(0, 100 - sumNow), chg: Math.max(0, 100 - sumNow) - Math.max(0, 100 - sumAgo) });
      cards.forEach(function (c) {
        html += '<div class="tr-card"><i style="background:' + c.st.fill + '"></i><div><div class="nm" style="color:' + c.st.ink + '">' + esc(c.st.name) + '</div>' +
          '<div class="num" style="color:' + c.st.ink + '">' + f1(c.v) + '<small>%</small></div><div class="chg">' + change(c.chg, days) + '</div></div></div>';
      });
      var gap = Math.round(+f1(top.v) * 10 - +f1(second.v) * 10) / 10;
      R.dek.innerHTML = '<b style="color:' + top.st.ink + '">' + esc(cap(top.st.the)) + '</b> ' + (gap === 0 ? 'and' : 'lead') + ' <b style="color:' + second.st.ink + '">' + esc(second.st.the) + '</b> ' +
        (gap === 0 ? 'are level among ' : 'by ' + f1(gap) + (gap === 1 ? ' point' : ' points') + ' among ') + esc(g.short) + '. ' + esc(CFG.dekTail || '') +
        (CFG.method ? ' <a href="' + esc(CFG.method) + '">How this works</a>' : '');
    } else {
      var pos = g.latest.Positive, neg = g.latest.Negative, net = pos - neg, netAgo = g.ago.Positive - g.ago.Negative;
      var P = series('Positive'), N = series('Negative'), hiInk = net >= 0 ? P.ink : N.ink;
      R.title.innerHTML = 'How <span style="color:' + hiInk + '">' + (net >= 0 ? 'popular' : 'unpopular') + '</span> is ' + esc(CFG.person) + '?';
      R.dek.innerHTML = '<b style="color:' + P.ink + '">' + f1(pos) + '%</b> of ' + esc(g.short) + ' have a positive view of ' + esc(CFG.role) + ' and <b style="color:' + N.ink + '">' + f1(neg) + '%</b> a negative one, a net rating of <b style="color:' + hiInk + '">' + signed(net) + '</b>. ' + esc(CFG.dekTail || '') +
        (CFG.method ? ' <a href="' + esc(CFG.method) + '">How this works</a>' : '');
      [[P, f1(pos), '%', pos - g.ago.Positive, P.fill], [N, f1(neg), '%', neg - g.ago.Negative, N.fill], [{ name: 'Net rating', ink: hiInk }, signed(net), '', net - netAgo, INK]].forEach(function (c) {
        html += '<div class="tr-card"><i style="background:' + c[4] + '"></i><div><div class="nm" style="color:' + c[0].ink + '">' + esc(c[0].name) + '</div>' +
          '<div class="num" style="color:' + c[0].ink + '">' + c[1] + '<small>' + c[2] + '</small></div><div class="chg">' + change(c[3], days) + '</div></div></div>';
      });
      R.rest.textContent = 'The remaining ' + f1(Math.max(0, 100 - pos - neg)) + '% have no view either way or don’t know.';
    }
    R.cards.innerHTML = html;
    R.note.textContent = (CFG.note || '').replace('{bw}', g.bandwidthDays || '') + ' Changes are measured against the average ' + days + ' days before the latest data.';
  }

  /* ---------- main chart -------------------------------------------------------------------- */
  var main = null;   // geometry cache for hover
  function rangeStart() { var r = CFG.ranges[S.range]; return r.from ? isoDay(r.from) : -1e9; }

  function buildMain() {
    if (!S.index) return;
    var g = groupMeta(), data = S.groups[g.id], W = S.width;
    if (!data || !W) return;
    var narrow = W < 640, H = CHART_H, ML = narrow ? 30 : 40, MR = narrow ? 104 : 160, MT = 44, MB = 34;
    var start = Math.max(rangeStart(), g.start), end = g.end, span = end - start, plotW = W - ML - MR;
    function X(d) { return ML + (d - start) / span * plotW; }
    var vmax = 0, raw = {};
    g.lines.forEach(function (p) {
      raw[p] = data[p].segs.map(function (s) {
        var idx = [];
        for (var i = 0; i < s.ds.length; i++) if (s.ds[i] >= start && s.ds[i] <= end) idx.push(i);
        var stride = Math.max(1, Math.ceil(idx.length / (plotW / 2)));
        var keep = idx.filter(function (_, j) { return j % stride === 0 || j === idx.length - 1; });
        keep.forEach(function (i) { vmax = Math.max(vmax, s.hi[i]); });
        return { s: s, idx: keep };
      }).filter(function (o) { return o.idx.length > 1; });
    });
    var yMax = Math.max(isLeader ? 40 : 30, Math.ceil((vmax + 4) / 10) * 10);
    function Y(v) { return MT + (1 - v / yMax) * (H - MT - MB); }
    var R0 = narrow ? 1.8 : 2.4, svg = '', ov = '';
    for (var v = 0; v <= yMax; v += 10) {
      svg += '<line x1="' + ML + '" x2="' + (W - MR) + '" y1="' + Y(v).toFixed(1) + '" y2="' + Y(v).toFixed(1) + '" stroke="' + GRID + '"/>';
      ov += '<div class="yl" style="top:' + (Y(v) - 7).toFixed(1) + 'px;width:' + (ML - 6) + 'px">' + (v === yMax ? v + '%' : v) + '</div>';
    }
    var markers = (CFG.markers || []).map(function (m) { return [isoDay(m[0]), m[1]]; }).filter(function (m) { return m[0] > start + 20 && m[0] < end; });
    var lastX = -1e9;
    markers.forEach(function (m) {
      var x = X(m[0]);
      svg += '<line x1="' + x.toFixed(1) + '" x2="' + x.toFixed(1) + '" y1="' + MT + '" y2="' + (H - MB) + '" stroke="#A9ACA8" stroke-dasharray="3 3"/>';
      if (x - lastX > (narrow ? 44 : 60)) { ov += '<div class="ml" style="left:' + x.toFixed(1) + 'px;top:' + (MT + 2) + 'px">' + esc(narrow && m[2] ? m[2] : m[1]) + '</div>'; lastX = x; }
    });
    var bands = '', dots = '', lines = '';
    g.lines.forEach(function (p) {
      var st = series(p);
      raw[p].forEach(function (o) {
        var up = o.idx.map(function (i) { return [X(o.s.ds[i]), Y(o.s.hi[i])]; });
        var dn = o.idx.slice().reverse().map(function (i) { return [X(o.s.ds[i]), Y(Math.max(0, o.s.lo[i]))]; });
        bands += '<path d="' + pathOf(up.concat(dn)) + 'Z" fill="' + st.fill + '" fill-opacity="0.15"/>';
        var ln = pathOf(o.idx.map(function (i) { return [X(o.s.ds[i]), Y(o.s.m[i])]; }));
        lines += '<path d="' + ln + '" fill="none" stroke="' + HALO + '" stroke-width="8.5" stroke-linejoin="round" stroke-linecap="round"/>' +
                 '<path d="' + ln + '" fill="none" stroke="' + st.fill + '" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>';
      });
      var d = '', r2 = (2 * R0).toFixed(1), rs = R0.toFixed(1);
      data[p].polls.forEach(function (q) {
        if (q[0] < start || q[0] > end || q[1] > yMax) return;
        d += 'M' + (X(q[0]) - R0).toFixed(1) + ',' + Y(q[1]).toFixed(1) + 'a' + rs + ',' + rs + ' 0 1,0 ' + r2 + ',0a' + rs + ',' + rs + ' 0 1,0 -' + r2 + ',0';
      });
      if (d) dots += '<path d="' + d + '" fill="' + st.fill + '" fill-opacity="' + (isLeader ? 0.3 : 0.26) + '"/>';
    });
    svg += bands + dots + lines;
    svg += '<line x1="' + ML + '" x2="' + (W - MR) + '" y1="' + (H - MB) + '" y2="' + (H - MB) + '" stroke="' + BASE + '" stroke-width="1.25"/>';
    var xt = xTicks(start, end, plotW, narrow);
    xt.forEach(function (t) {
      var x = X(t[0]).toFixed(1);
      svg += '<line x1="' + x + '" x2="' + x + '" y1="' + (H - MB) + '" y2="' + (H - MB + 6) + '" stroke="' + BASE + '"/>';
      ov += '<div class="xl" style="left:' + x + 'px;top:' + (H - MB + 11) + 'px">' + t[1] + '</div>';
    });
    main = { g: g, data: data, W: W, H: H, ML: ML, MR: MR, MT: MT, MB: MB, start: start, end: end, span: span, plotW: plotW, narrow: narrow, X: X, Y: Y };
    R.plot.innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" aria-hidden="true">' + svg + '</svg><div class="ov">' + ov + '</div>' +
      '<svg class="cursor" viewBox="0 0 ' + W + ' ' + H + '" aria-hidden="true"></svg><div class="ov labels"></div>';
    renderCursor();
  }

  function xTicks(start, end, plotW, narrow) {
    var out = [], years = (end - start) / 365.25;
    if (years > 3) {
      var ppy = plotW / years, every = ppy >= 52 ? 1 : ppy >= 26 ? 2 : 4;
      for (var yr = parts(start).y + 1; dayOf(yr, 0, 1) <= end; yr++) if (yr % every === 0) out.push([dayOf(yr, 0, 1), (every > 1 || narrow) ? "'" + String(yr).slice(2) : String(yr)]);
    } else {
      var p0 = parts(start), months = (end - start) / 30.4, step = months > 20 ? (narrow ? 6 : 3) : months > 10 ? (narrow ? 4 : 2) : 1;
      for (var mi = p0.y * 12 + p0.m + 1; ; mi++) {
        var yy = Math.floor(mi / 12), mm = mi % 12, d = dayOf(yy, mm, 1);
        if (d > end) break;
        if (mm % step === 0) out.push([d, mm === 0 ? String(yy) : MON[mm]]);
      }
    }
    return out;
  }

  function renderCursor() {
    var c = main; if (!c) return;
    var hovering = S.hover !== null;
    var dC = hovering ? Math.max(c.start, Math.min(c.end, Math.round(S.hover))) : c.end;
    var xC = c.X(dC), flip = hovering && xC > c.ML + c.plotW * (c.narrow ? 0.45 : 0.62);
    var labels = [], vals = {};
    c.g.lines.forEach(function (p) {
      var v = valAt(c.data[p], dC); vals[p] = v;
      if (v == null) return;
      var st = series(p);
      labels.push({ st: st, v: v, cy: c.Y(v), y0: c.Y(v) });
    });
    spread(labels, c.narrow ? 26 : 31, c.MT + 12, c.H - c.MB - 12);
    var svg = '<line x1="' + xC.toFixed(1) + '" x2="' + xC.toFixed(1) + '" y1="' + (c.MT - 12) + '" y2="' + (c.H - c.MB) + '" stroke="' + INK + '" stroke-dasharray="2 3"/>';
    var ov = '';
    labels.forEach(function (l) {
      svg += '<circle cx="' + xC.toFixed(1) + '" cy="' + l.cy.toFixed(1) + '" r="4.5" fill="' + l.st.fill + '" stroke="' + HALO + '" stroke-width="2"/>';
      ov += '<div class="lab" style="left:' + (flip ? xC - 10 : xC + 10).toFixed(1) + 'px;top:' + l.y.toFixed(1) + 'px;transform:' + (flip ? 'translate(-100%,-50%)' : 'translate(0,-50%)') + ';color:' + l.st.ink + '">' +
        '<b>' + f1(l.v) + '<small>%</small></b><span>' + esc(c.narrow ? l.st.short : l.st.name) + '</span></div>';
    });
    var date = shortDate(dC);
    if (isLeader && vals.Positive != null && vals.Negative != null) date += ' · Net ' + signed(vals.Positive - vals.Negative);
    ov += '<div class="cur" style="left:' + xC.toFixed(1) + 'px;top:' + (c.MT - 32) + 'px;transform:' + ((hovering && !flip) ? 'translateX(-50%)' : 'translateX(-100%)') + '">' + date + '</div>';
    R.plot.querySelector('svg.cursor').innerHTML = svg;
    R.plot.querySelector('.labels').innerHTML = ov;
    R.plot.setAttribute('aria-label', 'Line chart of ' + (isLeader ? 'views of ' + CFG.person : 'voting intention') + ' among ' + c.g.short + '. On ' + longDate(dC) + ': ' +
      labels.map(function (l) { return l.st.name + ' ' + f1(l.v) + '%'; }).join(', ') + '.');
  }

  function renderRanges() {
    R.ranges.innerHTML = CFG.ranges.map(function (r, i) { return '<button type="button" data-i="' + i + '" aria-pressed="' + (i === S.range) + '">' + esc(r.label) + '</button>'; }).join('');
  }

  /* ---------- leader comparison ------------------------------------------------------------ */
  var cmp = null;
  function cmpDays() { return CFG.compare.ranges[S.cmpRange].days; }
  function leaderAt(L, d) {
    if (d < L.first || d > L.last) return null;
    var i = d - L.first; if (L.netv[i] == null) return null;
    return { pos: L.posv[i], neg: L.negv[i], net: L.netv[i] };
  }
  function buildCompare() {
    var W = S.cmpWidth, L0 = S.index.compare; if (!W || !L0) return;
    var maxDay = cmpDays(), lit = S.focus || S.pinned || '';
    var narrow = W < 520, H = CMP_H, ML = 36, MR = narrow ? 64 : 78, MT = 34, MB = 46, plotW = W - ML - MR;
    function X(d) { return ML + d / maxDay * plotW; }
    var lo = 0, hi = 0;
    L0.forEach(function (L) { for (var d = Math.max(0, L.first); d <= Math.min(L.last, maxDay); d++) { var v = L.netv[d - L.first]; if (v != null) { lo = Math.min(lo, v); hi = Math.max(hi, v); } } });
    var yMin = Math.floor((lo - 4) / 10) * 10, yMax = Math.ceil((hi + 4) / 10) * 10;
    function Y(v) { return MT + (yMax - v) / (yMax - yMin) * (H - MT - MB); }
    var svg = '', ov = '', stepY = (yMax - yMin) > 100 ? 20 : 10;
    for (var v = yMin; v <= yMax; v += stepY) {
      svg += '<line x1="' + ML + '" x2="' + (W - MR) + '" y1="' + Y(v).toFixed(1) + '" y2="' + Y(v).toFixed(1) + '" stroke="' + (v === 0 ? BASE : GRID) + '" stroke-width="' + (v === 0 ? 1.25 : 1) + '"/>';
      ov += '<div class="yl" style="top:' + (Y(v) - 7).toFixed(1) + 'px;width:' + (ML - 6) + 'px;' + (v === 0 ? 'color:' + INK : '') + '">' + (v > 0 ? '+' + v : v < 0 ? MINUS + Math.abs(v) : '0') + '</div>';
    }
    var grey = '', litp = '', ends = [];
    L0.forEach(function (L) {
      var a = Math.max(0, L.first), b = Math.min(L.last, maxDay); if (b <= a) return;
      var stride = Math.max(1, Math.floor((b - a) / (plotW / 1.5))), pts = [];
      for (var d = a; d <= b; d += stride) { var vv = L.netv[d - L.first]; if (vv != null) pts.push([X(d), Y(vv)]); }
      if (L.netv[b - L.first] != null) pts.push([X(b), Y(L.netv[b - L.first])]);
      var dp = pathOf(pts), isLit = L.current || L.surname === lit;
      if (isLit) litp += '<path d="' + dp + '" fill="none" stroke="' + HALO + '" stroke-width="8.5" stroke-linejoin="round" stroke-linecap="round"/><path d="' + dp + '" fill="none" stroke="' + L.fill + '" stroke-width="' + (L.current ? 3 : 2.5) + '" stroke-linejoin="round" stroke-linecap="round"/>';
      else grey += '<path d="' + dp + '" fill="none" stroke="#CBCDCA" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>';
      ends.push({ L: L, lit: isLit, edge: b >= maxDay - 1, x0: X(b) + 6, y0: Y(L.netv[b - L.first]) });
    });
    // the current leader's line goes on top
    svg += grey + litp;
    svg += '<line x1="' + ML + '" x2="' + (W - MR) + '" y1="' + (H - MB) + '" y2="' + (H - MB) + '" stroke="' + BASE + '" stroke-width="1.25"/>';
    var step = maxDay <= 100 ? 10 : maxDay <= 365 ? (narrow ? 100 : 50) : 365;
    for (var t = 0; t <= maxDay + 0.1; t += step) {
      var x = X(t).toFixed(1);
      svg += '<line x1="' + x + '" x2="' + x + '" y1="' + (H - MB) + '" y2="' + (H - MB + 6) + '" stroke="' + BASE + '"/>';
      ov += '<div class="xl" style="left:' + x + 'px;top:' + (H - MB + 11) + 'px">' + (maxDay > 365 ? (t === 0 ? '0' : (t / 365) + (t === 365 ? ' year' : ' years')) : t) + '</div>';
    }
    ov += '<div class="xl" style="left:' + (W - MR) + 'px;top:' + (H - 14) + 'px;transform:translateX(-100%);text-transform:uppercase">Days in office</div>';
    var edge = ends.filter(function (e) { return e.edge; }), inner = ends.filter(function (e) { return !e.edge; });
    spread(edge, 16, MT, H - MB - 4);
    edge.forEach(function (e) { e.x = W - MR + 6; });
    inner.forEach(function (e) { e.x = e.x0; e.y = e.y0; });
    edge.concat(inner).forEach(function (e) {
      ov += '<div class="end" style="left:' + e.x.toFixed(1) + 'px;top:' + e.y.toFixed(1) + 'px;color:' + (e.lit ? e.L.ink : MUTED) + ';font-weight:' + (e.lit ? 700 : 400) + '">' + esc(e.L.surname) + '</div>';
    });
    cmp = { W: W, H: H, ML: ML, MR: MR, MT: MT, MB: MB, plotW: plotW, maxDay: maxDay, X: X, Y: Y, lit: lit };
    R.cplot.innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" aria-hidden="true">' + svg + '</svg><div class="ov">' + ov + '</div><svg class="cursor" viewBox="0 0 ' + W + ' ' + H + '" aria-hidden="true"></svg><div class="ov labels"></div>';
    renderCompareCursor();
  }
  function renderCompareCursor() {
    var c = cmp; if (!c) return;
    var L0 = S.index.compare, current = L0.filter(function (L) { return L.current; })[0];
    var day = S.cmpHover != null ? Math.max(0, Math.min(c.maxDay, Math.round(S.cmpHover))) : Math.min(current.last, c.maxDay);
    var x = c.X(day), flip = x > c.ML + c.plotW * 0.7, svg = '<line x1="' + x.toFixed(1) + '" x2="' + x.toFixed(1) + '" y1="' + (c.MT - 10) + '" y2="' + (c.H - c.MB) + '" stroke="' + INK + '" stroke-dasharray="2 3"/>';
    var rows = L0.map(function (L) {
      var at = leaderAt(L, day), isLit = L.current || L.surname === c.lit, note = '';
      if (!at) note = (L.officeDays != null && day >= L.officeDays) ? 'Left office on day ' + L.officeDays : day < L.first ? 'No polling until day ' + L.first : L.current ? 'Not yet reached' : 'No data';
      return { L: L, at: at, lit: isLit, note: note, key: at ? at.net : -1e9 };
    });
    rows.filter(function (r) { return r.at; }).sort(function (a, b) { return a.lit - b.lit; }).forEach(function (r) {
      svg += '<circle cx="' + x.toFixed(1) + '" cy="' + c.Y(r.at.net).toFixed(1) + '" r="' + (r.lit ? 5 : 3.5) + '" fill="' + (r.lit ? r.L.fill : '#A9ACA8') + '" stroke="' + HALO + '" stroke-width="1.5"/>';
    });
    R.cplot.querySelector('svg.cursor').innerHTML = svg;
    R.cplot.querySelector('.labels').innerHTML = '<div class="cur" style="left:' + x.toFixed(1) + 'px;top:' + (c.MT - 30) + 'px;transform:' + (flip ? 'translateX(-100%)' : 'translateX(-50%)') + '">Day ' + day + '</div>';
    rows.sort(function (a, b) { return b.key - a.key; });
    var n = 0, P = series('Positive'), N = series('Negative');
    R.crows.innerHTML = rows.map(function (r) {
      var cells = r.at
        ? '<span class="f net" style="color:' + (r.at.net >= 0 ? P.ink : N.ink) + '">' + signed(r.at.net) + '</span><span class="f">' + f1(r.at.pos) + '</span><span class="f">' + f1(r.at.neg) + '</span>'
        : '<span class="none">' + r.note + '</span>';
      return '<button type="button" class="cmp-row' + (r.lit ? ' lit' : '') + '" data-who="' + esc(r.L.surname) + '" aria-pressed="' + (S.pinned === r.L.surname) + '">' +
        '<span class="rk">' + (r.at ? ++n : '') + '</span><span class="who"><i style="background:' + r.L.fill + '"></i><span style="font-weight:' + (r.L.current ? 700 : 400) + '">' + esc(r.L.name) + '</span></span>' + cells + '</button>';
    }).join('');
    R.ctitle.textContent = 'Net rating on day ' + day + ' in office';
    var b = leaderAt(current, day);
    R.cplot.setAttribute('aria-label', 'Net ratings of prime ministers by days in office. On day ' + day + ', ' + current.surname + ' ' + (b ? signed(b.net) : 'not yet reached') + '.');
  }
  function renderCompareRanges() {
    R.cranges.innerHTML = CFG.compare.ranges.map(function (r, i) { return '<button type="button" data-i="' + i + '" aria-pressed="' + (i === S.cmpRange) + '">' + esc(r.label) + '</button>'; }).join('');
  }

  /* ---------- articles ---------------------------------------------------------------------- */
  function renderArticles(feed) {
    var items = (feed && feed.items) || [], A = CFG.articles || {}, re = A.match ? new RegExp(A.match, 'i') : null, out = [];
    if (re) items.forEach(function (a) { if (re.test(a.title + ' ' + a.desc) && out.length < 4) out.push([a, A.kicker || 'Related', series(A.party || 'lab').ink]); });
    items.forEach(function (a) { if (out.length < 4 && !(re && re.test(a.title + ' ' + a.desc))) out.push([a, 'Latest', MUTED]); });
    if (!out.length) return;
    R.arts.innerHTML = out.map(function (o) {
      var a = o[0];
      return '<article><div class="tr-label" style="color:' + o[2] + '">' + esc(o[1]) + (a.date ? ' · ' + shortDate(isoDay(a.date)) : '') + '</div>' +
        '<h3><a href="' + esc(a.url) + '">' + esc(a.title) + '</a></h3><p>' + esc(a.desc) + '</p></article>';
    }).join('');
    R.artsec.hidden = false;
  }

  /* ---------- events ------------------------------------------------------------------------ */
  var raf = 0, pending = {};
  function schedule(patch, fn) {
    Object.assign(pending, patch);
    if (!raf) raf = requestAnimationFrame(function () { raf = 0; Object.assign(S, pending); pending = {}; fn(); });
  }
  function pointer(el, geo, key, fn) {
    function at(e) {
      var g = geo(); if (!g) return;
      var rect = el.getBoundingClientRect(), vx = (e.clientX - rect.left) / rect.width * g.W;
      var p = {}; p[key] = (vx < g.ML - 10 || vx > g.W - g.MR + 20) ? null : (key === 'hover' ? g.start + Math.max(0, Math.min(1, (vx - g.ML) / g.plotW)) * g.span : Math.max(0, Math.min(1, (vx - g.ML) / g.plotW)) * g.maxDay);
      schedule(p, fn);
    }
    el.addEventListener('pointermove', at);
    el.addEventListener('pointerdown', at);
    el.addEventListener('pointerleave', function () { var p = {}; p[key] = null; schedule(p, fn); });
  }
  pointer(R.plot, function () { return main; }, 'hover', renderCursor);
  R.ranges.addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; S.range = +b.dataset.i; S.hover = null; renderRanges(); buildMain(); });
  R.select.addEventListener('change', function () { selectGroup(R.select.value); });
  if (R.cplot) {
    pointer(R.cplot, function () { return cmp; }, 'cmpHover', renderCompareCursor);
    R.cranges.addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; S.cmpRange = +b.dataset.i; S.cmpHover = null; renderCompareRanges(); buildCompare(); });
    R.crows.addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; var w = b.dataset.who; if (current() === w) return; S.pinned = S.pinned === w ? null : w; buildCompare(); });
    R.crows.addEventListener('mouseover', function (e) { var b = e.target.closest('button'); if (!b || b.dataset.who === S.focus || current() === b.dataset.who) return; S.focus = b.dataset.who; buildCompare(); });
    R.crows.addEventListener('mouseleave', function () { if (S.focus) { S.focus = null; buildCompare(); } });
  }
  function current() { var c = S.index.compare.filter(function (L) { return L.current; })[0]; return c && c.surname; }

  if (window.ResizeObserver) {
    new ResizeObserver(function () {
      var w = Math.round(R.plot.getBoundingClientRect().width), cw = R.cplot ? Math.round(R.cplot.getBoundingClientRect().width) : 0;
      if (w && w !== S.width) { S.width = w; buildMain(); }
      if (cw && cw !== S.cmpWidth) { S.cmpWidth = cw; if (S.index) buildCompare(); }
    }).observe(ROOT_EL);
  }

  /* ---------- loading ---------------------------------------------------------------------- */
  function selectGroup(id) {
    var g = S.index.groups.filter(function (x) { return x.id === id; })[0]; if (!g) return;
    S.group = id; S.hover = null;
    var u = new URL(location.href); if (id === (CFG.defaultGroup || 'overall')) u.searchParams.delete('group'); else u.searchParams.set('group', id);
    history.replaceState(null, '', u);
    renderTop();
    if (S.groups[id]) { buildMain(); return; }
    getJSON(TRACKER_URL + g.file).then(function (raw) { S.groups[id] = decodeGroup(raw); if (S.group === id) buildMain(); })
      .catch(function () { R.plot.innerHTML = '<div class="tr-status">Polling data could not be loaded</div>'; });
  }

  getJSON(TRACKER_URL + 'page.json').then(function (index) {
    S.index = index;
    if (!index.groups.some(function (g) { return g.id === S.group; })) S.group = index.groups[0].id;
    var html = '', section = null;
    index.groups.forEach(function (g) {
      if (g.section !== section) { if (section) html += '</optgroup>'; section = g.section; if (section) html += '<optgroup label="' + esc(section) + '">'; }
      html += '<option value="' + esc(g.id) + '"' + (g.id === S.group ? ' selected' : '') + '>' + esc(g.label) + '</option>';
    });
    R.select.innerHTML = html + (section ? '</optgroup>' : '');
    renderRanges();
    if (index.compare && R.cplot) {
      index.compare.forEach(function (L) {
        L.posv = L.pos.map(function (v) { return v == null ? null : v / 10; });
        L.negv = L.neg.map(function (v) { return v == null ? null : v / 10; });
        L.netv = L.posv.map(function (v, i) { return v == null || L.negv[i] == null ? null : v - L.negv[i]; });
        L.fill = BE.fill(L.party); L.ink = BE.text(L.party); L.current = !L.to;
      });
      renderCompareRanges();
      S.cmpWidth = Math.round(R.cplot.getBoundingClientRect().width);
      buildCompare();
    }
    S.width = Math.round(R.plot.getBoundingClientRect().width);
    selectGroup(S.group);
  }).catch(function () {
    R.plot.innerHTML = '<div class="tr-status">Polling data could not be loaded</div>';
  });
  getJSON(ARTICLES_URL).then(renderArticles).catch(function () {});
})();
