import asyncio
import json
import logging
import redis.asyncio as redis

# 🔥 1. Siapkan logger untuk mencetak pesan di terminal Uvicorn
logger = logging.getLogger(__name__)

REDIS_URL = "redis://localhost:6379"

class RedisPubSub:
    def __init__(self):
        self.redis = redis.from_url(REDIS_URL, decode_responses=True)
        self.pubsub = self.redis.pubsub()

    async def publish(self, channel: str, message: dict):
        try:
            await self.redis.publish(channel, json.dumps(message))
        except Exception as e:
            logger.warning(f"⚠️ [Redis Bypassed] Gagal kirim ke '{channel}'. Redis belum menyala/terkoneksi.")

    async def subscribe(self, channel: str):
        try:
            await self.pubsub.subscribe(channel)
            logger.info(f"🎧 [Redis] Berhasil subscribe ke channel '{channel}'")
            
            async for msg in self.pubsub.listen():
                if msg["type"] == "message":
                    yield json.loads(msg["data"])
                    
        except Exception as e:
            logger.error(f"❌ [Redis Error] Gagal listen ke channel '{channel}': {e}")
            await asyncio.sleep(5) 


redis_service = RedisPubSub()