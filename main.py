from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import asyncio
from typing import Dict

from app.core.config import get_allowed_origins
from app.routers import auth as auth_router
from app.routers import admin as admin_router
from app.routers import data as data_router
from app.routers import ws as ws_router
from app.services import n8n_sync

app = FastAPI()

# CORS
allowed_origins = get_allowed_origins()
app.add_middleware(
    CORSMiddleware,
	allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(auth_router.router)
app.include_router(admin_router.router)
app.include_router(data_router.router)
app.include_router(ws_router.router)

# Background sync loop
async def _sync_loop():
	await asyncio.sleep(1)
	while True:
		counts: Dict[str, int] = n8n_sync.sync_once()
		await ws_router.broadcast_to_clients({
			"type": "n8n_sync",
			"counts": counts,
			"timestamp": ""
		})
		await asyncio.sleep(15)

@app.on_event("startup")
async def on_startup():
	asyncio.create_task(_sync_loop())
