/* Britain Elects homepage: latest Substack posts plus snapshots of the poll and leader trackers.
   Reads the same benma files as the tracker pages; colours and names from the style guide (be.js). */
(function () {
  'use strict';
  var BE = window.BE;
  var DATA = 'https://raw.githubusercontent.com/glasgow46239/benma/main/';
  var VI = DATA + 'trackers/vi_westminster_24/data/', LEADERS = DATA + 'site/leaders/', ARTICLES = DATA + 'site/articles.json';
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var MONTH = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var INK = BE.neutral('ink'), GRID = BE.neutral('grid'), BASE = BE.neutral('baseline'), HALO = BE.neutral('halo'), MINUS = '−';
  var R = {};
  document.querySelectorAll('[data-r]').forEach(function (el) { R[el.getAttribute('data-r')] = el; });

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function dayOf(y, m, d) { return Math.round(Date.UTC(y, m, d) / 864e5); }
  function isoDay(s) { var p = s.split('-'); return dayOf(+p[0], +p[1] - 1, +p[2]); }
  function parts(day) { var x = new Date(day * 864e5); return { y: x.getUTCFullYear(), m: x.getUTCMonth(), d: x.getUTCDate() }; }
  function longDate(day) { var p = parts(day); return p.d + ' ' + MONTH[p.m] + ' ' + p.y; }
  function shortDate(day) { var p = parts(day); return p.d + ' ' + MON[p.m] + ' ' + p.y; }
  function signed(v) { return Math.abs(v) < 0.05 ? '+0.0' : (v > 0 ? '+' : MINUS) + Math.abs(v).toFixed(1); }
  function f1(n) { return n.toFixed(1); }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function pathOf(pts) { var o = ''; for (var i = 0; i < pts.length; i++) o += (i ? 'L' : 'M') + pts[i][0].toFixed(1) + ',' + pts[i][1].toFixed(1); return o; }
  function getJSON(url) { return fetch(url, { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }); }
  function party(k) { if (k === 'Oth') k = 'oth'; return { name: BE.name(k, 'general'), the: BE.name(k, 'analysis'), fill: BE.fill(k) || '#A9ACA8', ink: BE.text(k) || INK }; }
  function lines(seg) {  // decode one exported segment into [[day, value], ...]
    var d = seg.d0, out = [[d, seg.m[0] / 10]];
    for (var i = 0; i < seg.dd.length; i++) { d += seg.dd[i]; out.push([d, seg.m[i + 1] / 10]); }
    return out;
  }
  function spread(items, gap, lo, hi) {
    var s = items.slice().sort(function (a, b) { return a.y0 - b.y0; }), i;
    s.forEach(function (it) { it.y = Math.max(lo, it.y0); });
    for (i = 1; i < s.length; i++) if (s[i].y < s[i - 1].y + gap) s[i].y = s[i - 1].y + gap;
    if (s.length && s[s.length - 1].y > hi) { s[s.length - 1].y = hi; for (i = s.length - 2; i >= 0; i--) if (s[i].y > s[i + 1].y - gap) s[i].y = s[i + 1].y - gap; }
  }

  /* ---- Substack: lead story and the next six ------------------------------------- */
  function img(a, cls) { return a.image ? '<img' + (cls ? ' class="' + cls + '"' : '') + ' src="' + esc(a.image) + '" alt="" loading="lazy">' : ''; }
  getJSON(ARTICLES).then(function (feed) {
    var items = (feed.items || []).filter(function (a) { return a.title && a.url; });
    if (!items.length) return;
    var a = items[0];
    R.lead.innerHTML = '<a href="' + esc(a.url) + '" tabindex="-1" aria-hidden="true">' + img(a) + '</a>' +
      '<div class="' + (a.image ? '' : 'rule') + '"><div class="hm-kicker">Latest analysis' + (a.date ? ' · ' + shortDate(isoDay(a.date)) : '') + '</div>' +
      '<h2><a href="' + esc(a.url) + '">' + esc(a.title) + '</a></h2><p>' + esc(a.desc) + '</p>' +
      '<a class="hm-more" href="' + esc(a.url) + '">Read on Substack &rarr;</a></div>' +
      '<ul class="hm-also" aria-label="More stories">' + items.slice(1, 4).map(function (b) {
        return '<li><span class="hm-kicker">' + (b.date ? shortDate(isoDay(b.date)) : '') + '</span><a href="' + esc(b.url) + '">' + esc(b.title) + '</a></li>';
      }).join('') + '</ul>';
    R.arts.innerHTML = items.slice(4, 10).map(function (a) {
      return '<article class="hm-art' + (a.image ? '' : ' noimg') + '"><a href="' + esc(a.url) + '" tabindex="-1" aria-hidden="true">' + img(a) + '</a>' +
        '<div class="hm-kicker">' + (a.date ? shortDate(isoDay(a.date)) : '') + '</div>' +
        '<h3><a href="' + esc(a.url) + '">' + esc(a.title) + '</a></h3><p>' + esc(a.desc) + '</p></article>';
    }).join('');
  }).catch(function () { R.lead.innerHTML = '<div class="rule"><h2><a href="https://britainelects.substack.com">Read Britain Elects on Substack</a></h2></div>'; });

  /* ---- polls: latest figures and a past-year chart -------------------------------- */
  getJSON(VI + 'page.json').then(function (index) {
    var g = index.groups.filter(function (x) { return x.id === 'overall'; })[0], days = index.changeDays || 60;
    var sumNow = 0, sumAgo = 0;
    var rows = g.cards.map(function (p) { sumNow += g.latest[p]; sumAgo += g.ago[p]; return { k: p, st: party(p), v: g.latest[p], c: g.latest[p] - g.ago[p] }; })
      .sort(function (a, b) { return b.v - a.v; });
    var top = rows[0], second = rows[1], gap = Math.round(+f1(top.v) * 10 - +f1(second.v) * 10) / 10;
    if (g.cards.length === 5) rows.push({ k: 'Oth', st: party('oth'), v: Math.max(0, 100 - sumNow), c: Math.max(0, 100 - sumNow) - Math.max(0, 100 - sumAgo) });
    R.pollsum.innerHTML = '<b style="color:' + top.st.ink + '">' + esc(cap(top.st.the)) + '</b> ' + (gap === 0 ? 'and' : 'lead') + ' <b style="color:' + second.st.ink + '">' + esc(second.st.the) + '</b>' +
      (gap === 0 ? ' are level.' : ' by ' + f1(gap) + (gap === 1 ? ' point.' : ' points.'));
    R.pollrows.innerHTML = rows.map(function (r) {
      return '<div class="hm-row"><i style="background:' + r.st.fill + '"></i><span class="nm" style="color:' + r.st.ink + '">' + esc(r.st.name) + '</span>' +
        '<span class="v" style="color:' + r.st.ink + '">' + f1(r.v) + '%</span><span class="c">' + signed(r.c) + '</span></div>';
    }).join('');
    R.pollasof.textContent = 'Latest data, ' + longDate(g.end) + ' · changes on ' + days + ' days ago';
    return getJSON(VI + g.file).then(function (data) { miniChart(g, data); });  // end labels use g.latest, as the table does
  }).catch(function () { R.pollsum.textContent = 'Poll data could not be loaded.'; });

  function miniChart(g, data) {
    var el = R.pollchart, W = Math.round(el.getBoundingClientRect().width) || 360, H = Math.round(el.getBoundingClientRect().height) || 190;
    var start = g.end - 365, ML = 22, MR = 66, MT = 8, MB = 22, plotW = W - ML - MR, svg = '', ov = '', vmax = 0, series = [];
    function X(d) { return ML + (d - start) / 365 * plotW; }
    g.cards.forEach(function (p) {
      var segs = (data[p] ? data[p].segs : []).map(lines).map(function (pts) { return pts.filter(function (q) { return q[0] >= start; }); }).filter(function (pts) { return pts.length > 1; });
      segs.forEach(function (pts) { pts.forEach(function (q) { vmax = Math.max(vmax, q[1]); }); });
      if (segs.length) series.push({ k: p, st: party(p), segs: segs });
    });
    var yMax = Math.max(30, Math.ceil((vmax + 3) / 10) * 10);
    function Y(v) { return MT + (1 - v / yMax) * (H - MT - MB); }
    for (var v = 10; v <= yMax; v += 10) {
      svg += '<line x1="' + ML + '" x2="' + (W - MR) + '" y1="' + Y(v).toFixed(1) + '" y2="' + Y(v).toFixed(1) + '" stroke="' + GRID + '"/>';
      ov += '<div style="left:0;width:' + (ML - 4) + 'px;text-align:right;top:' + (Y(v) - 7).toFixed(1) + 'px">' + (v === yMax ? v + '%' : v) + '</div>';
    }
    var halos = '', strokes = '', ends = [];
    series.forEach(function (s) {
      s.segs.forEach(function (pts) {
        var d = pathOf(pts.map(function (q) { return [X(q[0]), Y(q[1])]; }));
        halos += '<path d="' + d + '" fill="none" stroke="' + HALO + '" stroke-width="6" stroke-linejoin="round"/>';
        strokes += '<path d="' + d + '" fill="none" stroke="' + s.st.fill + '" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>';
      });
      var last = s.segs[s.segs.length - 1], q = last[last.length - 1];
      ends.push({ st: s.st, x: X(q[0]), v: g.latest[s.k] != null ? g.latest[s.k] : q[1], y0: Y(q[1]) });
    });
    svg += halos + strokes + '<line x1="' + ML + '" x2="' + (W - MR) + '" y1="' + (H - MB) + '" y2="' + (H - MB) + '" stroke="' + BASE + '" stroke-width="1.25"/>';
    for (var mi = parts(start).y * 12 + parts(start).m + 1; ; mi++) {
      var yy = Math.floor(mi / 12), mm = mi % 12, dd = dayOf(yy, mm, 1);
      if (dd > g.end) break;
      if (mm % 3 === 0) {
        var x = X(dd).toFixed(1);
        svg += '<line x1="' + x + '" x2="' + x + '" y1="' + (H - MB) + '" y2="' + (H - MB + 5) + '" stroke="' + BASE + '"/>';
        ov += '<div style="left:' + x + 'px;top:' + (H - MB + 7) + 'px;transform:translateX(-50%)">' + (mm === 0 ? yy : MON[mm]) + '</div>';
      }
    }
    spread(ends, 15, MT + 4, H - MB - 6);
    ends.forEach(function (e) {
      svg += '<circle cx="' + e.x.toFixed(1) + '" cy="' + e.y0.toFixed(1) + '" r="5.5" fill="' + HALO + '"/><circle cx="' + e.x.toFixed(1) + '" cy="' + e.y0.toFixed(1) + '" r="3.5" fill="' + HALO + '" stroke="' + e.st.fill + '" stroke-width="2"/>';
      ov += '<div style="left:' + (e.x + 8).toFixed(1) + 'px;top:' + (e.y - 7).toFixed(1) + 'px;color:' + e.st.ink + ';font-weight:700;font-size:12px">' + f1(e.v) + '</div>';
    });
    el.innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" aria-hidden="true">' + svg + '</svg><div class="ov">' + ov + '</div>';
  }

  /* ---- party leaders: net ratings with a past-year sparkline ------------------------ */
  getJSON(LEADERS + 'page.json').then(function (index) {
    var g = index.groups.filter(function (x) { return x.id === 'overall'; })[0];
    R.ldasof.textContent = 'Net rating (positive minus negative) · latest data, ' + longDate(g.end);
    var rows = index.leaders.filter(function (L) { return g.leaders[L.surname]; }).map(function (L) {
      var m = g.leaders[L.surname]; return { L: L, net: m.pos - m.neg };
    }).sort(function (a, b) { return b.net - a.net; });
    function draw(data) {
      var from = g.end - 365, lo = 0, hi = 0, pts = {};
      if (data) rows.forEach(function (r) {
        pts[r.L.surname] = [];
        data[r.L.surname].net.map(lines).forEach(function (seg) { seg.forEach(function (q) { if (q[0] >= from) { pts[r.L.surname].push(q); lo = Math.min(lo, q[1]); hi = Math.max(hi, q[1]); } }); });
      });
      var root = (window.BE_SITE && window.BE_SITE.root) || '';
      R.leaders.innerHTML = rows.map(function (r) {
        var fill = BE.fill(r.L.party), ink = BE.text(r.L.party), netInk = BE.signal(r.net >= 0 ? 'positive' : 'negative', 'text'), spark = '';
        var p = pts[r.L.surname];
        if (p && p.length > 1) {
          var sx = function (d) { return (d - from) / 365 * 200; }, sy = function (v) { return 3 + (hi - v) / ((hi - lo) || 1) * 24; };
          spark = '<svg viewBox="0 0 200 30" preserveAspectRatio="none" aria-hidden="true"><line x1="0" x2="200" y1="' + sy(0).toFixed(1) + '" y2="' + sy(0).toFixed(1) + '" stroke="#CCCCCC" stroke-dasharray="2 2" vector-effect="non-scaling-stroke"/>' +
            '<path d="' + pathOf(p.map(function (q) { return [sx(q[0]), sy(q[1])]; })) + '" fill="none" stroke="' + fill + '" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linejoin="round"/></svg>';
        }
        return '<a class="hm-ld" href="' + esc(root + r.L.url) + '"><i style="background:' + fill + '"></i><div>' +
          '<span class="nm" style="color:' + ink + '">' + esc(r.L.name) + '</span><span class="role">' + esc(r.L.role) + '</span>' +
          spark + '<span class="num" style="color:' + netInk + '">' + signed(r.net) + '</span></div></a>';
      }).join('');
    }
    draw(null);
    return getJSON(LEADERS + g.file).then(draw);
  }).catch(function () {});
})();
