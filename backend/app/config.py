"""
app/config.py

Central configuration module — loads environment variables from .env

Why a dedicated config module instead of calling os.getenv() directly in each file?
- Single source of truth: change a variable name here, it updates everywhere
- Fail-fast: missing required env vars are caught at startup, not at runtime
- Testable: easy to mock config values in tests

Required environment variables (must be set in .env):
    AUTH_SECRET_KEY              — secret used to sign/verify JWT tokens
    AUTH_ALGORITHM               — JWT signing algorithm (e.g. "HS256")
    OPENAI_API_KEY               — OpenAI API key for embeddings and chat
    ACCESS_TOKEN_EXPIRE_MINUTES  — JWT expiry in minutes (defaults to 30)
"""

from pathlib import Path
from dotenv import load_dotenv
import os

# load .env from the project root (two levels up from this file: app/config.py → app/ → backend/)
load_dotenv(Path(__file__).resolve().parent.parent / ".env")


SECRET_KEY = os.getenv("AUTH_SECRET_KEY")
ALGORITHM = os.getenv("AUTH_ALGORITHM")
EXPIRE_MIN = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))
OPEN_AI_KEY = os.getenv("OPENAI_API_KEY")