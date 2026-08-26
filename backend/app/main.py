from fastapi import FastAPI, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from app.routers import auth
from app.dependencies.deps import get_current_user
import time
import logging

# configure logging once, at the top level
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
    handlers=[
        logging.StreamHandler(),           # logs to terminal
        logging.FileHandler("app.log")     # logs to file
    ]
)

logger = logging.getLogger(__name__)

app = FastAPI()

app.add_middleware(
  CORSMiddleware,
  allow_origins=['http://localhost:3000'],
  allow_credentials=True,
  allow_methods=["*"],
  allow_headers=["*"]
)

@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = time.time()
    logger.info(f"→ {request.method} {request.url.path}")
    response = await call_next(request)
    duration = time.time() - start_time
    logger.info(f"← {request.method} {request.url.path} {response.status_code} ({duration:.3f}s)")
    return response

app.include_router(auth.router)

@app.get("/")
def check(user = Depends(get_current_user)):
  return "Everything is working"