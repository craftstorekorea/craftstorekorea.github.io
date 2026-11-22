#!/usr/bin/env python3
"""SBPress · 정적 SEO 스냅숏 생성기 (공개 읽기 전용)

site/sbpress.config.json 의 Supabase 주소에서 **공개 글·페이지**를 anon(publishable) 키로 읽어
검색엔진이 그대로 읽을 수 있는 정적 HTML 을 만듭니다.

  · 글   → site/post/<slug|id>/index.html     (제목·설명·OG·canonical·본문)
  · 페이지 → site/p/<slug>/index.html
  · site/sitemap.xml · site/rss.xml 도 함께 갱신 (정적 주소 포함)

본문은 posts.body_format(text | markdown | html)에 맞춰 서버에서 HTML 로 바꾸고,
화이트리스트로 걸러 낸 뒤 넣습니다(스크립트·이벤트 속성·javascript: 주소 제거).
각 정적 페이지에는 인터랙티브 화면(/#/post/<slug>)으로 가는 링크가 있습니다.

  python3 build_static_seo.py            # 생성 (site/post · site/p · sitemap · rss)
  python3 build_static_seo.py --check    # 생성된 파일 검사만
  python3 build_static_seo.py --clean    # 생성 폴더 비우기 (site/post · site/p)
  python3 build_static_seo.py --csp      # 고정 페이지(index·admin·privacy·terms)의 CSP meta 를 맞춤
"""
import html
import json
import os
import re
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from email.utils import format_datetime
from html.parser import HTMLParser
from xml.sax.saxutils import escape

HERE = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.join(HERE, "site")
if not os.path.isdir(SITE):
    # 저장소 안(site/scripts/)에 함께 두고 GitHub Actions 가 돌리는 경우 — 저장소 루트가 사이트 폴더입니다.
    SITE = os.path.dirname(HERE)


# ---------------------------------------------------------------- site config
# 사이트마다 다른 값은 site/sbpress.config.json 한 곳에서 읽습니다.
def load_config():
    path = os.path.join(SITE, "sbpress.config.json")
    cfg = {}
    if os.path.exists(path):
        try:
            with open(path, encoding="utf-8") as f:
                cfg = json.load(f) or {}
        except Exception as e:
            raise SystemExit("sbpress.config.json 을 읽지 못했습니다: %s" % e)
    sb = cfg.get("supabase") or {}
    return {
        "key": str(sb.get("anonKey") or ""),
        "url": str(sb.get("url") or "").rstrip("/"),
        "base": str(cfg.get("siteUrl") or "").rstrip("/"),
        "name": str(cfg.get("siteName") or ""),
        "tagline": str(cfg.get("tagline") or ""),
        "title": str(cfg.get("siteTitle") or ""),
        "description": str(cfg.get("description") or ""),
        "features": cfg.get("features") or {},
        "owner": str(cfg.get("ownerEmail") or ""),
    }


CFG = load_config()
KEY = CFG["key"] or os.environ.get("SUPABASE_ANON_KEY", "")
URL = CFG["url"] or os.environ.get("SUPABASE_URL", "")
BASE = CFG["base"] or os.environ.get("SITE_URL", "")
SITE_NAME = CFG["name"] or "SBPress"
SITE_TAGLINE = CFG["tagline"]
SITE_TITLE = CFG["title"] or SITE_NAME
SITE_DESC = CFG["description"]
FEATURES = CFG["features"]
POST_DIR = os.path.join(SITE, "post")
PAGE_DIR = os.path.join(SITE, "p")
CAT_BOARD = {"소개": "intro", "뉴스": "news", "인터뷰": "interview", "정보": "info"}

FIXED_ROUTES = [
    ("/", "1.0", "daily"),
    ("/#/workshops", "0.8", "weekly"),
    ("/#/news", "0.9", "daily"),
    ("/#/interview", "0.7", "weekly"),
    ("/#/info", "0.7", "weekly"),
    ("/#/archive", "0.6", "monthly"),
    ("/#/map", "0.8", "weekly"),
]
if FEATURES.get("map") is False:
    FIXED_ROUTES = [r for r in FIXED_ROUTES if r[0] != "/#/map"]

