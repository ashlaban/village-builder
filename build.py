"""Inline src/ into a single self-contained index.html. `--check` only compares, and exits 1 if it is stale."""
import json
import sys
from pathlib import Path

root = Path(__file__).parent
src = root / "src"
modules = "".join(f"<script>\n{(src / name).read_text()}</script>\n" for name in json.loads((src / "manifest.json").read_text()))
page = (src / "head.html").read_text() + (src / "body.html").read_text().replace("<!--__MODULES__-->\n", modules)
target = root / "index.html"
if "--check" in sys.argv:
    if not target.exists() or target.read_text() != page:
        print("index.html is out of date: run python3 build.py")
        sys.exit(1)
    sys.exit(0)
target.write_text(page)
print(f"index.html: {len(page):,} bytes")
