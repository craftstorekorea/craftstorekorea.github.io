#!/usr/bin/env python3
"""SBPress v8.0 — 새 사이트 한 벌 만들기 (clone_site.py)

`/admin → 통합 허브 → 복제 마법사` 가 내려 주는 설정 JSON 하나로 **비어 있는 폴더에**
새 사이트 패키지를 한 번에 만듭니다.

  1. sbpress-template/site/ 를 출력 폴더로 복사 (init_sbpress.py 재사용)
  2. site/sbpress.config.json 쓰기 — 이름·주소·Supabase·GA4·포인트 색·게시판 구성
  3. 선택한 게시판 구성을 supabase/boards.seed.sql 로 만들기
  4. 도메인을 주면 site/CNAME 파일 만들기 (GitHub Pages 커스텀 도메인)
  5. clone-checklist.md — DNS · GA4 · OAuth Redirect · 관리자 등록 · 첫 글 발행
  6. 검증 — 남은 자리표시자 0 · CNAME/주소 일치 · 브랜드 0 · 필수 파일

사용 예)
  # 마법사가 내려 준 JSON 으로
  python3 clone_site.py --config ./my-site.json --out ../my-site

  # 값을 직접 적어서
  python3 clone_site.py --name "우리 동네 기록" --domain ourtown.example.org \\
      --repo myid/ourtown --board "소개:8,뉴스:10" --accent "#0f766e" --out ../ourtown

  # 실행 전에 무엇이 만들어질지 JSON 으로 보기
  python3 clone_site.py --name "..." --domain ... --out ../x --print-config

출력 폴더는 비어 있어야 합니다(실수로 기존 사이트를 덮어쓰지 않도록).
"""
import argparse
import json
import os
import re
import shutil
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
# 브랜드 검사 낱말은 조각을 이어 붙여 만듭니다 — 템플릿으로 복사할 때 브랜드 치환기가
# 이 목록 자체를 바꾸지 않게 하려는 것입니다(검사는 그대로 동작합니다).
BRAND_WORDS = ["전국" + "공방", "우리" + "동네공방", "craft" + "storekorea",
               "haaikrynfrrwc" + "pyuvrrr", "craft" + "store.kr" + "@gmail.com", "newscur" + "ation"]
READY_FILES = ["site/index.html", "site/admin.html", "site/sbpress.config.json",
               "site/assets/app.js", "site/assets/admin.js", "site/sw.js",
               "supabase/init_all.sql"]
DEFAULT_BOARDS = ["소개:8", "뉴스:10", "인터뷰:5", "정보:10"]


# ---------------------------------------------------------------- helpers
def find_template(explicit=None):
    """init_sbpress.py 가 있는 템플릿 폴더를 찾습니다(템플릿 안에서 실행해도 됩니다)."""
    cands = []
    if explicit:
        cands.append(explicit)
    cands += [HERE, os.path.join(HERE, "sbpress-template"),
              os.path.join(os.path.dirname(HERE), "sbpress-template")]
    for c in cands:
        if c and os.path.isfile(os.path.join(c, "init_sbpress.py")):
            return os.path.abspath(c)
    return None


def norm_domain(text):
    """'https://www.Example.org/path' → 'example.org' (비우면 '')."""
    d = str(text or "").strip().lower()
    if not d:
        return ""
    d = re.sub(r"^https?://", "", d)
    d = d.split("/")[0].split("?")[0]
    d = re.sub(r"^www\.", "", d)
    return d.rstrip(".")


def parse_boards(text):
    """'소개:8,뉴스:10,인터뷰:5' → [{'slug','name','per_page'}]"""
    out = []
    items = text if isinstance(text, list) else str(text or "").split(",")
    for i, item in enumerate(items):
        raw = str(item).strip()
        if not raw:
            continue
        name, _, per = raw.partition(":")
        name = name.strip()
        try:
            per_page = max(1, min(100, int((per or "10").strip())))
        except ValueError:
            per_page = 10
        slug = {"소개": "intro", "뉴스": "news", "인터뷰": "interview", "정보": "info"}.get(name)
        slug = slug or re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-") or ("board-%d" % (i + 1))
        out.append({"slug": slug, "name": name, "per_page": per_page, "sort_order": i + 1})
    return out


