from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.presentation.websocket.connection_manager import manager
from app.core.security import decode_token

router = APIRouter()

@router.websocket("/ws/dashboard/{admin_id}")
async def dashboard_ws(websocket: WebSocket, admin_id: int):
    token = websocket.query_params.get("token")
    payload = decode_token(token)
    if not payload or str(payload.get("sub")) != str(admin_id):
        await websocket.close(code=1008)
        return

    await manager.connect(admin_id, websocket)

    try:
        while True:
            # Tetap tahan koneksi WS agar client tidak terputus
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(admin_id, websocket)
