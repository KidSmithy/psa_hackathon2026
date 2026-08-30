"""
PSA Incident Triage — LangGraph agentic workflow (Stage 2 + Stage 3).

Loads backend/.env once, on first import of this package, so every module
below can read OPENAI_API_KEY / LANGFUSE_* / SUPABASE_* without each having
to load it separately.
"""

from pathlib import Path
from dotenv import load_dotenv

for fname in [".env", "config.env", ".env.production"]:
    env_file = Path(__file__).resolve().parent.parent / fname
    if env_file.exists():
        load_dotenv(dotenv_path=env_file)
