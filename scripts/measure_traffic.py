#!/usr/bin/env python3
"""SBPress v7.0 · 첫 화면 전송량 실측 — GitHub Pages 월 100GB 한도 방어.

공개 첫 화면(`/`)이 실제로 내려받는 바이트를 재고, 300KB 예산과 월 100GB 대비 %로 남깁니다.

  · 정적 계산(기본): index.html 이 첫 로드에서 부르는 CSS·JS·이미지·아이콘·폰트를
    gzip -9 로 압축한 크기(= GitHub Pages 가 보내는 전송량)로 합산합니다.
  · before: 8단계 이전(v5.1) 태그의 index.html 을 같은 규칙으로 계산해 비교합니다.
  · --live: 로컬 서버(gzip)에 헤드리스 브라우저로 접속해 PerformanceResourceTiming 의
    transferSize 를 합산합니다(Service Worker 는 끄고 콜드 방문 기준).
  → assets/traffic-budget.json 을 만들고, /admin 대시보드 ‘전송량 예산’ 카드가 이 파일을 읽습니다.

  python3 scripts/measure_traffic.py             # 정적 계산 → traffic-budget.json + 요약
  python3 scripts/measure_traffic.py --live      # 브라우저 실측까지(같은 JSON 에 live 값 기록)
  python3 scripts/measure_traffic.py --quiet     # 갱신만(빌드에서 부를 때)
  python3 scripts/measure_traffic.py --check     # 300KB 예산을 넘으면 종료코드 1
"""
import gzip
import json
import os
import re
import subprocess
import sys
from datetime import datetime, timedelta, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.dirname(HERE) if os.path.basename(HERE) == "scripts" else HERE

VERSION = "9.0"
KST = timezone(timedelta(hours=9))
BUDGET_BYTES = 300 * 1024                # 로드맵 8단계 — 첫 화면 300KB 이하
MONTHLY_CAP_BYTES = 100 * 1024 ** 3      # GitHub Pages 월 100GB soft 한도
PV_PER_MONTH = 30000                     # 로드맵 가정(월 3만 PV)
EXTRA_PAGE_VIEWS = 2.5                   # 방문 1회당 첫 화면 외 추가 페이지 2.5회
EXTRA_PAGE_BYTES = 30 * 1024             # 추가 페이지 1회 평균(정적 글 HTML + 공통 CSS)

TEXT_EXT = (".html", ".css", ".js", ".json", ".webmanifest", ".xml", ".txt", ".svg", ".md")


def kst_now():
    return datetime.now(KST).strftime("%Y-%m-%dT%H:%M:%S+09:00")


def gz_len(data):
    return len(gzip.compress(data, 9))


def file_bytes(path):
    """(원본 바이트, 전송 바이트) — 텍스트는 gzip, 이미지·폰트는 그대로."""
    with open(path, "rb") as f:
        data = f.read()
    if path.lower().endswith(TEXT_EXT):
        return len(data), gz_len(data)
    return len(data), len(data)


def local_path(rel):
    rel = rel.split("?")[0].split("#")[0]
    if rel.startswith("http://") or rel.startswith("https://"):
        return None
    rel = rel.lstrip("/")
    return os.path.join(SITE, rel)


def parse_font_faces(css_path):
    """styles.css 의 @font-face — self-host 폰트 파일 목록(첫 화면에 쓰는 것만)."""
    out = []
    if not os.path.exists(css_path):
        return out
    text = open(css_path, encoding="utf-8").read()
    for block in re.findall(r"@font-face\s*\{[^}]*\}", text):
        m = re.search(r"url\(['\"]?([^'\")]+)['\"]?\)", block)
        if not m:
            continue
        url = m.group(1)
        if url.startswith("data:"):
            continue
        out.append(url)
    return out


