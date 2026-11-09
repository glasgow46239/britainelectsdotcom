/* Britain Elects website: shared header and footer.
   Every page has <div data-site-header data-active="polls"></div> and <div data-site-footer></div>;
   change the navigation here and it changes on every page. */
(function () {
  var STYLE = 'https://glasgow46239.github.io/style/';
  var me = document.currentScript || document.querySelector('script[src*="assets/site.js"]');
  var ROOT = me.src.replace(/assets\/site\.js.*$/, '');
  window.BE_SITE = { root: ROOT, style: STYLE };

  var NAV = [
    { id: 'polls', label: 'Polls', href: ROOT },
    { id: 'leaders', label: 'Leaders', href: ROOT + 'leaders/' },
    { id: 'predicts', label: 'Britain Predicts', href: 'https://glasgow46239.github.io/britainpredicts/' },
    { id: 'substack', label: 'Substack', href: 'https://britainelects.substack.com' }
  ];

  function header(el) {
    var active = el.getAttribute('data-active');
    el.outerHTML =
      '<header class="site-header"><div class="wrap">' +
      '<a class="brand" href="' + ROOT + '"><img src="' + STYLE + 'logo/wordmark.svg" alt="Britain Elects" width="230" height="26"></a>' +
      '<nav aria-label="Main">' + NAV.map(function (n) {
        return '<a href="' + n.href + '"' + (n.id === active ? ' aria-current="page"' : '') + '>' + n.label + '</a>';
      }).join('') + '</nav></div></header>';
  }
  function footer(el) {
    el.outerHTML =
      '<footer class="site-footer"><div class="wrap">' +
      '<img src="' + STYLE + 'logo/wordmark-mono-black.svg" alt="Britain Elects" width="160" height="18">' +
      '<span>Polling aggregates by Britain Elects. <a href="https://britainelects.substack.com">Read the Substack</a></span>' +
      '</div></footer>';
  }
  document.querySelectorAll('[data-site-header]').forEach(header);
  document.querySelectorAll('[data-site-footer]').forEach(footer);
})();
