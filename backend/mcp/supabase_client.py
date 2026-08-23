"""
Supabase Client Singleton & Database Helpers for MCP Servers
"""

import os
from pathlib import Path
from typing import Optional
from dotenv import load_dotenv
from supabase import Client, create_client

# Locate .env from backend directory
env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=env_path)

SUPABASE_URL: Optional[str] = os.getenv("SUPABASE_URL")
SUPABASE_KEY: Optional[str] = os.getenv("SUPABASE_KEY")

_client: Optional[Client] = None


def get_supabase_client() -> Client:
    """
    Returns an authenticated Supabase client instance.
    Raises RuntimeError if credentials are missing or connection fails.
    """
    global _client
    if _client is not None:
        return _client

    if not SUPABASE_URL or not SUPABASE_KEY:
        raise RuntimeError(
            "Supabase configuration missing: SUPABASE_URL and SUPABASE_KEY must be set in backend/.env"
        )

    try:
        _client = create_client(SUPABASE_URL, SUPABASE_KEY)
        return _client
    except Exception as e:
        raise RuntimeError(f"Failed to initialize Supabase client: {e}") from e