def scan_index(html_path):
    """index.html 첫 로드 목록 — CSS·스크립트·preload 이미지·매니페스트·아이콘·폰트."""
    html = open(html_path, encoding="utf-8").read()
    items = []          # (종류, 경로)
    items.append(("html", os.path.basename(html_path)))
    for href in re.findall(r'<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"', html):
        items.append(("css", href))
    for href in re.findall(r'<link[^>]+rel="preload"[^>]+href="([^"]+)"', html):
        items.append(("preload", href))
    for href in re.findall(r'<link[^>]+rel="manifest"[^>]+href="([^"]+)"', html):
        items.append(("manifest", href))
    for src in re.findall(r'<script[^>]+src="([^"]+)"', html):
        items.append(("js", src))
    for href in re.findall(r'<link[^>]+rel="(?:apple-touch-)?icon"[^>]+href="([^"]+)"', html):
        if not href.startswith("data:"):
            items.append(("icon", href))
    return items, html


def manifest_icons(html):
    out = []
    for href in re.findall(r'<link[^>]+rel="manifest"[^>]+href="([^"]+)"', html):
        p = local_path(href)
        if not p or not os.path.exists(p):
            continue
        try:
            mf = json.load(open(p, encoding="utf-8"))
        except ValueError:
            continue
        for ic in mf.get("icons") or []:
            src = ic.get("src")
            if src and not src.startswith("data:"):
                out.append(src)
    return out


def measure_tree(root_html):
    """index.html 한 벌의 첫 로드 전송량. root_html 은 사이트 기준 상대경로(index.html).

    아이콘은 설치·홈 화면 추가 때만 받으므로 첫 화면 전송량에서는 빼고 따로 적습니다."""
    path = os.path.join(SITE, root_html)
    if not os.path.exists(path):
        return None
    items, html = scan_index(path)
    install = []
    for src in manifest_icons(html):
        p = local_path(src)
        if p and os.path.exists(p):
            raw, sent = file_bytes(p)
            install.append({"kind": "icon", "path": src, "rawBytes": raw, "bytes": sent,
                            "note": "설치·홈 화면 추가 시 1회"})
    rows, total = [], 0
    seen = set()
    for kind, rel in items:
        key = rel.split("?")[0].lstrip("/")
        if key in seen or kind == "icon":
            continue
        seen.add(key)
        p = local_path(rel)
        if not p or not os.path.exists(p):
            rows.append({"kind": kind, "path": rel, "rawBytes": 0, "bytes": 0, "counted": False,
                         "note": "외부·없음"})
            continue
        raw, sent = file_bytes(p)
        rows.append({"kind": kind, "path": rel, "rawBytes": raw, "bytes": sent, "counted": True})
        total += sent
        # CSS 가 부르는 self-host 폰트도 첫 화면 전송량입니다.
        if kind == "css":
            for f in parse_font_faces(p):
                fp = local_path(f)
                if not fp or not os.path.exists(fp) or f.split("?")[0].lstrip("/") in seen:
                    continue
                seen.add(f.split("?")[0].lstrip("/"))
                fraw, fsent = file_bytes(fp)
                rows.append({"kind": "font", "path": f, "rawBytes": fraw, "bytes": fsent, "counted": True})
                total += fsent
    return {"index": root_html, "totalBytes": total, "resources": rows, "install": install}


def git_before():
    """v5.1 태그의 index.html 을 같은 규칙으로 재어 before 로 남깁니다(태그가 없으면 None)."""
    def show(rel):
        try:
            out = subprocess.run(["git", "-C", SITE, "show", "v5.1:" + rel], capture_output=True, timeout=60)
        except Exception:
            return None
        return out.stdout if out.returncode == 0 else None

    html = show("index.html")
    if not html:
        return None
    text = html.decode("utf-8", "replace")
    items = [("html", "index.html")]
    for href in re.findall(r'<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"', text):
        items.append(("css", href))
    for href in re.findall(r'<link[^>]+rel="preload"[^>]+href="([^"]+)"', text):
        items.append(("preload", href))
    for src in re.findall(r'<script[^>]+src="([^"]+)"', text):
        items.append(("js", src))
    rows, total = [], 0
    for kind, rel in items:
        if rel.startswith("http"):
            rows.append({"kind": kind, "path": rel, "rawBytes": 0, "bytes": 0, "counted": False,
                         "note": "외부(구글 폰트)"})
            continue
        data = show(rel.lstrip("/"))
        if data is None:
            continue
        sent = len(data) if not rel.lower().endswith(TEXT_EXT) else gz_len(data)
        rows.append({"kind": kind, "path": rel, "rawBytes": len(data), "bytes": sent, "counted": True})
        total += sent
    items_html = gz_len(html)
    total += items_html
    rows.insert(0, {"kind": "html", "path": "index.html", "rawBytes": len(html), "bytes": items_html,
                    "counted": True})
    return {"version": "5.1", "totalBytes": total, "resources": rows}


