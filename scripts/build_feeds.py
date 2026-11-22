#!/usr/bin/env python3
"""SBPress · sitemap.xml · rss.xml 생성기 (공개 읽기 전용)

site/sbpress.config.json 의 Supabase 주소에서 공개 데이터를 anon(publishable) 키로 읽어
GitHub Pages 사이트 폴더에 검색엔진용 sitemap.xml 과 구독용 rss.xml 을 씁니다.

  · boards   : 사용 중(is_active)인 게시판 → /#/board/<slug>
  · pages    : 발행(is_published) 되고 휴지통(deleted_at) 이 아닌 페이지 → /#/page/<slug>
  · posts    : 발행·공개 시각이 지났고 휴지통이 아닌 글 → RSS <item> (최근 30건)
  · 정적 SEO : 글 /post/<slug>/ · 페이지 /p/<slug>/ 도 함께 넣습니다
              (build_static_seo.py 가 만드는 정적 HTML 과 같은 주소)

RLS 가 이미 휴지통·미발행·예약 글을 숨기므로 anon 으로 읽은 값이 곧 공개 상태입니다.
같은 결과를 관리자(/admin → 검색엔진)에서도 버튼으로 만들 수 있습니다.

  python3 build_feeds.py            # site/sitemap.xml · site/rss.xml 갱신
  python3 build_feeds.py --check    # 파일만 검사
"""
import json
import os
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from email.utils import format_datetime
from xml.sax.saxutils import escape

HERE = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.join(HERE, "site")
if not os.path.isdir(SITE):
    # 저장소 안(site/scripts/)에 함께 두고 GitHub Actions 가 돌리는 경우 — 저장소 루트가 사이트 폴더입니다.
    SITE = os.path.dirname(HERE)


def load_config():
    """site/sbpress.config.json 한 곳에서 사이트 값(주소·키·이름)을 읽습니다."""
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
        "title": str(cfg.get("siteTitle") or ""),
        "description": str(cfg.get("description") or ""),
        "features": cfg.get("features") or {},
    }


CFG = load_config()
KEY = CFG["key"] or os.environ.get("SUPABASE_ANON_KEY", "")
URL = CFG["url"] or os.environ.get("SUPABASE_URL", "")
BASE = CFG["base"] or os.environ.get("SITE_URL", "")
SITE_NAME = CFG["name"] or "SBPress"
SITE_TITLE = CFG["title"] or SITE_NAME
SITE_DESC = CFG["description"]
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
if (CFG.get("features") or {}).get("map") is False:
    FIXED_ROUTES = [r for r in FIXED_ROUTES if r[0] != "/#/map"]


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


def x(s):
    return escape(str(s if s is not None else ""), {'"': "&quot;", "'": "&apos;"})


def d10(v):
    return str(v or "")[:10]


def rfc822(v):
    """날짜(YYYY-MM-DD 또는 ISO) → RFC 822 (RSS pubDate)."""
    s = str(v or "").strip()
    try:
        if len(s) == 10:
            dt = datetime.strptime(s, "%Y-%m-%d").replace(hour=9, tzinfo=timezone.utc)  # KST 09:00
        else:
            dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
    except Exception:
        dt = datetime.now(timezone.utc)
    return format_datetime(dt)


def load():
    contents = {r["key"]: (r.get("value") or "") for r in req("site_contents?select=key,value")}
    boards = [b for b in req("boards?select=slug,name,description,is_active,sort_order&order=sort_order")
              if b.get("is_active") is not False]
    pages = req("pages?select=slug,title,is_published,deleted_at,updated_at,created_at"
                "&is_published=eq.true&order=sort_order")
    posts = req("posts?select=slug,title,summary,category,published_at,updated_at,created_at,"
                "source_url,is_published,publish_at,deleted_at,sort_order,is_pinned,status"
                "&is_published=eq.true&order=published_at.desc&limit=80")
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


def latest_of(posts, pages):
    dates = [d10(p.get("updated_at") or p.get("published_at") or p.get("created_at")) for p in posts]
    dates += [d10(p.get("updated_at") or p.get("created_at")) for p in pages]
    dates = [d for d in dates if d]
    return max(dates) if dates else datetime.now(timezone.utc).strftime("%Y-%m-%d")


