/* SBPress 플러그인 · 인쇄용 스타일 (print-friendly)  v1.1.1
   글을 인쇄하거나 PDF로 저장할 때 머리글·메뉴·버튼·댓글을 숨기고 본문만 남깁니다. (addCss 훅)
   설정(v10.2): hide_chrome(머리글/바닥글 숨김) · font_size_px(본문 글자 크기)
   화면 모습은 그대로이고 @media print 에서만 적용됩니다. */
(function () {
  "use strict";
  if (!window.SBPress) return;

  function cssFor(s) {
    var hide = s.hide_chrome !== false;
    var size = Number(s.font_size_px);
    if (!isFinite(size) || size < 10 || size > 24) size = 16;
    var rules = ["@media print{"];
    if (hide) {
      rules.push("  .site-header,.site-footer,#tabs,.pager,.board-switch,.post-share,.post-cmt,",
                 "  .search-form,.search-filters,#sbp-floating,.admin-bar,.skip,.lang-switch,",
                 "  .header-search,.btn,.rowlink,.arc-tools,.map-tools{display:none!important}");
    }
    rules.push("  body{background:#fff!important;color:#000}");
    rules.push("  .post-body,.article-body,.page-body{font-size:" + size + "px!important;line-height:1.75}");
    rules.push("  .view[hidden]{display:none!important}");
    rules.push("  .post-body,.view .wrap{max-width:100%!important;padding:0 6mm!important}");
    rules.push("  .post-body a[href^='http']::after{content:' (' attr(href) ')';font-size:.8em;color:#555}");
    rules.push("  .post-title,.page-title{font-size:1.5rem;line-height:1.35}");
    rules.push("  img{max-width:100%!important;page-break-inside:avoid}");
    rules.push("  h1,h2,h3{page-break-after:avoid}");
    rules.push("}");
    rules.push("@page{margin:16mm 14mm}");
    return rules.join("\n");
  }

  window.SBPress.registerPlugin({
    id: "print-friendly",
    name: "인쇄용 스타일",
    version: "1.1.1",
    author: (window.SBP && window.SBP.brandName ? window.SBP.brandName() : "SBPress"),
    description: "인쇄·PDF 저장 때 메뉴와 버튼을 숨기고 본문만 또렷하게 남깁니다.",
    settings: { hide_chrome: true, font_size_px: 16 },
    manifest: {
      v: 1, name: "인쇄용 스타일", version: "1.1.1",
      author: (window.SBP && window.SBP.brandName ? window.SBP.brandName() : "SBPress"),
      hooks: ["css"], permissions: ["css:inject"]
    },
    setup: function (ctx) {
      ctx.addCss(cssFor(ctx.getSettings()));

      /* 설정을 저장하면 인쇄 스타일을 그 자리에서 다시 씁니다(새로고침 없이). */
      ctx.onSettingsChange(function (s) {
        var el = document.getElementById("sbp-css-print-friendly");
        if (el) el.textContent = cssFor(s);
      });
    }
  });
})();
