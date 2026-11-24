/* SBPress 플러그인 · 통합 검색 바로가기 (quick-search)
   헤더 메뉴 끝에 '통합 검색'(#/search)을 더합니다. (addMenuItem 훅)
   사이트가 #/search 화면을 가진 v2.0 이상에서 동작합니다. */
(function () {
  "use strict";
  if (!window.SBPress) return;

  var en = !!(window.CRAFT_I18N && window.CRAFT_I18N.isEn && window.CRAFT_I18N.isEn());

  window.SBPress.registerPlugin({
    id: "quick-search",
    name: "통합 검색 바로가기",
    version: "1.0.1",
    author: (window.SBP && window.SBP.brandName ? window.SBP.brandName() : "SBPress"),
    description: "헤더 메뉴에 통합 검색을 더해 어느 화면에서든 글·페이지를 바로 찾게 합니다.",
    manifest: {
      v: 1, name: "통합 검색 바로가기", version: "1.0.1",
      author: (window.SBP && window.SBP.brandName ? window.SBP.brandName() : "SBPress"),
      hooks: ["menu", "css"], permissions: ["nav:menu", "css:inject"]
    },
    setup: function (ctx) {
      ctx.addCss([
        ".tab-sbp[data-sbp-plugin='quick-search']{display:inline-flex;align-items:center;gap:6px}",
        ".tab-sbp[data-sbp-plugin='quick-search']::before{",
        "content:'';width:13px;height:13px;flex:none;background:currentColor;opacity:.75;",
        "-webkit-mask:radial-gradient(circle at 60% 40%,transparent 4.2px,#000 4.6px) center/contain no-repeat,",
        "linear-gradient(#000,#000) 78% 78%/2px 7px no-repeat;",
        "mask:radial-gradient(circle at 60% 40%,transparent 4.2px,#000 4.6px) center/contain no-repeat,",
        "linear-gradient(#000,#000) 78% 78%/2px 7px no-repeat;",
        "transform:rotate(0deg)}",
        "@media print{.tab-sbp[data-sbp-plugin='quick-search']{display:none!important}}"
      ].join(""));
      ctx.addMenuItem({
        id: "quick-search",
        label_ko: "통합 검색",
        label_en: "Search",
        href: "#/search"
      });
      /* 언어를 바꿔도 메뉴 이름이 따라가도록 한 번 알려 줍니다. */
      if (en && window.CRAFT_I18N && window.CRAFT_I18N.onChange) {
        window.CRAFT_I18N.onChange(function () { window.SBPress.renderMenu(); });
      }
    }
  });
})();
