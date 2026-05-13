import asyncio
import json
import redis.asyncio as redis

REDIS_URL = "redis://localhost:6379"

class RedisPubSub:
    def __init__(self):
        self.redis = redis.from_url(REDIS_URL, decode_responses=True)
        self.pubsub = self.redis.pubsub()

    async def publish(self, channel: str, message: dict):
        await self.redis.publish(channel, json.dumps(message))

    async def subscribe(self, channel: str):
        await self.pubsub.subscribe(channel)

        async for msg in self.pubsub.listen():
            if msg["type"] == "message":
                yield json.loads(msg["data"])


redis_service = RedisPubSub()