def site_url_for(domain):
    d = norm_domain(domain)
    return ("https://" + d) if d else ""


def repo_guess(domain, repo):
    if repo and "/" in repo:
        return repo.strip()
    d = norm_domain(domain)
    if not d:
        return ""
    return "%s/%s" % (d.split(".")[0], d)


def board_sql(boards):
    rows = []
    for b in boards:
        rows.append("  (%s, %s, '', %d, true, %d, 'all')" % (
            sql_lit(b["slug"]), sql_lit(b["name"]), b["per_page"], b["sort_order"]))
    if not rows:
        return "-- 게시판 구성이 비어 있습니다.\n"
    return ("-- SBPress v8.0 — 새 사이트 게시판 구성 (clone_site.py)\n"
            "-- supabase/init_all.sql 실행 뒤에 한 번 돌리면 게시판이 생깁니다(여러 번 실행해도 안전).\n"
            "insert into public.boards (slug, name, description, per_page, is_active, sort_order, comment_policy)\n"
            "values\n" + ",\n".join(rows) + "\n"
            "on conflict (slug) do update\n"
            "   set name = excluded.name, per_page = excluded.per_page, sort_order = excluded.sort_order;\n")


def sql_lit(text):
    return "'" + str(text).replace("'", "''") + "'"


def checklist(cfg, domain, repo):
    d = norm_domain(domain)
    base = cfg.get("siteUrl") or ("https://" + d if d else "사이트 주소")
    sup = (cfg.get("supabase") or {})
    sup_host = re.sub(r"^https?://", "", sup.get("url") or "").rstrip("/") or "YOUR-PROJECT.supabase.co"
    pages = []
    if d:
        pages += [
            "## 1. DNS (Cloudflare)",
            "- `@` A 레코드 4개: 185.199.108.153 · 185.199.109.153 · 185.199.110.153 · 185.199.111.153",
            "- `www` CNAME → `%s`" % (repo.split("/")[0] + ".github.io" if "/" in repo else "YOUR-ID.github.io"),
            "- 프록시(주황 구름)는 DNS 전파 확인 뒤 켜세요. 처음엔 DNS only 로 두면 빨리 붙습니다.",
            "",
        ]
    pages += [
        "## 2. GitHub Pages",
        "- 저장소 Settings → Pages → Custom domain 에 `%s` 입력 → Save" % (d or "도메인"),
        "- DNS 확인 뒤 **Enforce HTTPS** 를 켭니다(인증서 발급까지 수 분).",
        "",
        "## 3. GA4",
        "- `%s` 의 측정 ID를 만들고 `site/sbpress.config.json` 의 `ga4Id` 에 넣습니다." % base,
        "",
        "## 4. Supabase",
        "- SQL Editor 에서 `supabase/init_all.sql` 실행 (여러 번 실행해도 안전).",
        "- Authentication → URL Configuration",
        "  · Site URL: `%s`" % base,
        "  · Redirect URLs: `%s/admin` · `%s/privacy` · `%s/terms`" % (base, base, base),
        "- 관리자 계정을 `admin_users` 표에 넣습니다:",
        "  `insert into public.admin_users (email, note) values ('%s', 'owner') on conflict (email) do nothing;`"
        % (cfg.get("ownerEmail") or "owner@example.com"),
        "  (%s 프로젝트)" % sup_host,
        "",
        "## 5. Google Cloud OAuth",
        "- OAuth 클라이언트의 **승인된 자바스크립트 원본**: `%s`" % base,
        "- **승인된 리디렉션 URI**: `https://%s/auth/v1/callback`" % sup_host,
        "",
        "## 6. 첫 배포 · 첫 글",
        "- `gh repo create %s --public --source=. --remote=origin --push`" % (repo or "OWNER/REPO"),
        "- 저장소 Settings → Pages → Source: `Deploy from a branch` · `main` / `(root)`",
        "- `/admin` 로그인 → 게시판 관리에서 첫 글을 발행하고, 메뉴·로고를 확인합니다.",
        "- `site/sitemap.xml` · `/rss.xml` 이 열리는지 확인합니다.",
        "",
    ]
    return "# 새 사이트 체크리스트 — %s\n\n%s\n" % (cfg.get("siteName") or "새 사이트", "\n".join(pages))


