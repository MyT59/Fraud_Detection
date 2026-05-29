import time
import requests
import os
from sqlalchemy.orm import Session
from sqlalchemy import text

class HealthCheckService:

    @staticmethod
    def check_endpoint(url: str, use_auth: bool = False):
        """Hanya digunakan untuk service EXTERNAL (pihak ketiga)"""
        start = time.time()
        headers = {}

        if use_auth:
            headers["X-API-KEY"] = os.getenv("SYSTEM_API_KEY", "internal-secret-key")

        try:
            res = requests.get(url, headers=headers, timeout=2)
            latency = int((time.time() - start) * 1000)

            if res.status_code >= 500:
                status = "DEGRADED"
            elif res.status_code >= 400:
                status = "DEGRADED"
            else:
                status = "OPERATIONAL"

            return {
                "http_status": res.status_code,
                "status": status,
                "latency": latency
            }
        except:
            return {
                "http_status": None,
                "status": "DOWN",
                "latency": None
            }

    @staticmethod
    def get_all_services(db: Session, base_url: str = ""):
        # 🔥 LOCAL IMPORTS (Mencegah Circular Import)
        from app.application.services.dashboard_service import DashboardService
        from app.application.services.alert_service import get_open_alert_count

        services = [
            {
                "name": "Database Node",
                "type": "internal",
                "check": lambda: db.execute(text("SELECT 1")),
                "description": "PostgreSQL connection health"
            },
            {
                "name": "Dashboard Service",
                "type": "internal",
                "check": lambda: DashboardService.get_kpi(db),
                "description": "Stats & overview logic"
            },
            {
                "name": "Alerts Service",
                "type": "internal",
                "check": lambda: get_open_alert_count(db),
                "description": "Fraud & rule engine connection"
            },
            # Contoh jika pakai Third Party:
            # {
            #     "name": "Payment Gateway API",
            #     "type": "external",
            #     "url": "https://api.midtrans.com/v1/health",
            #     "use_auth": False,
            #     "description": "Midtrans External Provider"
            # }
        ]

        results = []

        for s in services:
            if s.get("type") == "internal":
                # 🔥 INTERNAL SERVICE CHECK
                try:
                    start = time.time()
                    s["check"]() # Eksekusi fungsi secara langsung!
                    latency = int((time.time() - start) * 1000)

                    results.append({
                        "name": s["name"],
                        "description": s["description"],
                        "status": "OPERATIONAL",
                        "http_status": 200,
                        "latency": latency
                    })
                except Exception as e:
                    results.append({
                        "name": s["name"],
                        "description": s["description"],
                        "status": "DOWN",
                        "http_status": 500,
                        "latency": None
                    })
            else:
                # 🌐 EXTERNAL SERVICE CHECK (Via HTTP)
                check = HealthCheckService.check_endpoint(s["url"], use_auth=s.get("use_auth", False))
                results.append({
                    "name": s["name"],
                    "description": s["description"],
                    "status": check["status"],
                    "http_status": check["http_status"],
                    "latency": check["latency"]
                })

        return results