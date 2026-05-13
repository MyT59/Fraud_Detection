from fastapi import WebSocket

class ConnectionManager:
    def __init__(self):
        self.active_connections: dict[int, list[WebSocket]] = {}

    async def connect(self, admin_id: int, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.setdefault(admin_id, []).append(websocket)

    def disconnect(self, admin_id: int, websocket: WebSocket):
        if admin_id in self.active_connections:
            self.active_connections[admin_id].remove(websocket)
            if not self.active_connections[admin_id]:
                del self.active_connections[admin_id]

    async def send_to_user(self, admin_id: int, message: dict):
        for ws in self.active_connections.get(admin_id, []):
            await ws.send_json(message)

    async def broadcast(self, message: dict):
        for conns in self.active_connections.values():
            for ws in conns:
                await ws.send_json(message)

manager = ConnectionManager()