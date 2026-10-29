"""Inline src/ into a single self-contained index.html."""
from pathlib import Path

src = Path(__file__).parent / "src"
page = (src / "head.html").read_text() + (src / "body.html").read_text()
for marker, name in [("/*__GEN__*/", "gen.js"), ("/*__CULTURE__*/", "culture.js"), ("/*__SIM__*/", "sim.js")]:
    page = page.replace(marker, (src / name).read_text())
(Path(__file__).parent / "index.html").write_text(page)
print(f"index.html: {len(page):,} bytes")