def live_measure():
    """로컬 서버(gzip) + 헤드리스 브라우저 — 실제 transferSize 합계."""
    import asyncio
    import functools
    import http.server
    import socketserver
    import threading

    port = int(os.environ.get("TRAFFIC_PORT", "8788"))

    class Handler(http.server.SimpleHTTPRequestHandler):
        def __init__(self, *a, **k):
            super().__init__(*a, directory=SITE, **k)

        def do_GET(self):
            path = self.path.split("?")[0]
            clean = {"/admin": "/admin.html", "/privacy": "/privacy.html", "/terms": "/terms.html"}
            if path in clean:
                self.path = clean[path]
            fpath = self.translate_path(self.path)
            if not os.path.isfile(fpath):
                return super().do_GET()
            ctype = self.guess_type(fpath)
            want_gz = "gzip" in (self.headers.get("Accept-Encoding") or "")
            body = open(fpath, "rb").read()
            gz = gz_len(body) < len(body)
            if want_gz and gz and (fpath.lower().endswith(TEXT_EXT) or "javascript" in ctype):
                body = gzip.compress(body, 9)
                self.send_response(200)
                self.send_header("Content-Type", ctype)
                self.send_header("Content-Encoding", "gzip")
            else:
                self.send_response(200)
                self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            try:
                self.wfile.write(body)
            except BrokenPipeError:
                pass

        def log_message(self, *a):
            return

    socketserver.TCPServer.allow_reuse_address = True
    srv = socketserver.ThreadingTCPServer(("127.0.0.1", port), Handler)
    srv.daemon_threads = True
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    base = "http://127.0.0.1:%d" % port

    async def run():
        from playwright.async_api import async_playwright
        async with async_playwright() as p:
            b = await p.chromium.launch()
            # 콜드 방문 기준 — Service Worker 캐시는 끕니다.
            ctx = await b.new_context(viewport={"width": 1440, "height": 950}, locale="ko-KR",
                                      service_workers="block")
            pg = await ctx.new_page()
            try:
                await pg.goto(base + "/", wait_until="load", timeout=60000)
                await pg.wait_for_timeout(1500)
                data = await pg.evaluate("""() => {
                  const out = {total: 0, rows: [], loadEnd: 0};
                  const nav = performance.getEntriesByType('navigation')[0];
                  out.loadEnd = nav ? Math.round(nav.loadEventEnd) : 0;
                  performance.getEntriesByType('resource').forEach(r => {
                    if (out.loadEnd && r.startTime > out.loadEnd) return;
                    const t = r.transferSize || r.encodedBodySize || 0;
                    out.rows.push({name: r.name, type: r.initiatorType, bytes: t,
                                   encoded: r.encodedBodySize, decoded: r.decodedBodySize,
                                   start: Math.round(r.startTime)});
                    out.total += t;
                  });
                  return out;
                }""")
            finally:
                await b.close()
            return data

    try:
        return asyncio.run(run())
    finally:
        try:
            srv.shutdown()
            srv.server_close()
        except Exception:
            pass


def summarize(rows, limit=8):
    top = sorted([r for r in rows if r.get("counted")], key=lambda r: -r["bytes"])[:limit]
    return ", ".join("%s %.1fKB" % (r_short(r["path"]), r["bytes"] / 1024.0) for r in top)


def r_short(p):
    return os.path.basename(p.split("?")[0]) or p


