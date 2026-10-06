import os
from pathlib import Path
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Case Studio Suite"
    app_version: str = "1.0.0"
    debug: bool = False
    host: str = "0.0.0.0"
    port: int = 8000
    
    # Storage & Database paths
    data_dir: str = os.getenv("DATA_DIR", "./data")
    db_path: str = os.getenv("DB_PATH", "./data/case_studio.db")
    skills_catalog_dir: str = os.getenv("SKILLS_CATALOG_DIR", "./skills_catalog")
    
    # Gemini API keys (comma-separated)
    gemini_api_keys: str = os.getenv("GEMINI_API_KEYS", "")
    
    # Models
    default_model: str = os.getenv("DEFAULT_MODEL", "gemini-2.5-pro")
    fallback_model: str = os.getenv("FALLBACK_MODEL", "gemini-2.5-flash")

    # Archify Sidecar Add-on Settings
    archify_enabled: bool = os.getenv("ARCHIFY_ENABLED", "true").lower() in ("true", "1", "yes")
    archify_service_url: str = os.getenv("ARCHIFY_SERVICE_URL", "http://archify-service:3001")
    archify_render_timeout: float = float(os.getenv("ARCHIFY_RENDER_TIMEOUT", "20.0"))
    archify_data_subdir: str = os.getenv("ARCHIFY_DATA_SUBDIR", "archify")
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    @property
    def api_key_list(self) -> List[str]:
        if not self.gemini_api_keys:
            return []
        keys = [k.strip() for k in self.gemini_api_keys.split(",") if k.strip()]
        return keys

    @property
    def resolved_data_dir(self) -> Path:
        p = Path(self.data_dir).resolve()
        p.mkdir(parents=True, exist_ok=True)
        (p / "projects").mkdir(parents=True, exist_ok=True)
        return p

    @property
    def resolved_db_path(self) -> Path:
        p = Path(self.db_path).resolve()
        p.parent.mkdir(parents=True, exist_ok=True)
        return p

    @property
    def resolved_skills_catalog_dir(self) -> Path:
        p = Path(self.skills_catalog_dir).resolve()
        p.mkdir(parents=True, exist_ok=True)
        return p

    @property
    def resolved_data_skills_catalog_dir(self) -> Path:
        p = (self.resolved_data_dir / "skills_catalog").resolve()
        p.mkdir(parents=True, exist_ok=True)
        return p


settings = Settings()