# ---------------------------------------------------------------- CSP (v1.3 보안)
# 사이트가 실제로 쓰는 곳만 열어 둡니다. 'unsafe-eval' 은 넣지 않습니다.
#   Supabase(REST·Storage·Realtime wss) · GA4 · Google Fonts · jsDelivr(플러그인 마켓)
#   · 127.0.0.1/localhost(로컬 미리보기·검증) · 이미지·영상은 관리자가 붙이는 외부 주소를 막지 않도록 https/http
SITE_HOST = URL.replace("https://", "").replace("http://", "") if URL else ""
CSP_SITE = "; ".join([
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "script-src 'self' 'unsafe-inline'" + ((" https://" + SITE_HOST) if SITE_HOST else "") +
    " https://www.googletagmanager.com https://www.google-analytics.com https://cdn.jsdelivr.net"
    " http://127.0.0.1:* http://localhost:*",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    "img-src 'self' data: blob: https: http:",
    "connect-src 'self'" + ((" https://%s wss://%s" % (SITE_HOST, SITE_HOST)) if SITE_HOST else "") +
    " https://www.google-analytics.com https://*.google-analytics.com "
    "https://*.analytics.google.com https://www.googletagmanager.com https://cdn.jsdelivr.net "
    "https://raw.githubusercontent.com https://docs.google.com http://127.0.0.1:* http://localhost:*",
    "frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com",
    "media-src 'self' https: blob:",
    "form-action 'self'",
])

# 정적 글·페이지는 스크립트를 거의 쓰지 않습니다 — ‘링크 복사 · 공유하기’ 한 가지만
# 같은 사이트의 /assets/share.js 로 허용하고 나머지는 그대로 막습니다(인라인 스크립트 없음).
CSP_STATIC = "; ".join([
    "default-src 'none'",
    "base-uri 'self'",
    "script-src 'self'",
    "img-src 'self' data: https: http:",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    "form-action 'self'",
])

CSP_PAGES = ["index.html", "admin.html", "privacy.html", "terms.html"]
CSP_MARK = "<!-- CSP: SBPress v2.0 — build_static_seo.py --csp 로 갱신 (사이트마다 Supabase 주소가 다릅니다) -->"


# ---------------------------------------------------------------- REST
def req(path):
    r = urllib.request.Request(
        URL + "/rest/v1/" + path,
        headers={"apikey": KEY, "Authorization": "Bearer " + KEY, "Accept": "application/json"},
    )
    try:
        with urllib.request.urlopen(r, timeout=60) as res:
            return json.loads(res.read().decode() or "[]")
    except urllib.error.HTTPError as e:
        raise SystemExit("REST %s → HTTP %s: %s" % (path, e.code, e.read().decode()[:300]))


def load():
    contents = {r["key"]: (r.get("value") or "") for r in req("site_contents?select=key,value")}
    boards = [b for b in req("boards?select=slug,name,description,is_active,sort_order&order=sort_order")
              if b.get("is_active") is not False]
    pages = req("pages?select=slug,title,subtitle,body,body_format,is_published,deleted_at,updated_at,created_at"
                "&is_published=eq.true&order=sort_order")
    posts = req("posts?select=id,slug,category,title,summary,body,body_format,region,source_name,source_url,"
                "image_url,deadline,published_at,updated_at,created_at,status,is_published,publish_at,deleted_at,"
                "sort_order,is_pinned,meta&is_published=eq.true&order=published_at.desc&limit=500")

    now = datetime.now(timezone.utc)
    live = []
    for p in posts:
        if p.get("deleted_at") or p.get("status") == "draft":
            continue
        pa = p.get("publish_at")
        if pa:
            try:
                if datetime.fromisoformat(str(pa).replace("Z", "+00:00")) > now:
                    continue
            except Exception:
                pass
        live.append(p)
    pages = [p for p in pages if not p.get("deleted_at")]
    return contents, boards, pages, live


# ---------------------------------------------------------------- HTML 정리
ALLOWED = {
    "p": (), "br": (), "strong": (), "b": (), "em": (), "i": (), "u": (), "s": (), "del": (), "ins": (),
    "mark": (), "h1": (), "h2": (), "h3": (), "h4": (), "h5": (), "h6": (), "a": ("href", "title"),
    "ul": (), "ol": ("start",), "li": (), "blockquote": (), "code": (), "pre": (),
    "img": ("src", "alt", "title"), "hr": (), "figure": (), "figcaption": (), "span": (), "div": (),
    "table": (), "thead": (), "tbody": (), "tr": (), "td": ("colspan", "rowspan"), "th": ("colspan", "rowspan"),
}
DROP = {"script", "style", "iframe", "object", "embed", "form", "input", "button", "textarea", "select",
        "option", "svg", "math", "link", "meta", "base", "video", "audio", "canvas", "noscript", "template"}
VOID = {"br", "hr", "img"}
SELF_CLOSE = set()


