from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Environment configuration, prefixed with ML_."""

    model_config = SettingsConfigDict(env_prefix="ML_", env_file=".env")

    # Path to the .onnx file this service serves.
    model_path: Path = Path("models/model.onnx")
    host: str = "0.0.0.0"
    port: int = 8000


settings = Settings()
