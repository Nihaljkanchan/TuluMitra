"""Quick check that OPENAI_API_KEY in .env can reach OpenAI.

Run from this folder:
    python test.py
"""

import os
from pathlib import Path

from dotenv import load_dotenv
from openai import OpenAI

load_dotenv(Path(__file__).with_name(".env"))

api_key = os.getenv("OPENAI_API_KEY", "").strip()
model = os.getenv("OPENAI_MODEL", "gpt-5-mini").strip()

if not api_key:
    raise RuntimeError("OPENAI_API_KEY not found. Add it to tulu-mitra-backend/.env")

client = OpenAI(api_key=api_key)
response = client.chat.completions.create(
    model=model,
    messages=[{"role": "user", "content": "Reply with exactly: TuluMitra OpenAI connected."}],
    max_completion_tokens=64,
)

text = (response.choices[0].message.content or "").strip()
print(f"model={model}")
print(text or "(empty reply)")
if "connected" not in text.lower():
    raise SystemExit("Unexpected reply from OpenAI")
