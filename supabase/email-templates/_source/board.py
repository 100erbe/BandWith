"""Usage: board.py OUTNAME name:LABEL [name:LABEL ...] -> desktop+mobile columns per template."""
import sys, pathlib
outname, items = sys.argv[1], sys.argv[2:]
cols = ""
for it in items:
    name, lab = it.split(":", 1)
    f = f"{name}.preview.html"
    cols += (f'<div><div class="lab">{lab} — DESKTOP</div><iframe src="{f}" width="640" height="1320"></iframe></div>'
             f'<div><div class="lab">{lab} — MOBILE 320</div><iframe src="{f}" width="320" height="1320"></iframe></div>')
pathlib.Path(f"out/board-{outname}.html").write_text(f'''<!doctype html><html><head><meta charset="utf-8"><style>
body{{margin:0;padding:28px;background:#1C1C1C;font-family:Menlo,monospace;}}
.row{{display:flex;gap:28px;align-items:flex-start}} .lab{{color:#D5FB46;font-size:13px;letter-spacing:.08em;margin:0 0 10px}}
iframe{{border:0;border-radius:14px;background:#E5E3E0;display:block}}
</style></head><body><div class="row">{cols}</div></body></html>''')