def gh_command(cfg, domain, repo):
    d = norm_domain(domain)
    rep = repo or "OWNER/%s" % (d.replace(".", "-") if d else "my-site")
    return ("gh repo create %s --public --source=. --remote=origin --push" % rep)


# ---------------------------------------------------------------- build
def load_wizard_config(path):
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    if not isinstance(data, dict):
        raise SystemExit("설정 파일이 JSON 객체가 아닙니다: %s" % path)
    return data


def build_config(args):
    """마법사 JSON + 명령줄 값을 합쳐 sbpress.config.json 내용을 만듭니다."""
    cfg = {}
    if args.config:
        cfg.update(load_wizard_config(args.config))
    name = args.name or cfg.get("siteName") or "새 사이트"
    domain = norm_domain(args.domain or cfg.get("domain") or cfg.get("siteUrl") or "")
    if args.domain:
        cfg["domain"] = norm_domain(args.domain)
    cfg["siteName"] = name
    cfg.setdefault("siteTitle", "%s — 새 소식과 기록" % name)
    cfg.setdefault("tagline", name)
    cfg.setdefault("description", "%s 의 소식을 모아 소개합니다." % name)
    cfg["siteUrl"] = site_url_for(domain) or str(cfg.get("siteUrl") or "")
    cfg.setdefault("supabase", {"url": "", "anonKey": ""})
    if args.supabase_url is not None:
        cfg["supabase"]["url"] = args.supabase_url.strip()
    if args.supabase_key is not None:
        cfg["supabase"]["anonKey"] = args.supabase_key.strip()
    cfg.setdefault("ga4Id", "")
    if args.ga4:
        cfg["ga4Id"] = args.ga4.strip()
    cfg.setdefault("providers", ["email"])
    cfg.setdefault("defaultTheme", args.theme or "magazine")
    cfg.setdefault("defaultLang", args.lang or "ko")
    cfg.setdefault("ownerEmail", args.owner_email or "")
    boards = cfg.get("boards")
    if args.board:
        boards = parse_boards(args.board)
    elif isinstance(boards, str):
        boards = parse_boards(boards)
    elif boards and isinstance(boards[0], dict):
        boards = [{"slug": b.get("slug") or parse_boards([b.get("name", "")])[0]["slug"],
                   "name": b.get("name") or "게시판",
                   "per_page": int(b.get("per_page") or 10),
                   "sort_order": int(b.get("sort_order") or i + 1)} for i, b in enumerate(boards)]
    else:
        boards = parse_boards(DEFAULT_BOARDS)
    cfg["boards"] = boards
    accent = args.accent or cfg.get("accent") or ""
    if accent:
        cfg["accent"] = accent
    repo = args.repo or cfg.get("githubRepo") or repo_guess(domain, "")
    cfg["githubRepo"] = repo
    cfg["domain"] = domain
    return cfg, domain, repo


def ensure_empty(target):
    if os.path.exists(target):
        if not os.path.isdir(target):
            raise SystemExit("출력 경로가 폴더가 아닙니다: %s" % target)
        if os.listdir(target):
            raise SystemExit("출력 폴더가 비어 있지 않습니다: %s (기존 사이트를 덮어쓰지 않습니다)" % target)
    else:
        os.makedirs(target, exist_ok=True)


