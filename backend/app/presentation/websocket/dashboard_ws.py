from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.presentation.websocket.connection_manager import manager

router = APIRouter()

@router.websocket("/ws/dashboard/{admin_id}")
async def dashboard_ws(websocket: WebSocket, admin_id: int):
    await manager.connect(admin_id, websocket)

    try:
        while True:
            # Tetap tahan koneksi WS agar client tidak terputus
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(admin_id, websocket)