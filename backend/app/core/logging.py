import time
import logging
import functools
import uuid
from typing import Callable

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

# ==========================================
# LOGGER SETUP
# ==========================================
def get_logger(name: str) -> logging.Logger:
    """Gunakan ini di setiap service: logger = get_logger(__name__)"""
    return logging.getLogger(name)

# ==========================================
# DECORATOR: @log_performance
# ==========================================
def log_performance(func: Callable = None, *, label: str = None):
    """
    Decorator untuk otomatis log waktu eksekusi sebuah function/method.

    Usage:
        @log_performance
        def get_kpi(db): ...

        @log_performance(label="Custom Label")
        def get_kpi(db): ...
    """
    def decorator(fn: Callable):
        _label = label or f"{fn.__qualname__}"
        _logger = logging.getLogger(fn.__module__)

        @functools.wraps(fn)
        def wrapper(*args, **kwargs):
            start = time.perf_counter()
            try:
                result = fn(*args, **kwargs)
                elapsed = time.perf_counter() - start
                _logger.info(f"[PERF] {_label} = {elapsed:.3f}s")
                return result
            except Exception as exc:
                elapsed = time.perf_counter() - start
                _logger.error(f"[PERF] {_label} FAILED after {elapsed:.3f}s — {type(exc).__name__}: {exc}")
                raise

        @functools.wraps(fn)
        async def async_wrapper(*args, **kwargs):
            start = time.perf_counter()
            try:
                result = await fn(*args, **kwargs)
                elapsed = time.perf_counter() - start
                _logger.info(f"[PERF] {_label} = {elapsed:.3f}s")
                return result
            except Exception as exc:
                elapsed = time.perf_counter() - start
                _logger.error(f"[PERF] {_label} FAILED after {elapsed:.3f}s — {type(exc).__name__}: {exc}")
                raise

        import asyncio
        if asyncio.iscoroutinefunction(fn):
            return async_wrapper
        return wrapper

    # Support @log_performance (tanpa args) dan @log_performance(label="...")
    if func is not None:
        return decorator(func)
    return decorator


# ==========================================
# MIDDLEWARE: HTTP Request Logging
# ==========================================
class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """
    Middleware yang otomatis log setiap HTTP request:
    - Method, path, status code
    - Response time
    - Request ID (untuk tracing)

    Daftarkan di main.py:
        from app.core.logging import RequestLoggingMiddleware
        app.add_middleware(RequestLoggingMiddleware)
    """

    # Path yang di-skip (terlalu noisy)
    SKIP_PATHS = {"/", "/docs", "/redoc", "/openapi.json", "/health"}

    def __init__(self, app, skip_paths: set = None):
        super().__init__(app)
        self._skip = skip_paths or self.SKIP_PATHS
        self._logger = logging.getLogger("fds.http")

    async def dispatch(self, request: Request, call_next) -> Response:
        # Skip noisy paths
        if request.url.path in self._skip:
            return await call_next(request)

        request_id = str(uuid.uuid4())[:8]
        start = time.perf_counter()

        # Log request masuk
        self._logger.info(
            f"[REQ] {request_id} → {request.method} {request.url.path}"
        )

        try:
            response = await call_next(request)
            elapsed = time.perf_counter() - start

            # Color-code by status
            status = response.status_code
            level = (
                logging.ERROR   if status >= 500 else
                logging.WARNING if status >= 400 else
                logging.INFO
            )
            self._logger.log(
                level,
                f"[RES] {request_id} ← {request.method} {request.url.path} "
                f"{status} ({elapsed:.3f}s)"
            )
            return response

        except Exception as exc:
            elapsed = time.perf_counter() - start
            self._logger.error(
                f"[RES] {request_id} ← {request.method} {request.url.path} "
                f"EXCEPTION ({elapsed:.3f}s) — {type(exc).__name__}: {exc}"
            )
            raise