def build_sitemap(boards, pages, posts):
    latest = latest_of(posts, pages)
    urls = [(BASE + loc, latest, pri, freq) for loc, pri, freq in FIXED_ROUTES]
    for b in boards:
        last = ""
        for p in posts:
            if (CAT_BOARD.get(p.get("category")) or p.get("category")) == b["slug"]:
                last = max(last, d10(p.get("published_at")))
        urls.append((BASE + "/#/board/" + b["slug"], last or latest, "0.7", "weekly"))
    for p in pages:
        last = d10(p.get("updated_at") or p.get("created_at")) or latest
        urls.append((BASE + "/#/page/" + p["slug"], last, "0.6", "monthly"))
        urls.append((BASE + "/p/" + p["slug"] + "/", last, "0.6", "monthly"))
    for p in posts:
        key = p.get("slug") or ""
        if key:
            urls.append((BASE + "/post/" + key + "/",
                         d10(p.get("updated_at") or p.get("published_at")) or latest, "0.8", "weekly"))
    urls.append((BASE + "/privacy", "2026-11-21", "0.2", "yearly"))
    urls.append((BASE + "/terms", "2026-11-21", "0.2", "yearly"))
    body = "\n".join(
        "  <url>\n    <loc>%s</loc>\n    <lastmod>%s</lastmod>\n"
        "    <changefreq>%s</changefreq>\n    <priority>%s</priority>\n  </url>"
        % (x(loc), x(last), freq, pri) for loc, last, pri, freq in urls
    )
    return ('<?xml version="1.0" encoding="UTF-8"?>\n'
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + body + "\n</urlset>\n")


def build_rss(contents, posts, pages):
    title = contents.get("seo_title") or SITE_TITLE
    desc = contents.get("seo_description") or SITE_DESC or (SITE_NAME + " 새 소식")
    latest = latest_of(posts, pages)
    items = []
    for p in posts[:30]:
        link = BASE + "/post/" + (p.get("slug") or "") + "/"
        items.append(
            "    <item>\n      <title>%s</title>\n      <link>%s</link>\n"
            '      <guid isPermaLink="false">%s</guid>\n      <pubDate>%s</pubDate>\n'
            "      <category>%s</category>\n      <description>%s</description>\n    </item>"
            % (x(p.get("title")), x(link), x(BASE + "/#/post/" + (p.get("slug") or "")),
               rfc822(p.get("published_at") or p.get("created_at")), x(p.get("category")),
               x(p.get("summary") or p.get("title")))
        )
    return ('<?xml version="1.0" encoding="UTF-8"?>\n'
            '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">\n  <channel>\n'
            "    <title>%s</title>\n    <link>%s/</link>\n    <description>%s</description>\n"
            "    <language>ko-KR</language>\n    <lastBuildDate>%s</lastBuildDate>\n"
            '    <atom:link href="%s/rss.xml" rel="self" type="application/rss+xml"/>\n'
            % (x(title), BASE, x(desc), rfc822(latest), BASE)
            + ("\n".join(items) + "\n" if items else "") + "  </channel>\n</rss>\n")


def check():
    """생성된 두 XML 파일을 파싱해 구조를 확인합니다."""
    import xml.etree.ElementTree as ET
    out = {}
    sm = os.path.join(SITE, "sitemap.xml")
    rs = os.path.join(SITE, "rss.xml")
    for path, expect in ((sm, "urlset"), (rs, "rss")):
        if not os.path.exists(path):
            out[path] = "없음"
            continue
        tree = ET.parse(path)
        root = tree.getroot()
        tag = root.tag.split("}")[-1]
        if tag != expect:
            out[path] = "루트가 %s (기대: %s)" % (tag, expect)
            continue
        if expect == "urlset":
            locs = [e.text for e in root.iter() if e.tag.split("}")[-1] == "loc"]
            out[path] = "정상 · URL %d개 · 첫 주소 %s" % (len(locs), locs[0] if locs else "–")
        else:
            items = root.findall("./channel/item")
            out[path] = "정상 · item %d건" % len(items)
    return out


def main():
    if "--check" in sys.argv:
        for k, v in check().items():
            print("%-52s %s" % (os.path.relpath(k, SITE), v))
        return 0
    if not (KEY and URL and BASE):
        raise SystemExit("site/sbpress.config.json 에 supabase.url · supabase.anonKey · siteUrl 을 채워 주세요.")
    contents, boards, pages, posts = load()
    sitemap = build_sitemap(boards, pages, posts)
    rss = build_rss(contents, posts, pages)
    os.makedirs(SITE, exist_ok=True)
    with open(os.path.join(SITE, "sitemap.xml"), "w", encoding="utf-8") as f:
        f.write(sitemap)
    with open(os.path.join(SITE, "rss.xml"), "w", encoding="utf-8") as f:
        f.write(rss)
    print("게시판 %d · 페이지 %d · 글 %d" % (len(boards), len(pages), len(posts)))
    for k, v in check().items():
        print("%-52s %s" % (os.path.relpath(k, SITE), v))
    return 0


if __name__ == "__main__":
    sys.exit(main())