def verify(target, cfg, domain):
    """패키지가 실제로 쓸 수 있는 상태인지 확인합니다 — (통과, [(이름, 결과, 설명)])."""
    checks = []
    for rel in READY_FILES:
        checks.append((rel, os.path.exists(os.path.join(target, rel)), ""))
    conf_path = os.path.join(target, "site", "sbpress.config.json")
    conf = {}
    try:
        conf = json.load(open(conf_path, encoding="utf-8"))
        checks.append(("config.json 파싱", True, conf.get("siteName") or ""))
    except Exception as e:  # noqa: BLE001
        checks.append(("config.json 파싱", False, str(e)[:120]))
    checks.append(("siteUrl", bool(conf.get("siteUrl")), conf.get("siteUrl") or ""))
    if domain:
        cname_path = os.path.join(target, "site", "CNAME")
        cname = open(cname_path, encoding="utf-8").read().strip() if os.path.exists(cname_path) else ""
        checks.append(("CNAME 파일", cname == domain, cname or "없음"))
    # 남은 자리표시자·브랜드
    leftover, brand = [], []
    for base, _dirs, files in os.walk(os.path.join(target, "site")):
        for fn in files:
            if not fn.lower().endswith((".html", ".json", ".js", ".css", ".txt", ".xml", ".webmanifest")):
                continue
            p = os.path.join(base, fn)
            try:
                text = open(p, encoding="utf-8").read()
            except (OSError, UnicodeDecodeError):
                continue
            if "__SBP_" in text:
                leftover.append(os.path.relpath(p, target))
            for w in BRAND_WORDS:
                if w in text:
                    brand.append("%s ← %s" % (os.path.relpath(p, target), w))
    checks.append(("자리표시자 0건", not leftover, ", ".join(leftover[:4])))
    checks.append(("브랜드 잔존 0건", not brand, ", ".join(brand[:3])))
    boards_path = os.path.join(target, "supabase", "boards.seed.sql")
    seed = open(boards_path, encoding="utf-8").read() if os.path.exists(boards_path) else ""
    checks.append(("게시판 seed", seed.count("insert into public.boards") == 1 and seed.count("(") >= 3,
                   "%d개" % (cfg.get("boards") or []).__len__()))
    checks.append(("체크리스트", os.path.exists(os.path.join(target, "clone-checklist.md")), ""))
    return all(c[1] for c in checks), checks


