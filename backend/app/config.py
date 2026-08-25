from pathlib import Path
from dotenv import load_dotenv
import os


load_dotenv(Path(__file__).resolve().parent.parent / ".env")


SECRET_KEY = os.getenv("AUTH_SECRET_KEY")
ALGORITHM = os.getenv("AUTH_ALGORITHM")
EXPIRE_MIN = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))