def collect(with_live=False):
    after = measure_tree("index.html")
    before = git_before()
    total = after["totalBytes"] if after else 0
    before_total = before["totalBytes"] if before else 0
    reduction = (round((1 - total / before_total) * 100, 1)
                 if before_total and total else None)
    pv_bytes = total * PV_PER_MONTH + EXTRA_PAGE_BYTES * EXTRA_PAGE_VIEWS * PV_PER_MONTH
    data = {
        "version": VERSION,
        "generatedAt": kst_now(),
        "limits": {
            "budgetBytes": BUDGET_BYTES, "budgetLabel": "300 KB",
            "monthlyCapBytes": MONTHLY_CAP_BYTES, "monthlyCapLabel": "100 GB",
            "pvPerMonth": PV_PER_MONTH,
        },
        "after": after,
        "before": before,
        "reductionPercent": reduction,
        "monthly": {
            "pvPerMonth": PV_PER_MONTH,
            "assumedFirstLoads": 1.0,
            "extraPageViews": EXTRA_PAGE_VIEWS,
            "extraPageBytes": EXTRA_PAGE_BYTES,
            "bytesPerMonth": pv_bytes,
            "gbPerMonth": round(pv_bytes / 1024 ** 3, 2),
            "percentOfCap": round(pv_bytes / MONTHLY_CAP_BYTES * 100, 2),
            "roomGbPerMonth": round(MONTHLY_CAP_BYTES / max(1, pv_bytes) * (pv_bytes / 1024 ** 3), 2),
        },
        "gate": {"ok": total <= BUDGET_BYTES, "budgetBytes": BUDGET_BYTES,
                 "usedPercent": round(total / BUDGET_BYTES * 100, 1) if total else 0},
        "note": "텍스트는 gzip -9(= GitHub Pages 전송량), 이미지·폰트는 원본 크기. 첫 방문 1회 기준.",
    }
    if with_live:
        try:
            live = live_measure()
            data["live"] = {"totalBytes": live["total"], "resources": live["rows"],
                            "measuredAt": kst_now()}
        except Exception as e:                      # 브라우저가 없는 환경에서도 정적 값은 남깁니다
            data["live"] = {"error": str(e)[:200]}
    return data


def main():
    with_live = "--live" in sys.argv
    data = collect(with_live)
    path = os.path.join(SITE, "assets", "traffic-budget.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")
    if "--json" in sys.argv:
        print(json.dumps(data, ensure_ascii=False, indent=2))
        return 0
    if "--quiet" not in sys.argv:
        a = data["after"] or {"totalBytes": 0, "resources": []}
        b = data["before"] or {"totalBytes": 0}
        print("첫 화면 전송량 %d KB (예산 %s 의 %.1f%%)"
              % (a["totalBytes"] // 1024, data["limits"]["budgetLabel"], data["gate"]["usedPercent"]))
        if b.get("totalBytes"):
            print("before(v5.1) %d KB → after %d KB · %.1f%% 감소"
                  % (b["totalBytes"] // 1024, a["totalBytes"] // 1024, data["reductionPercent"] or 0))
        print("큰 항목:", summarize(a["resources"]))
        m = data["monthly"]
        print("월 %s PV 가정 → 월 %.2f GB · 100GB 의 %.2f%%"
              % (format(PV_PER_MONTH, ","), m["gbPerMonth"], m["percentOfCap"]))
        if data.get("live"):
            if "error" in data["live"]:
                print("실측(브라우저): 건너뜀 —", data["live"]["error"])
            else:
                print("실측(브라우저 transferSize): %d KB" % (data["live"]["totalBytes"] // 1024))
        print("→ %s" % os.path.relpath(path, SITE))
        if not data["gate"]["ok"]:
            print("!! 첫 화면 전송량이 300KB 예산을 넘었습니다 — 스크립트·이미지·폰트를 더 줄이세요.")
    return 1 if ("--check" in sys.argv and not data["gate"]["ok"]) else 0


if __name__ == "__main__":
    sys.exit(main())