def run(args):
    started = time.time()
    template = find_template(args.template)
    if not template:
        raise SystemExit("sbpress-template(init_sbpress.py 가 있는 폴더)를 찾지 못했습니다. --template 로 지정해 주세요.")
    target = os.path.abspath(os.path.expanduser(args.out))
    cfg, domain, repo = build_config(args)

    if args.print_config:
        print(json.dumps(cfg, ensure_ascii=False, indent=2))
        return 0

    ensure_empty(target)

    # 1) init_sbpress.py 로 site/ 복사 + 설정 + CSP + SQL
    conf_dir = os.path.join(target, ".clone")
    os.makedirs(conf_dir, exist_ok=True)
    conf_path = os.path.join(conf_dir, "site-config.json")
    # init_sbpress 는 자기 기본값 위에 파일 값을 덮습니다. 마법사 키(domain·boards·accent)도 함께 남깁니다.
    with open(conf_path, "w", encoding="utf-8") as f:
        json.dump(cfg, f, ensure_ascii=False, indent=2)

    sys.path.insert(0, template)
    import init_sbpress  # noqa: E402  (템플릿의 검증된 생성기를 그대로 씁니다)
    ns = argparse.Namespace(
        target=target, config=conf_path,
        site_name=cfg.get("siteName"), site_url=cfg.get("siteUrl"),
        tagline=cfg.get("tagline"), description=cfg.get("description"),
        supabase_url=cfg["supabase"].get("url") if isinstance(cfg.get("supabase"), dict) else None,
        supabase_key=cfg["supabase"].get("anonKey") if isinstance(cfg.get("supabase"), dict) else None,
        ga4_id=None, owner_email=cfg.get("ownerEmail") or None,
        theme=None, lang=None, providers=None, features=None, force=bool(args.force),
    )
    init_sbpress.build(ns)

    # 2) 게시판 구성·CNAME·체크리스트
    with open(os.path.join(target, "supabase", "boards.seed.sql"), "w", encoding="utf-8") as f:
        f.write(board_sql(cfg.get("boards") or []))
    if domain:
        with open(os.path.join(target, "site", "CNAME"), "w", encoding="utf-8") as f:
            f.write(domain + "\n")
    with open(os.path.join(target, "clone-checklist.md"), "w", encoding="utf-8") as f:
        f.write(checklist(cfg, domain, repo))
    with open(os.path.join(target, "clone.json"), "w", encoding="utf-8") as f:
        json.dump({"siteKey": cfg.get("siteKey") or (domain.replace(".", "-") or "new-site"),
                   "name": cfg.get("siteName"), "siteUrl": cfg.get("siteUrl"),
                   "githubRepo": repo, "boards": cfg.get("boards"),
                   "accent": cfg.get("accent", ""), "command": gh_command(cfg, domain, repo)},
                  f, ensure_ascii=False, indent=2)
        f.write("\n")
    try:
        shutil.rmtree(conf_dir)
    except OSError:
        pass

    # 3) 검증
    passed, checks = verify(target, cfg, domain)
    print("")
    print("새 사이트 패키지: %s" % target)
    print("  템플릿: %s" % template)
    for name, good, detail in checks:
        print("  %s %s%s" % ("PASS" if good else "FAIL", name, ("  · " + detail) if detail else ""))
    print("  게시판: %s" % ", ".join("%s(%d)" % (b["name"], b["per_page"]) for b in (cfg.get("boards") or [])))
    print("  도메인: %s" % (domain or "(없음 — 나중에 CNAME 으로 추가)"))
    print("  다음 명령: %s" % gh_command(cfg, domain, repo))
    print("  걸린 시간: %.1f초" % (time.time() - started))
    if not passed:
        print("!! 검증에 실패했습니다 — 위 FAIL 항목을 확인하세요.")
        return 1
    print("완료 — 바뀐 폴더는 깃 저장소가 아닙니다. 위 명령으로 저장소를 만들고 첫 푸시를 하세요.")
    return 0


def main(argv=None):
    ap = argparse.ArgumentParser(description="SBPress v8.0 — 새 사이트 패키지 만들기(설정·템플릿·CNAME)")
    ap.add_argument("--config", help="복제 마법사가 내려 준 설정 JSON")
    ap.add_argument("--out", required=False, help="새 사이트를 만들 빈 폴더")
    ap.add_argument("--template", help="sbpress-template 폴더(기본: 이 스크립트 옆/위)")
    ap.add_argument("--name", help="사이트 이름")
    ap.add_argument("--domain", help="도메인 (예: ourtown.example.org) — CNAME 파일을 만듭니다")
    ap.add_argument("--repo", help="GitHub 저장소 (예: myid/ourtown)")
    ap.add_argument("--board", help="게시판 구성 (예: '소개:8,뉴스:10,인터뷰:5')")
    ap.add_argument("--accent", help="포인트 색 (예: #0f766e)")
    ap.add_argument("--supabase-url")
    ap.add_argument("--supabase-key")
    ap.add_argument("--ga4")
    ap.add_argument("--owner-email")
    ap.add_argument("--theme", choices=["magazine", "craft", "org"])
    ap.add_argument("--lang", choices=["ko", "en"])
    ap.add_argument("--force", action="store_true", help="출력 폴더의 site/ 를 템플릿에서 다시 복사")
    ap.add_argument("--print-config", action="store_true", help="만들 설정 JSON 만 출력하고 끝냅니다")
    args = ap.parse_args(argv)
    if not args.print_config and not args.out:
        ap.error("--out 폴더가 필요합니다")
    return run(args)


if __name__ == "__main__":
    sys.exit(main())
