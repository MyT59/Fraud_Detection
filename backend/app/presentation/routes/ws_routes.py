from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.presentation.websocket.connection_manager import manager
from app.core.security import decode_token

router = APIRouter()

@router.websocket("/ws/alerts")
async def websocket_alerts(websocket: WebSocket):
    token = websocket.query_params.get("token")

    payload = decode_token(token)
    if not payload:
        await websocket.close()
        return

    admin_id = int(payload["sub"])

    await manager.connect(admin_id, websocket)

    try:
        while True:
            await websocket.receive_text()  # keep alive
    except WebSocketDisconnect:
        manager.disconnect(admin_id, websocket)