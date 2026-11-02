"""Inline src/ into a single self-contained index.html. `--check` only compares, and exits 1 if it is stale."""
import json
import sys
from pathlib import Path

root = Path(__file__).parent
src = root / "src"
modules = "".join(f"<script>\n{(src / name).read_text()}</script>\n" for name in json.loads((src / "manifest.json").read_text()))
# The page script (VB-053): src/page/*.js, in the order of src/page.json, spliced into the one closure in body.html. Each file's first
# line is its `// @sys` header, for the lint and the module map, and is left out of the page, so the script is as it was before the split.
script = "".join((src / name).read_text().split("\n", 1)[1] for name in json.loads((src / "page.json").read_text()))
body = (src / "body.html").read_text()
assert body.count("<!--__PAGE__-->\n") == 1, "body.html must hold one <!--__PAGE__--> line"
page = (src / "head.html").read_text() + body.replace("<!--__MODULES__-->\n", modules).replace("<!--__PAGE__-->\n", script)
target = root / "index.html"
if "--check" in sys.argv:
    if not target.exists() or target.read_text() != page:
        print("index.html is out of date: run python3 build.py")
        sys.exit(1)
    sys.exit(0)
target.write_text(page)
print(f"index.html: {len(page):,} bytes")