def safe_url(raw, kind="link"):
    u = re.sub(r"[\x00-\x20]+", "", str(raw or "")).strip()
    if not u:
        return ""
    low = u.lower()
    if low.startswith(("javascript:", "vbscript:", "data:text/html")):
        return ""
    if kind == "img":
        return u if (re.match(r"^(https?:)?//", u, re.I) or re.match(r"^[./\w-]", u)) else ""
    if re.match(r"^(https?:|mailto:|tel:)", u, re.I) or u[:1] in "#/?" or re.match(r"^[\w.-]+(/|$)", u):
        return u
    return ""


class Cleaner(HTMLParser):
    """화이트리스트로만 태그·속성을 남깁니다(DOMParser + 정화와 같은 규칙)."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.out = []
        self.stack = []
        self.drop_depth = 0

    def handle_starttag(self, tag, attrs):
        tag = tag.lower()
        if tag in DROP:
            if tag not in VOID:
                self.drop_depth += 1
            return
        if self.drop_depth:
            return
        if tag not in ALLOWED:
            return
        a = {}
        for k, v in attrs:
            if k.startswith("on") or k in ("style", "class", "id", "target", "rel"):
                continue
            if k in ALLOWED[tag]:
                a[k] = v or ""
        if tag == "img":
            src = safe_url(a.get("src"), "img")
            if not src:
                return
            self.out.append('<img src="%s" alt="%s"%s loading="lazy">' % (
                html.escape(src, quote=True), html.escape(a.get("alt", ""), quote=True),
                (' title="%s"' % html.escape(a["title"], quote=True)) if a.get("title") else ""))
            return
        parts = ["<%s" % tag]
        for k in ALLOWED[tag]:
            if k in a and a[k] != "":
                v = a[k]
                if k == "href":
                    v = safe_url(v)
                    if not v:
                        continue
                    parts.append(' href="%s"' % html.escape(v, quote=True))
                    if v.lower().startswith(("http://", "https://")):
                        parts.append(' target="_blank" rel="noopener noreferrer"')
                elif k in ("colspan", "rowspan", "start"):
                    if not re.match(r"^\d{1,4}$", str(v).strip()):
                        continue
                    parts.append(' %s="%s"' % (k, int(v)))
                else:
                    parts.append(' %s="%s"' % (k, html.escape(str(v), quote=True)))
        parts.append(">")
        self.out.append("".join(parts))
        if tag not in VOID:
            self.stack.append(tag)

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)

    def handle_endtag(self, tag):
        tag = tag.lower()
        if tag in DROP:
            if tag not in VOID and self.drop_depth:
                self.drop_depth -= 1
            return
        if self.drop_depth or tag not in ALLOWED or tag in VOID:
            return
        # 가장 가까운 같은 태그까지 닫습니다.
        if tag in self.stack:
            while self.stack:
                t = self.stack.pop()
                self.out.append("</%s>" % t)
                if t == tag:
                    break

    def handle_data(self, data):
        if self.drop_depth:
            return
        self.out.append(html.escape(data, quote=False))

    def result(self):
        while self.stack:
            self.out.append("</%s>" % self.stack.pop())
        return "".join(self.out)


def sanitize(fragment):
    c = Cleaner()
    c.feed(str(fragment or ""))
    c.close()
    return c.result()


# ---------------------------------------------------------------- markdown (JS 와 같은 규칙)
def _inline(s):
    t = html.escape(str(s or ""), quote=False)

    def code(m):
        return "<code>%s</code>" % m.group(1)

    t = re.sub(r"`([^`\n]+)`", code, t)

    def img(m):
        u = safe_url(m.group(2), "img")
        if not u:
            return html.escape(m.group(1), quote=False)
        return '<img src="%s" alt="%s">' % (html.escape(u, quote=True), html.escape(m.group(1), quote=True))

    t = re.sub(r'!\[([^\]]*)\]\(\s*([^)\s]+)(?:\s+&quot;([^&]*)&quot;)?\s*\)', img, t)

    def link(m):
        u = safe_url(m.group(2))
        if not u:
            return m.group(1)
        ext = ' target="_blank" rel="noopener noreferrer"' if re.match(r"^https?:", u, re.I) else ""
        return '<a href="%s"%s>%s</a>' % (html.escape(u, quote=True), ext, m.group(1))

    t = re.sub(r"\[([^\]]+)\]\(\s*([^)\s]+)\s*\)", link, t)
    t = re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", t)
    t = re.sub(r"__([^_]+)__", r"<strong>\1</strong>", t)
    t = re.sub(r"(^|[^*])\*([^*\n]+)\*", r"\1<em>\2</em>", t)
    t = re.sub(r"~~([^~]+)~~", r"<del>\1</del>", t)
    return t


def markdown(md):
    lines = str(md or "").replace("\r\n", "\n").replace("\r", "\n").split("\n")
    out, i = [], 0
    ul_re = re.compile(r"^\s*[-*+]\s+(.*)$")
    ol_re = re.compile(r"^\s*\d+[.)]\s+(.*)$")

    while i < len(lines):
        line = lines[i]
        if not line.strip():
            i += 1
            continue

        if re.match(r"^\s*```", line):
            i += 1
            buf = []
            while i < len(lines) and not re.match(r"^\s*```\s*$", lines[i]):
                buf.append(lines[i])
                i += 1
            i += 1
            out.append("<pre><code>%s</code></pre>" % html.escape("\n".join(buf), quote=False))
            continue

        m = re.match(r"^(#{1,6})\s+(.*)$", line)
        if m:
            lv = len(m.group(1))
            out.append("<h%d>%s</h%d>" % (lv, _inline(m.group(2)), lv))
            i += 1
            continue

        if re.match(r"^\s*([-*_])\s*(\1\s*){2,}$", line):
            out.append("<hr>")
            i += 1
            continue

        if re.match(r"^\s*>", line):
            q = []
            while i < len(lines) and re.match(r"^\s*>", lines[i]):
                q.append(re.sub(r"^\s*>\s?", "", lines[i]))
                i += 1
            out.append("<blockquote>%s</blockquote>" % markdown("\n".join(q)))
            continue

        if ul_re.match(line) or ol_re.match(line):
            ordered = bool(ol_re.match(line))
            rx = ol_re if ordered else ul_re
            items = []
            while i < len(lines):
                mm = rx.match(lines[i])
                if not mm:
                    break
                text = mm.group(1)
                i += 1
                while i < len(lines) and re.match(r"^\s{2,}\S", lines[i]) \
                        and not ul_re.match(lines[i]) and not ol_re.match(lines[i]):
                    text += " " + lines[i].strip()
                    i += 1
                items.append("<li>%s</li>" % _inline(text))
            tag = "ol" if ordered else "ul"
            out.append("<%s>%s</%s>" % (tag, "".join(items), tag))
            continue

        para = []
        while i < len(lines) and lines[i].strip() \
                and not re.match(r"^\s*```", lines[i]) and not re.match(r"^#{1,6}\s+", lines[i]) \
                and not re.match(r"^\s*>", lines[i]) and not ul_re.match(lines[i]) and not ol_re.match(lines[i]):
            para.append(lines[i])
            i += 1
        out.append("<p>%s</p>" % "<br>".join(_inline(x) for x in para))
    return "\n".join(out)


def body_html(text, fmt):
    raw = str(text or "")
    if not raw.strip():
        return ""
    f = (fmt or "text").lower()
    if f == "markdown":
        return sanitize(markdown(raw))
    if f == "html":
        return sanitize(raw)
    return html.escape(raw, quote=False).replace("\n", "<br>")


# ---------------------------------------------------------------- 날짜
def d10(v):
    return str(v or "")[:10]


def rfc822(v):
    s = str(v or "").strip()
    try:
        if len(s) == 10:
            dt = datetime.strptime(s, "%Y-%m-%d").replace(hour=9, tzinfo=timezone.utc)
        else:
            dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
    except Exception:
        dt = datetime.now(timezone.utc)
    return format_datetime(dt)


def x(s):
    return escape(str(s if s is not None else ""), {'"': "&quot;", "'": "&apos;"})


def post_key(p):
    return str(p.get("slug") or p.get("id") or "").strip()


def page_key(p):
    return str(p.get("slug") or "").strip()


def phone_safe(s, n=160):
    t = re.sub(r"\s+", " ", str(s or "")).strip()
    return t if len(t) <= n else t[: n - 1] + "…"


CSS = """
:root{--bg:#F7F5F2;--card:#FFFDFB;--ink:#3E2F26;--ink-2:#6E5C4F;--ink-3:#7C6759;
--line:#E6DCD1;--accent:#C86D44;--accent-d:#A8542F;--accent-s:#F8E9E0;--wrap:820px}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);line-height:1.8;
font-family:'Nanum Gothic','나눔고딕',-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Malgun Gothic",sans-serif}
a{color:inherit;text-decoration:none}
.wrap{max-width:var(--wrap);margin:0 auto;padding:26px 22px 60px}
.top{display:flex;gap:14px;align-items:center;flex-wrap:wrap;padding:14px 22px;border-bottom:1px solid var(--line);background:var(--card)}
.top a{font-weight:800;letter-spacing:-.01em}
.top .back{margin-left:auto;font-size:.86rem;font-weight:700;color:var(--accent-d)}
.eyebrow{margin:18px 0 6px;color:var(--accent-d);font-size:.82rem;font-weight:800;letter-spacing:.02em}
h1{font-size:clamp(1.5rem,3.2vw,2.1rem);line-height:1.3;margin:0 0 12px;letter-spacing:-.02em}
.meta{display:flex;gap:8px;flex-wrap:wrap;color:var(--ink-3);font-size:.86rem;margin:0 0 22px}
.meta i{font-style:normal;color:#D8C9BA}
img.hero{width:100%;max-height:420px;object-fit:cover;border-radius:16px;margin:0 0 26px}
.body{font-size:1.01rem;color:var(--ink-2);word-break:break-word}
.body p{margin:0 0 16px}.body h2,.body h3,.body h4{color:var(--ink);margin:28px 0 10px;line-height:1.35}
.body ul,.body ol{margin:0 0 16px;padding-left:22px}
.body blockquote{margin:0 0 16px;padding:12px 18px;border-left:3px solid var(--accent);background:var(--accent-s);color:var(--ink)}
.body pre{padding:16px;background:#2f2620;color:#F4EDE6;border-radius:12px;overflow:auto}
.body code{background:#F0EAE2;border-radius:5px;padding:1px 5px}
.body pre code{background:none;padding:0;color:inherit}
.body img{max-width:100%;border-radius:12px;margin:16px 0}
.body a{color:var(--accent-d);text-decoration:underline}
.body hr{border:0;border-top:1px solid var(--line);margin:26px 0}
.body table{width:100%;border-collapse:collapse;margin:0 0 16px}
.body th,.body td{border:1px solid var(--line);padding:8px 10px;text-align:left}
.tags{display:flex;gap:8px;flex-wrap:wrap;margin:24px 0 0}
.chip{font-size:.76rem;font-weight:700;background:var(--accent-s);color:var(--accent-d);border-radius:999px;padding:3px 10px}
.foot{margin-top:26px;padding-top:18px;border-top:1px solid var(--line);display:flex;gap:18px;flex-wrap:wrap;font-size:.88rem;font-weight:700}
.foot a{color:var(--accent-d)}
.spa{margin-top:22px;padding:14px 18px;background:var(--card);border:1px solid var(--line);border-radius:12px;font-size:.9rem}
footer{margin-top:34px;color:var(--ink-3);font-size:.8rem;text-align:center}
.share-bar{display:flex;gap:10px;flex-wrap:wrap;margin:18px 0 0}
.share-btn{display:inline-flex;align-items:center;gap:7px;padding:9px 16px;border:1px solid #D8C9BA;
border-radius:999px;background:#fff;color:var(--ink-2);font:inherit;font-size:.85rem;font-weight:700;cursor:pointer}
.share-btn:hover{border-color:var(--accent);color:var(--accent-d);background:var(--accent-s)}
.share-btn.primary{background:var(--ink);border-color:var(--ink);color:#FBF8F4}
.share-btn.primary:hover{background:var(--accent-d);border-color:var(--accent-d);color:#fff}
.sbp-toast{position:fixed;left:50%;bottom:32px;z-index:50;transform:translate(-50%,10px);max-width:min(92vw,440px);
padding:12px 20px;border-radius:999px;background:var(--ink);color:#FBF8F4;font-size:.86rem;font-weight:700;
text-align:center;box-shadow:0 18px 44px -20px rgba(0,0,0,.6);opacity:0;pointer-events:none;
transition:opacity .2s ease,transform .2s ease}
.sbp-toast.show{opacity:1;transform:translate(-50%,0)}
.sbp-toast.err{background:#8C2B22}
"""


def shell(title, desc, canonical, og_image, inner, spa_href, extra_meta=""):
    og = ""
    if og_image:
        og += '  <meta property="og:image" content="%s">\n' % x(og_image)
    return """<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
%s
<meta http-equiv="Content-Security-Policy" content="%s">
<title>%s</title>
<meta name="description" content="%s">
<meta property="og:type" content="article">
<meta property="og:title" content="%s">
<meta property="og:description" content="%s">
<meta property="og:site_name" content="%s">
%s  <link rel="canonical" href="%s">
<meta name="robots" content="index,follow">
<style>%s</style>
</head>
<body>
<header class="top">
  <a href="/">%s</a>
  <span>%s</span>
  <a class="back" href="%s">인터랙티브 화면에서 보기 →</a>
</header>
<main class="wrap">
%s
<footer>© 2026 %s · <a href="/privacy">개인정보처리방침</a> · <a href="/terms">이용약관</a></footer>
</main>
<script src="/assets/share.js" defer></script>
</body>
</html>
""" % (CSP_MARK, CSP_STATIC, x(title), x(desc), x(title), x(desc), x(SITE_NAME), og,
           x(canonical), CSS, x(SITE_NAME), x(SITE_TAGLINE or SITE_NAME), x(spa_href), inner,
           x(SITE_NAME))


def share_bar(url, title):
    """정적 글·페이지 하단의 ‘링크 복사 · 공유하기’ — 동작은 /assets/share.js 가 맡습니다."""
    return ('<div class="share-bar">'
            '<button type="button" class="share-btn" data-sbp-copy="%s">링크 복사</button>'
            '<button type="button" class="share-btn primary" data-sbp-share data-share-url="%s" '
            'data-share-title="%s">공유하기</button>'
            "</div>\n" % (x(url), x(url), x(title)))


def write(path, text):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(text)


def gen_post(p):
    key = post_key(p)
    if not key:
        return None
    board = CAT_BOARD.get(p.get("category")) or p.get("category") or "news"
    spa = "%s/#/post/%s" % (BASE, key)
    canonical = "%s/post/%s/" % (BASE, key)
    title = p.get("title") or "글"
    desc = phone_safe(p.get("summary") or re.sub(r"<[^>]+>", " ", str(p.get("body") or "")))
    meta = []
    if p.get("source_name"):
        meta.append(x(p["source_name"]))
    if p.get("region"):
        meta.append(x(p["region"]))
    if p.get("published_at"):
        meta.append(x(d10(p["published_at"])))
    hero = ('<img class="hero" src="%s" alt="%s">' % (x(p["image_url"]), x(title))) if p.get("image_url") else ""
    tags = []
    if (p.get("meta") or {}).get("tag"):
        tags.append('<span class="chip">%s</span>' % x(p["meta"]["tag"]))
    if p.get("category"):
        tags.append('<span class="chip">%s</span>' % x(p["category"]))
    if p.get("deadline"):
        tags.append('<span class="chip">마감 %s</span>' % x(d10(p["deadline"])))
    foot = []
    if p.get("source_url"):
        foot.append('<a href="%s" target="_blank" rel="noopener noreferrer">원문 보기</a>' % x(p["source_url"]))
    foot.append('<a href="/#/board/%s">게시판 목록</a>' % x(board))
    inner = (
        '<p class="eyebrow">게시판 · %s</p>\n' % x(p.get("category") or "글") +
        "<h1>%s</h1>\n" % x(title) +
        '<p class="meta">%s</p>\n' % '<i>·</i>'.join(meta) +
        hero +
        '<div class="body">%s</div>\n' % body_html(p.get("body"), p.get("body_format")) +
        ('<div class="tags">%s</div>\n' % "".join(tags) if tags else "") +
        ('<div class="foot">%s</div>\n' % "".join(foot)) +
        share_bar(canonical, title) +
        '<p class="spa">💬 댓글을 쓰거나 다른 글을 보려면 <a href="%s">인터랙티브 화면</a>을 여세요.</p>' % x(spa)
    )
    outp = os.path.join(POST_DIR, key, "index.html")
    write(outp, shell(title + " — " + SITE_NAME, desc, canonical, p.get("image_url") or "", inner, spa))
    return {"key": key, "path": outp, "url": canonical, "spa": spa,
            "title": title, "desc": desc, "updated": d10(p.get("updated_at") or p.get("published_at") or p.get("created_at"))}


def gen_page(p):
    key = page_key(p)
    if not key:
        return None
    spa = "%s/#/page/%s" % (BASE, key)
    canonical = "%s/p/%s/" % (BASE, key)
    title = p.get("title") or "페이지"
    desc = phone_safe(p.get("subtitle") or re.sub(r"<[^>]+>", " ", str(p.get("body") or "")))
    inner = (
        ('<p class="eyebrow">%s · 페이지</p>\n' % x(SITE_NAME)) +
        "<h1>%s</h1>\n" % x(title) +
        ('<p class="meta">%s</p>\n' % x(p.get("subtitle")) if p.get("subtitle") else "") +
        '<div class="body">%s</div>\n' % body_html(p.get("body"), p.get("body_format")) +
        share_bar(canonical, title) +
        '<p class="spa">이 페이지의 인터랙티브 화면: <a href="%s">%s</a></p>' % (x(spa), x(spa))
    )
    outp = os.path.join(PAGE_DIR, key, "index.html")
    write(outp, shell(title + " — " + SITE_NAME, desc, canonical, "", inner, spa))
    return {"key": key, "path": outp, "url": canonical, "spa": spa, "title": title,
            "desc": desc, "updated": d10(p.get("updated_at") or p.get("created_at"))}


def latest_of(posts, pages):
    dates = [d10(p.get("updated_at") or p.get("published_at") or p.get("created_at")) for p in posts]
    dates += [d10(p.get("updated_at") or p.get("created_at")) for p in pages]
    dates = [d for d in dates if d]
    return max(dates) if dates else datetime.now(timezone.utc).strftime("%Y-%m-%d")


def build_sitemap(boards, posts_out, pages_out, posts, pages):
    latest = latest_of(posts, pages)
    urls = [(BASE + loc, latest, pri, freq) for loc, pri, freq in FIXED_ROUTES]
    for b in boards:
        last = ""
        for p in posts:
            if (CAT_BOARD.get(p.get("category")) or p.get("category")) == b["slug"]:
                last = max(last, d10(p.get("published_at")))
        urls.append((BASE + "/#/board/" + b["slug"], last or latest, "0.7", "weekly"))
    for pg in pages_out:
        urls.append((pg["url"], pg["updated"] or latest, "0.6", "monthly"))
    for po in posts_out:
        urls.append((po["url"], po["updated"] or latest, "0.8", "weekly"))
    urls.append((BASE + "/privacy", "2026-11-21", "0.2", "yearly"))
    urls.append((BASE + "/terms", "2026-11-21", "0.2", "yearly"))
    body = "\n".join(
        "  <url>\n    <loc>%s</loc>\n    <lastmod>%s</lastmod>\n"
        "    <changefreq>%s</changefreq>\n    <priority>%s</priority>\n  </url>"
        % (x(loc), x(last), freq, pri) for loc, last, pri, freq in urls
    )
    return ('<?xml version="1.0" encoding="UTF-8"?>\n'
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + body + "\n</urlset>\n")


def build_rss(contents, posts, posts_out):
    title = contents.get("seo_title") or SITE_TITLE
    desc = contents.get("seo_description") or SITE_DESC or (SITE_NAME + " 새 소식")
    latest = max([o["updated"] for o in posts_out if o["updated"]] or [datetime.now(timezone.utc).strftime("%Y-%m-%d")])
    items = []
    for p in posts[:30]:
        key = post_key(p)
        link = "%s/post/%s/" % (BASE, key)
        items.append(
            "    <item>\n      <title>%s</title>\n      <link>%s</link>\n"
            '      <guid isPermaLink="true">%s</guid>\n      <pubDate>%s</pubDate>\n'
            "      <category>%s</category>\n      <description>%s</description>\n    </item>"
            % (x(p.get("title")), x(link), x(link), rfc822(p.get("published_at") or p.get("created_at")),
               x(p.get("category")), x(p.get("summary") or p.get("title")))
        )
    return ('<?xml version="1.0" encoding="UTF-8"?>\n'
            '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">\n  <channel>\n'
            "    <title>%s</title>\n    <link>%s/</link>\n    <description>%s</description>\n"
            "    <language>ko-KR</language>\n    <lastBuildDate>%s</lastBuildDate>\n"
            '    <atom:link href="%s/rss.xml" rel="self" type="application/rss+xml"/>\n'
            % (x(title), BASE, x(desc), rfc822(latest), BASE)
            + ("\n".join(items) + "\n" if items else "") + "  </channel>\n</rss>\n")


def clean():
    import shutil
    for d in (POST_DIR, PAGE_DIR):
        if os.path.isdir(d):
            shutil.rmtree(d)
    print("생성 폴더를 비웠습니다: site/post · site/p")


def check(posts_out=None, pages_out=None):
    import xml.etree.ElementTree as ET
    out = []
    out.extend(check_fixed_csp())
    post_dirs = sorted(d for d in os.listdir(POST_DIR)) if os.path.isdir(POST_DIR) else []
    page_dirs = sorted(d for d in os.listdir(PAGE_DIR)) if os.path.isdir(PAGE_DIR) else []
    bad = []
    for d, base in [(d, POST_DIR) for d in post_dirs] + [(d, PAGE_DIR) for d in page_dirs]:
        f = os.path.join(base, d, "index.html")
        if not os.path.exists(f):
            bad.append(d + " (index.html 없음)")
            continue
        t = open(f, encoding="utf-8").read()
        for need in ('<meta name="description"', 'rel="canonical"', 'property="og:title"', "<h1>",
                     '<meta http-equiv="Content-Security-Policy"', 'data-sbp-share', "/assets/share.js"):
            if need not in t:
                bad.append("%s (%s 없음)" % (d, need))
    out.append("정적 글 %d개 · 페이지 %d개" % (len(post_dirs), len(page_dirs)))
    out.append("형식 문제: " + (", ".join(bad[:6]) if bad else "없음"))
    for path, root_tag in ((os.path.join(SITE, "sitemap.xml"), "urlset"), (os.path.join(SITE, "rss.xml"), "rss")):
        try:
            root = ET.parse(path).getroot()
            tag = root.tag.split("}")[-1]
            if tag != root_tag:
                out.append("%s: 루트가 %s" % (os.path.relpath(path, SITE), tag))
            elif root_tag == "urlset":
                locs = [e.text for e in root.iter() if e.tag.split("}")[-1] == "loc"]
                statics = [l for l in locs if "/post/" in l or "/p/" in l]
                out.append("%s: URL %d개 (정적 %d개)" % (os.path.relpath(path, SITE), len(locs), len(statics)))
            else:
                items = root.findall("./channel/item")
                out.append("%s: item %d건" % (os.path.relpath(path, SITE), len(items)))
        except Exception as e:
            out.append("%s: 읽지 못함 (%s)" % (os.path.relpath(path, SITE), e))
    return out


def apply_csp():
    """index·admin·privacy·terms 의 CSP meta 를 이 파일의 한 곳(CSP_SITE)에서 맞춥니다."""
    tag = CSP_MARK + '\n<meta http-equiv="Content-Security-Policy" content="%s">' % CSP_SITE
    changed, missing = [], []
    for name in CSP_PAGES:
        path = os.path.join(SITE, name)
        if not os.path.exists(path):
            missing.append(name)
            continue
        t = open(path, encoding="utf-8").read()
        new = re.sub(r'<!-- CSP:[^\n]*-->\s*\n?\s*<meta http-equiv="Content-Security-Policy"[^>]*>',
                     lambda m: tag, t, count=1)
        if new == t:
            i = t.find('<meta name="viewport"')
            if i < 0:
                missing.append(name + " (viewport 없음)")
                continue
            j = t.index(">", i) + 1
            new = t[:j] + "\n" + tag + t[j:]
        if new != t:
            write(path, new)
            changed.append(name)
    print("CSP meta 갱신: " + (", ".join(changed) if changed else "변경 없음")
          + ("  ·  없는 파일: " + ", ".join(missing) if missing else ""))
    return 1 if missing else 0


def check_fixed_csp():
    out = []
    bad = []
    for name in CSP_PAGES:
        path = os.path.join(SITE, name)
        if not os.path.exists(path):
            bad.append(name + " (파일 없음)")
            continue
        t = open(path, encoding="utf-8").read()
        if '<meta http-equiv="Content-Security-Policy"' not in t:
            bad.append(name + " (CSP meta 없음)")
        elif "'unsafe-eval'" in t:
            bad.append(name + " (unsafe-eval 포함)")
        elif SITE_HOST and SITE_HOST not in t:
            bad.append(name + " (Supabase 주소 없음)")
    out.append("고정 페이지 CSP %d/%d" % (len(CSP_PAGES) - len(bad), len(CSP_PAGES)))
    if bad:
        out.append("  문제: " + ", ".join(bad))
    return out


def main():
    if "--clean" in sys.argv:
        clean()
        return 0
    if "--csp" in sys.argv:
        return apply_csp()
    if not (KEY and URL and BASE):
        raise SystemExit("site/sbpress.config.json 에 supabase.url · supabase.anonKey · siteUrl 을 채워 주세요.")
    contents, boards, pages, posts = load()
    posts_out, pages_out = [], []
    for p in posts:
        r = gen_post(p)
        if r:
            posts_out.append(r)
    for p in pages:
        r = gen_page(p)
        if r:
            pages_out.append(r)
    write(os.path.join(SITE, "sitemap.xml"), build_sitemap(boards, posts_out, pages_out, posts, pages))
    write(os.path.join(SITE, "rss.xml"), build_rss(contents, posts, posts_out))
    print("글 %d · 페이지 %d → site/post · site/p" % (len(posts_out), len(pages_out)))
    if True:
        for line in check(posts_out, pages_out):
            print(line)
    return 0


if __name__ == "__main__":
    sys.exit(main())
