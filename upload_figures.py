#!/usr/bin/env python3
import requests
from pathlib import Path

EL_FILE_ENDPOINT = "https://api.elevenlabs.io/v1/convai/knowledge-base/file"
API_KEY = "sk_f211031fce1c35922009fe067d3f5a5afbc813b0c4387b6e"  # replace with env or actual key

def upload_file(path: Path, name: str):
    with open(path, "rb") as f:
        files = {"file": (path.name, f, "text/html")}
        data = {"name": name}
        headers = {"xi-api-key": API_KEY}
        resp = requests.post(EL_FILE_ENDPOINT, headers=headers, files=files, data=data, timeout=60)
        if resp.ok:
            print(f"✔ Uploaded {name} ({path.stat().st_size/1024:.1f} KB)")
        else:
            print(f"✘ Upload failed for {name}: {resp.status_code} {resp.text[:200]}")

if __name__ == "__main__":
    upload_file(Path("./kb_html/figure-1-genai-adoption-in-he-students-2025.html"),
                "figure-1-genai-adoption-in-he-students-2025")
    upload_file(Path("./kb_html/figure-2-genai-adoption-in-he-students-2025.html"),
                "figure-2-genai-adoption-in-he-students-2025")