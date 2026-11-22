#!/usr/bin/env python3
"""SBPress v3.0 · 저장소 용량 예산 검사 — GitHub Pages 1GB 대비 지금 얼마나 쓰는지 숫자로 남깁니다.

  · 배포 트리(.git 제외, 실제 서비스되는 파일) 크기와 파일 수
  · `post/` 정적 글 개수·용량·글당 평균, `assets/`·`embeds/` 크기
  · `.git` 이력 크기(깃 데이터 포함 저장소 크기) · 커밋 수
  · 1GB 한도 · 40MB 자체 예산 대비 사용률, 이 속도로 더 넣을 수 있는 글 수(예상)
  → `assets/repo-budget.json` 을 만듭니다. `/admin` 대시보드의 ‘GitHub 1GB 용량 예산’ 카드가 이 파일을 읽습니다.

  python3 scripts/check_repo_budget.py            # 계산해서 assets/repo-budget.json 갱신 + 요약 출력
  python3 scripts/check_repo_budget.py --quiet    # 갱신만(빌드에서 부를 때)
  python3 scripts/check_repo_budget.py --check    # 갱신하고, 자체 예산(기본 40MB)을 넘으면 종료코드 1
  python3 scripts/check_repo_budget.py --json     # 갱신한 JSON 을 화면에 그대로 출력
"""
import json
import os
import subprocess
import sys
from datetime import datetime, timedelta, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
# site/scripts/check_repo_budget.py → 사이트 루트는 한 단계 위(site/)입니다.
SITE = os.path.dirname(HERE) if os.path.basename(HERE) == "scripts" else HERE

VERSION = "3.0"
KST = timezone(timedelta(hours=9))

LIMIT_BYTES = 1024 ** 3            # GitHub Pages 게시 사이트 1GB (소스 저장소 권장 한도도 1GB)
BUDGET_BYTES = 40 * 1024 ** 2      # SBPress 자체 경보선 40MB (로드맵 2단계 CI 게이트 예시)
PARTS = ("post", "p", "assets", "embeds", "scripts", "admin", "privacy", "terms")


def walk(root):
    """(파일 수, 바이트 합계) — .git 은 저장소 이력이라 따로 셉니다."""
    files = 0
    total = 0
    for base, dirs, names in os.walk(root):
        dirs[:] = [d for d in dirs if d != ".git"]
        for name in names:
            path = os.path.join(base, name)
            try:
                total += os.path.getsize(path)
                files += 1
            except OSError:
                pass
    return files, total


def git(*args, **kw):
    try:
        out = subprocess.run(["git", "-C", SITE] + list(args), capture_output=True, text=True, timeout=30)
    except Exception:
        return ""
    return (out.stdout or "").strip() if out.returncode == 0 else ""


def git_stats():
    """.git 이력 크기 — count-objects 의 KiB 값을 바이트로. 깃이 없으면 0."""
    info = {"commits": 0, "looseBytes": 0, "packBytes": 0, "head": "", "date": ""}
    count = git("rev-list", "--count", "HEAD")
    if count.isdigit():
        info["commits"] = int(count)
    loose, pack = git("count-objects", "-v").splitlines(), {}
    for line in loose:
        if ":" in line:
            k, v = line.split(":", 1)
            pack[k.strip()] = v.strip()
    try:
        info["looseBytes"] = int(pack.get("size", "0")) * 1024
        info["packBytes"] = int(pack.get("size-pack", "0")) * 1024
    except ValueError:
        pass
    head = git("log", "-1", "--format=%h%n%cI")
    if head:
        rows = head.splitlines()
        info["head"] = rows[0]
        info["date"] = rows[1] if len(rows) > 1 else ""
    return info


def kst_now():
    return datetime.now(KST).strftime("%Y-%m-%dT%H:%M:%S+09:00")


