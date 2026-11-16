/* Britain Elects homepage: latest Substack posts plus snapshots of the poll and leader trackers.
   Reads the same benma files as the tracker pages; colours and names from the style guide (be.js). */
(function () {
  'use strict';
  var BE = window.BE;
  var DATA = 'https://raw.githubusercontent.com/glasgow46239/benma/main/';
  var VI = DATA + 'trackers/vi_westminster_24/data/', LEADERS = DATA + 'site/leaders/', ARTICLES = DATA + 'site/articles.json';
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var MONTH = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var INK = BE.neutral('ink'), MINUS = '−';
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
  function party(k) { if (k === 'Oth') k = 'oth'; return { name: BE.name(k, 'general'), the: BE.name(k, 'analysis'), short: BE.name(k, 'short'), fill: BE.fill(k) || '#A9ACA8', ink: BE.text(k) || INK }; }
  function lines(seg) {  // decode one exported segment into [[day, value], ...]
    var d = seg.d0, out = [[d, seg.m[0] / 10]];
    for (var i = 0; i < seg.dd.length; i++) { d += seg.dd[i]; out.push([d, seg.m[i + 1] / 10]); }
    return out;
  }

  /* ---- Substack: the lead story centred between two columns, as on the Substack home page ---- */
  var BYLINE = 'Ben Walker', ICON = 'https://glasgow46239.github.io/style/logo/mark-mono-black.svg';
  function pic(a, lead) {
    var inner = a.image ? '<img src="' + esc(a.image) + '" alt="" loading="' + (lead ? 'eager' : 'lazy') + '">' : '<span class="ph"><img src="' + ICON + '" alt=""></span>';
    return '<a class="pic" href="' + esc(a.url) + '" tabindex="-1" aria-hidden="true">' + inner + '</a>';
  }
  function meta(a) { return '<div class="hm-meta">' + (a.date ? shortDate(isoDay(a.date)) + ' · ' : '') + BYLINE + '</div>'; }
  function story(a, cls, lead) {
    return '<article class="' + cls + '">' + pic(a, lead) + '<h3><a href="' + esc(a.url) + '">' + esc(a.title) + '</a></h3>' +
      (a.desc ? '<p>' + esc(a.desc) + '</p>' : '') + meta(a) + '</article>';
  }
  getJSON(ARTICLES).then(function (feed) {
    var items = (feed.items || []).filter(function (a) { return a.title && a.url; });
    if (!items.length) throw new Error('empty');
    var side = function (list) { return '<div class="col">' + list.map(function (a) { return story(a, 'hm-card'); }).join('') + '</div>'; };
    R.feed.innerHTML = story(items[0], 'hm-lead', true) + side(items.slice(1, 3)) + side(items.slice(3, 5));
    var more = items.slice(5, 11);
    if (more.length) {
      R.arts.innerHTML = more.map(function (a) { return story(a, 'hm-card'); }).join('');
      R.moresec.hidden = false;
    }
  }).catch(function () { R.feed.innerHTML = '<p><a href="https://britainelects.substack.com">Read Britain Elects on Substack</a></p>'; });

  /* ---- polls: Britain Predicts-style tiles, as on the poll tracker ------------------------ */
  function tile(fill, num, chg, label) {
    return '<div class="tr-card" style="--fill:' + fill + '"><div class="num">' + num + '<small>%</small></div><div class="chg">' + chg + '</div><div class="rule"></div><div class="nm">' + esc(label) + '</div></div>';
  }
  getJSON(VI + 'page.json').then(function (index) {
    var g = index.groups.filter(function (x) { return x.id === 'overall'; })[0], days = index.changeDays || 60;
    var sumNow = 0, sumAgo = 0;
    var rows = g.cards.map(function (p) { sumNow += g.latest[p]; sumAgo += g.ago[p]; return { k: p, st: party(p), v: g.latest[p], c: g.latest[p] - g.ago[p] }; })
      .sort(function (a, b) { return b.v - a.v; });
    var top = rows[0], second = rows[1], gap = Math.round(+f1(top.v) * 10 - +f1(second.v) * 10) / 10;
    if (g.cards.length === 5) rows.push({ k: 'Oth', st: party('oth'), v: Math.max(0, 100 - sumNow), c: Math.max(0, 100 - sumNow) - Math.max(0, 100 - sumAgo) });
    R.pollsum.innerHTML = '<b style="color:' + top.st.ink + '">' + esc(cap(top.st.the)) + '</b> ' + (gap === 0 ? 'and' : 'lead') + ' <b style="color:' + second.st.ink + '">' + esc(second.st.the) + '</b>' +
      (gap === 0 ? ' are level.' : ' by ' + f1(gap) + (gap === 1 ? ' point.' : ' points.'));
    R.pollcards.innerHTML = rows.map(function (r) { return tile(r.st.fill, f1(r.v), signed(r.c), r.st.short); }).join('');
    R.pollasof.textContent = 'Latest data, ' + longDate(g.end) + ' · changes on ' + days + ' days ago';
  }).catch(function () { R.pollsum.textContent = 'Poll data could not be loaded.'; });

  /* ---- party leaders: net ratings with a past-year sparkline ------------------------ */
  getJSON(LEADERS + 'page.json').then(function (index) {
    var g = index.groups.filter(function (x) { return x.id === 'overall'; })[0];
    R.ldasof.textContent = 'Net rating (positive minus negative) · latest data, ' + longDate(g.end);
    var rows = index.leaders.filter(function (L) { return g.leaders[L.surname]; }).map(function (L) {
      var m = g.leaders[L.surname]; return { L: L, net: m.pos - m.neg, pos: m.pos, neg: m.neg };
    }).sort(function (a, b) { return b.net - a.net; });
    function draw(data) {
      var from = g.end - 365, lo = 0, hi = 0, pts = {};
      if (data) rows.forEach(function (r) {
        pts[r.L.surname] = [];
        data[r.L.surname].net.map(lines).forEach(function (seg) { seg.forEach(function (q) { if (q[0] >= from) { pts[r.L.surname].push(q); lo = Math.min(lo, q[1]); hi = Math.max(hi, q[1]); } }); });
      });
      var root = (window.BE_SITE && window.BE_SITE.root) || '';
      R.leaders.innerHTML = rows.map(function (r, i) {
        var fill = BE.fill(r.L.party), spark = '', p = pts[r.L.surname];
        if (p && p.length > 1) {
          var sx = function (d) { return (d - from) / 365 * 200; }, sy = function (v) { return 3 + (hi - v) / ((hi - lo) || 1) * 28; };
          spark = '<svg viewBox="0 0 200 34" preserveAspectRatio="none" aria-hidden="true"><line x1="0" x2="200" y1="' + sy(0).toFixed(1) + '" y2="' + sy(0).toFixed(1) + '" stroke="rgba(255,255,255,0.55)" stroke-dasharray="2 2" vector-effect="non-scaling-stroke"/>' +
            '<path d="' + pathOf(p.map(function (q) { return [sx(q[0]), sy(q[1])]; })) + '" fill="none" stroke="#FFFFFF" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linejoin="round"/></svg>';
        }
        return '<a class="ld-card" href="' + esc(root + r.L.url) + '" style="--fill:' + fill + '"><span class="num">' + signed(r.net) + '<small>net</small></span>' +
          '<span class="pn">Positive <b>' + f1(r.pos) + '%</b><br>Negative <b>' + f1(r.neg) + '%</b></span>' + spark +
          '<span class="rule"></span><span class="lab"><span class="rk">' + (i + 1) + '</span><span class="nm">' + esc(r.L.surname) + '</span></span><span class="role">' + esc(r.L.role) + '</span></a>';
      }).join('');
    }
    draw(null);
    return getJSON(LEADERS + g.file).then(draw);
  }).catch(function () {});
})();
