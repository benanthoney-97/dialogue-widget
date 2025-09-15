#!/usr/bin/env python3
import re
import time
import argparse
import requests
from pathlib import Path
from datetime import datetime

import markdown  # pip install markdown

EL_FILE_ENDPOINT = "https://api.elevenlabs.io/v1/convai/knowledge-base/file"

def slugify(text: str, maxlen: int = 80) -> str:
    text = re.sub(r"[^\w\s-]", "", text).strip().lower()
    text = re.sub(r"[\s_-]+", "-", text)
    return text[:maxlen].strip("-") or "doc"

def md_to_html(md_text: str) -> str:
    return markdown.markdown(
        md_text,
        extensions=["tables", "fenced_code", "toc"]
    )

def wrap_html(doc_title: str, provenance: str, body_html: str, beige="#f8f7f3") -> str:
    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>{doc_title}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    :root {{ --beige: {beige}; --text: #111; --muted: #555; }}
    html, body {{ margin:0; background:var(--beige); color:var(--text); }}
    body {{ font:16px/1.55 system-ui,-apple-system,Segoe UI,Roboto,sans-serif; padding:16px; }}
    .container {{ background: var(--beige); border-radius:12px; }}
    h1,h2,h3 {{ line-height:1.25; }}
    table {{ border-collapse:collapse; width:100%; margin:12px 0; }}
    th, td {{ border:1px solid rgba(0,0,0,.15); padding:8px; text-align:left; }}
    thead th {{ background: rgba(0,0,0,.04); }}
    .prov {{ font-size:12px; color:var(--muted); margin-bottom:10px; }}
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
        return requests.post(EL_FILE_ENDPOINT, headers=headers, files=files, data=data, timeout=60)

def gather_md_paths(in_path: Path):
    if in_path.is_file() and in_path.suffix.lower() == ".md":
        return [in_path]
    if in_path.is_dir():
        return sorted(p for p in in_path.glob("*.md") if p.is_file())
    return []

def main():
    p = argparse.ArgumentParser(description="Convert Markdown (.md) to single-file HTML and upload to ElevenLabs KB.")
    p.add_argument("--in_path", required=True, help="Path to a .md file OR a directory containing .md files")
    p.add_argument("--out_dir", required=True, help="Folder to write HTML files")
    p.add_argument("--api_key", help="ElevenLabs API key (omit or use --dry_run to skip upload)")
    p.add_argument("--report_name", default="", help="Logical report name for provenance/title")
    p.add_argument("--rate_ms", type=int, default=400, help="Delay between uploads (ms)")
    p.add_argument("--dry_run", action="store_true", help="Write HTML only; skip upload")
    args = p.parse_args()

    in_path = Path(args.in_path)
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    md_paths = gather_md_paths(in_path)
    if not md_paths:
        print(f"No .md files found at: {in_path}")
        print("Tip: pass a single .md file or a directory containing .md files.")
        return

    written = 0
    uploaded = 0

    for md_file in md_paths:
        raw = md_file.read_text(encoding="utf-8")

        # Title: report_name or file stem
        doc_title = args.report_name or md_file.stem.replace("_", " ").title()

        # Provenance block
        provenance = " · ".join([
            f"<strong>Source file:</strong> {md_file.name}",
            f"<strong>Report:</strong> {doc_title}",
            f"<strong>Ingested:</strong> {datetime.utcnow().isoformat(timespec='seconds')}Z",
        ])

        html_body = md_to_html(raw)
        html_doc = wrap_html(doc_title=doc_title, provenance=provenance, body_html=html_body)

        name_slug = slugify(args.report_name or md_file.stem)
        out_file = out_dir / f"{name_slug}.html"
        out_file.write_text(html_doc, encoding="utf-8")
        written += 1

        if not args.dry_run and args.api_key:
            resp = upload_file(out_file, args.api_key, name=name_slug)
            if resp.ok:
                uploaded += 1
                print(f"✔ Uploaded {name_slug} ({out_file.stat().st_size/1024:.1f} KB)")
            else:
                print(f"✘ Upload failed for {name_slug}: {resp.status_code} {resp.text[:200]}")
            time.sleep(args.rate_ms / 1000.0)

    print(f"\nDone. Wrote {written} HTML file(s). Uploaded {uploaded}.")

if __name__ == "__main__":
    main()