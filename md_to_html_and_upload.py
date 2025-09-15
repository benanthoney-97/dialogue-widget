#!/usr/bin/env python3
import os
import re
import time
import argparse
import requests
from pathlib import Path
from datetime import datetime
from typing import List, Tuple

import markdown  # pip install markdown

EL_FILE_ENDPOINT = "https://api.elevenlabs.io/v1/convai/knowledge-base/file"

# ---------- utilities ----------
def slugify(text: str, maxlen: int = 64) -> str:
    text = re.sub(r"[^\w\s-]", "", text).strip().lower()
    text = re.sub(r"[\s_-]+", "-", text)
    return text[:maxlen].strip("-") or "chunk"

def split_markdown(md: str, split_level: int = 2) -> List[Tuple[str, str]]:
    """
    Split by ATX headings (## for level=2 by default).
    Returns list of (title, body_markdown). If the file starts without a heading,
    create a 'Introduction' chunk.
    """
    # Normalize line endings
    md = md.replace("\r\n", "\n").replace("\r", "\n")
    pattern = re.compile(rf"^(?P<h>{'#' * split_level})\s+(?P<title>.+?)\s*$", re.MULTILINE)

    chunks = []
    last_idx = 0
    last_title = "Introduction"

    for m in pattern.finditer(md):
        if m.start() != 0:
            body = md[last_idx:m.start()].strip()
            if body:
                chunks.append((last_title.strip("# ").strip(), body))
        last_title = m.group("title")
        last_idx = m.end()

    # tail
    tail = md[last_idx:].strip()
    if tail:
        chunks.append((last_title.strip("# ").strip(), tail))

    # If nothing matched and the whole doc is one block:
    if not chunks and md.strip():
        # Try to grab first H1/H2 as title; else fallback
        m1 = re.search(r"^(#+)\s+(.+)$", md, re.MULTILINE)
        title = m1.group(2).strip() if m1 else "Document"
        chunks.append((title, md))

    return chunks

def md_to_html(md_text: str) -> str:
    """Convert Markdown to HTML with tables."""
    return markdown.markdown(
        md_text,
        extensions=["tables", "fenced_code", "toc"]
    )

def wrap_html(doc_title: str, provenance: str, body_html: str, beige="#f8f7f3") -> str:
    """Minimal, clean, self-contained HTML wrapper with beige background."""
    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>{doc_title}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    :root {{ --beige: {beige}; --text: #111; --muted: #555; }}
    html, body {{ margin: 0; background: var(--beige); color: var(--text); }}
    body {{ font: 16px/1.55 system-ui, -apple-system, Segoe UI, Roboto, sans-serif; padding: 16px; }}
    .container {{ background: var(--beige); border-radius: 12px; overflow: hidden; }}
    h1, h2, h3 {{ line-height: 1.25; }}
    table {{ border-collapse: collapse; width: 100%; margin: 12px 0; }}
    th, td {{ border: 1px solid rgba(0,0,0,.15); padding: 8px; text-align: left; }}
    thead th {{ background: rgba(0,0,0,.04); }}
    .prov {{ font-size: 12px; color: var(--muted); margin-bottom: 10px; }}
    code, pre {{ font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }}
  </style>
</head>
<body>
  <div class="container">
    <div class="prov">{provenance}</div>
    {body_html}
  </div>
</body>
</html>"""

def upload_file(path: Path, api_key: str, name: str) -> requests.Response:
    with open(path, "rb") as f:
        files = {"file": (path.name, f, "text/html")}
        data = {"name": name}
        headers = {"xi-api-key": api_key}
        resp = requests.post(EL_FILE_ENDPOINT, headers=headers, files=files, data=data, timeout=60)
        return resp

# ---------- main ----------
def main():
    p = argparse.ArgumentParser(description="Convert LlamaParse Markdown to HTML chunks and upload to ElevenLabs KB.")
    p.add_argument("--in_dir", required=True, help="Folder containing .md from LlamaParse")
    p.add_argument("--out_dir", required=True, help="Folder to write HTML chunks")
    p.add_argument("--api_key", required=True, help="ElevenLabs API key")
    p.add_argument("--report_name", default="", help="Logical report name for provenance (e.g., 'UK Spending Review, Jun 2025')")
    p.add_argument("--split_level", type=int, default=2, help="Markdown heading level to split on (default: 2 == '##')")
    p.add_argument("--rate_ms", type=int, default=400, help="Delay between uploads (ms)")
    p.add_argument("--dry_run", action="store_true", help="Skip uploads; only write HTML")
    args = p.parse_args()

    in_dir = Path(args.in_dir)
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    uploaded = 0
    written = 0

    for md_path in sorted(in_dir.glob("*.md")):
        raw = md_path.read_text(encoding="utf-8")
        base_title = md_path.stem.replace("_", " ")
        chunks = split_markdown(raw, split_level=args.split_level)

        for idx, (title, body_md) in enumerate(chunks, start=1):
            # Construct a sensible document title + name
            doc_title = f"{args.report_name or base_title} — {title}"
            name = slugify(f"{md_path.stem}-{title}-{idx}")

            # Provenance header (shows up in the doc and helps the agent cite)
            prov_bits = []
            if args.report_name:
                prov_bits.append(f"<strong>Report:</strong> {args.report_name}")
            else:
                prov_bits.append(f"<strong>Source file:</strong> {md_path.name}")
            prov_bits.append(f"<strong>Section:</strong> {title}")
            prov_bits.append(f"<strong>Ingested:</strong> {datetime.utcnow().isoformat(timespec='seconds')}Z")
            provenance = " · ".join(prov_bits)

            html_body = md_to_html(body_md)
            html_doc = wrap_html(doc_title=doc_title, provenance=provenance, body_html=html_body)

            out_file = out_dir / f"{name}.html"
            out_file.write_text(html_doc, encoding="utf-8")
            written += 1

            if not args.dry_run:
                resp = upload_file(out_file, args.api_key, name=name)
                if resp.ok:
                    uploaded += 1
                    print(f"✔ Uploaded {name} ({out_file.stat().st_size/1024:.1f} KB)")
                else:
                    print(f"✘ Upload failed for {name}: {resp.status_code} {resp.text[:200]}")
                time.sleep(args.rate_ms / 1000.0)

    print(f"\nDone. Wrote {written} HTML chunks. Uploaded {uploaded} to ElevenLabs KB.")

if __name__ == "__main__":
    main()