def collect():
    files, tree_bytes = walk(SITE)
    parts = {}
    for name in PARTS:
        path = os.path.join(SITE, name)
        if os.path.isdir(path):
            n, b = walk(path)
            parts[name] = {"files": n, "bytes": b}

    post_dirs = []
    post_dir = os.path.join(SITE, "post")
    if os.path.isdir(post_dir):
        for d in sorted(os.listdir(post_dir)):
            f = os.path.join(post_dir, d, "index.html")
            if os.path.exists(f):
                post_dirs.append(os.path.getsize(f))
    post_count = len(post_dirs)
    post_bytes = sum(post_dirs)
    avg = int(post_bytes / post_count) if post_count else 0

    g = git_stats()
    git_bytes = g["looseBytes"] + g["packBytes"]

    # 정적 글만 늘어난다고 보고, 남은 여유로 몇 건을 더 넣을 수 있는지 계산합니다.
    room_budget = max(0, BUDGET_BYTES - tree_bytes)
    room_limit = max(0, LIMIT_BYTES - (tree_bytes + git_bytes))
    to_budget = int(room_budget / avg) if avg else 0
    to_limit = int(room_limit / avg) if avg else 0

    total = tree_bytes + git_bytes
    data = {
        "version": VERSION,
        "generatedAt": kst_now(),
        "commit": g["head"],
        "limits": {
            "repoBytes": LIMIT_BYTES, "repoLabel": "1 GB",
            "budgetBytes": BUDGET_BYTES, "budgetLabel": "40 MB",
        },
        "usage": {
            "totalBytes": total,
            "treeBytes": tree_bytes,
            "gitBytes": git_bytes,
            "files": files,
            "percent": round(total / LIMIT_BYTES * 100, 3),
            "budgetPercent": round(tree_bytes / BUDGET_BYTES * 100, 2),
        },
        "parts": parts,
        "post": {"count": post_count, "bytes": post_bytes, "avgBytes": avg},
        "capacity": {"postsToBudget": to_budget, "postsToLimit": to_limit,
                     "at1000PostsBytes": avg * 1000},
        "git": g,
        "gate": {"ok": tree_bytes <= BUDGET_BYTES, "budgetBytes": BUDGET_BYTES},
        "note": "배포 트리(.git 제외) + .git 이력. 정적 글은 배포마다 다시 구워져 이력이 늘어납니다.",
    }
    return data


def main():
    quiet = "--quiet" in sys.argv
    data = collect()
    out_dir = os.path.join(SITE, "assets")
    os.makedirs(out_dir, exist_ok=True)
    path = os.path.join(out_dir, "repo-budget.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")

    if "--json" in sys.argv:
        print(json.dumps(data, ensure_ascii=False, indent=2))
        return 0
    if not quiet:
        u, p = data["usage"], data["post"]
        print("배포 트리 %d개 파일 · %.2f MB (예산 %s 의 %.1f%%)"
              % (u["files"], u["treeBytes"] / 1048576.0, data["limits"]["budgetLabel"], u["budgetPercent"]))
        print("저장소 전체(깃 포함) %.2f MB · 1GB 의 %.2f%%"
              % (u["totalBytes"] / 1048576.0, u["percent"]))
        print("정적 글 %d건 · %d KB · 글당 평균 %.1f KB"
              % (p["count"], p["bytes"] // 1024, p["avgBytes"] / 1024.0))
        print("더 넣을 수 있는 글(예산 기준) 약 %s건 · 1GB 기준 약 %s건"
              % (format(data["capacity"]["postsToBudget"], ","), format(data["capacity"]["postsToLimit"], ",")))
        print("→ %s" % os.path.relpath(path, SITE))
        if not data["gate"]["ok"]:
            print("!! 자체 예산 %s 를 넘었습니다 — 정적 글 정리·이미지 릴리스 이동을 검토하세요."
                  % data["limits"]["budgetLabel"])
    return 1 if ("--check" in sys.argv and not data["gate"]["ok"]) else 0


if __name__ == "__main__":
    sys.exit(main())
