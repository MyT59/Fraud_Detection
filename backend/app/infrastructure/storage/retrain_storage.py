import json
from pathlib import Path
from typing import Any, List, Dict

# Kita asumsikan menggunakan DATA_DIR dari app.paths seperti kode aslinya,
# atau kamu bisa pass parameter `base_dir` saat inisialisasi.
from app.paths import DATA_DIR

class RetrainStorage:
    def __init__(self, base_dir: Path = DATA_DIR):
        self.base_dir = base_dir
        self.schedules_path = self.base_dir / "retrain_schedules.json"
        self.history_path = self.base_dir / "retrain_history.json"
        self.patterns_path = self.base_dir / "discovered_patterns.json"

        # Pastikan folder ada
        self.base_dir.mkdir(parents=True, exist_ok=True)

    # ==========================================
    # SCHEDULES
    # ==========================================
    def load_schedules(self) -> List[Dict[str, Any]]:
        if not self.schedules_path.exists():
            self.save_schedules([])
            return []
        
        content = self.schedules_path.read_text(encoding="utf-8").strip()
        return json.loads(content) if content else []

    def save_schedules(self, schedules: List[Dict[str, Any]]) -> None:
        self.schedules_path.write_text(json.dumps(schedules, indent=2), encoding="utf-8")

    # ==========================================
    # HISTORY
    # ==========================================
    def load_history(self) -> List[Dict[str, Any]]:
        if not self.history_path.exists():
            self.save_history([])
            return []
        
        content = self.history_path.read_text(encoding="utf-8").strip()
        return json.loads(content) if content else []

    def save_history(self, history: List[Dict[str, Any]]) -> None:
        self.history_path.write_text(json.dumps(history, indent=2), encoding="utf-8")

    # ==========================================
    # PATTERNS
    # ==========================================
    def load_patterns(self) -> List[Dict[str, Any]]:
        if not self.patterns_path.exists():
            self.save_patterns([])
            return []
        
        content = self.patterns_path.read_text(encoding="utf-8").strip()
        return json.loads(content) if content else []

    def save_patterns(self, patterns: List[Dict[str, Any]]) -> None:
        self.patterns_path.write_text(json.dumps(patterns, indent=2), encoding="utf-8")