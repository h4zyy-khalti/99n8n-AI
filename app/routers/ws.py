from typing import Dict, Any, List, Set
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter()

active_websocket_connections: Set[WebSocket] = set()

async def broadcast_to_clients(message: Dict[str, Any]):
    disconnected: List[WebSocket] = []
    for ws in active_websocket_connections:
        try:
            await ws.send_json(message)
        except Exception:
            disconnected.append(ws)
    for ws in disconnected:
        try:
            active_websocket_connections.remove(ws)
        except KeyError:
            pass

@router.websocket("/ws/n8n")
async def websocket_n8n(websocket: WebSocket):
    await websocket.accept()
    active_websocket_connections.add(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        try:
            active_websocket_connections.remove(websocket)
        except KeyError:
            pass


