#!/usr/bin/env python3
"""Rebuild a website's files from a Chrome/Edge HAR export (with content).

Usage:
    python har_extract.py game.har OUT_DIR [--host HOST] [--flat]

    --host HOST   only extract files from this host (repeatable), e.g.
                  --host htmlunblockedgames.github.io
    --flat        don't create a top-level folder per host (use with one --host)
    --list        just list the hosts found in the HAR and exit

Then serve the folder locally:
    cd OUT_DIR
    python -m http.server 8000
"""
import argparse
import base64
import hashlib
import json
import pathlib
import re
from urllib.parse import unquote, urlparse

BAD_CHARS = re.compile(r'[<>:"|?*\x00-\x1f]')
MAX_SEGMENT = 80  # keep path segments short so Windows' 260-char limit isn't hit


def safe_segment(seg: str) -> str:
    seg = BAD_CHARS.sub("_", seg).rstrip(" .") or "_"
    if len(seg) > MAX_SEGMENT:
        stem, dot, ext = seg.rpartition(".")
        ext = ext if dot and len(ext) <= 8 else ""
        digest = hashlib.sha1(seg.encode()).hexdigest()[:12]
        seg = f"{seg[:40]}_{digest}" + (f".{ext}" if ext else "")
    return seg


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("har")
    ap.add_argument("out", nargs="?", default="site_offline")
    ap.add_argument("--host", action="append", default=[])
    ap.add_argument("--flat", action="store_true")
    ap.add_argument("--list", action="store_true")
    args = ap.parse_args()

    with open(args.har, encoding="utf-8") as f:
        entries = json.load(f)["log"]["entries"]

    if args.list:
        counts = {}
        for e in entries:
            h = urlparse(e["request"]["url"]).netloc
            counts[h] = counts.get(h, 0) + 1
        for h, n in sorted(counts.items(), key=lambda x: -x[1]):
            print(f"{n:4d}  {h}")
        return

    out_dir = pathlib.Path(args.out)
    hosts = set(args.host)
    saved = skipped = 0
    seen = set()

    for entry in entries:
        url = entry["request"]["url"]
        resp = entry["response"]
        content = resp.get("content", {})
        u = urlparse(url)

        if hosts and u.netloc not in hosts:
            continue
        if u.scheme not in ("http", "https") or resp.get("status") != 200 or not content.get("text"):
            skipped += 1
            continue

        path = unquote(u.path)
        if path == "" or path.endswith("/"):
            path += "index.html"

        parts = [safe_segment(p) for p in path.split("/") if p and p not in (".", "..")]
        base = out_dir if args.flat else out_dir / safe_segment(u.netloc)
        dest = base.joinpath(*parts)

        if dest in seen:  # same path fetched twice (e.g. different query strings)
            continue
        seen.add(dest)

        if content.get("encoding") == "base64":
            data = base64.b64decode(content["text"])
        else:
            data = content["text"].encode("utf-8")

        try:
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(data)
        except OSError as err:
            print(f"FAILED {dest}: {err}")
            skipped += 1
            continue
        saved += 1
        print(f"saved {dest}  ({len(data):,} bytes)")

    print(f"\nDone: {saved} files saved, {skipped} skipped -> {out_dir.resolve()}")


if __name__ == "__main__":
    main()
