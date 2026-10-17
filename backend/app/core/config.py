import os
from typing import List, Union, Optional
from pydantic import AnyHttpUrl, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    PROJECT_NAME: str = "FarmConnect AI"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True

    # Security
    SECRET_KEY: str = "dev-secret-key-change-in-production-farmconnect-ai-32chars"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours

    # Database
    # Defaults to local SQLite file for immediate local tests/dev,
    # fully compatible with PostgreSQL / Supabase via connection string
    DATABASE_URL: str = "sqlite:///./farmconnect.db"

    # CORS
    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
        "*"
    ]

    # Blockchain
    BLOCKCHAIN_RPC_URL: str = "http://127.0.0.1:8545"
    CHAIN_ID: int = 31337
    AGREEMENT_REGISTRY_ADDRESS: str = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0"
    ORDER_REGISTRY_ADDRESS: str = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0"
    TRACEABILITY_CONTRACT_ADDRESS: str = "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9"
    ESCROW_CONTRACT_ADDRESS: str = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512"
    TEST_FARM_TOKEN_ADDRESS: str = "0x5FbDB2315678afecb367f032d93F642f64180aa3"
    BACKEND_SIGNER_PRIVATE_KEY: Optional[str] = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"

    # Modular AI Layer (Anthropic, Gemini, OmniRoute, Speech Recognition)
    ANTHROPIC_API_KEY: Optional[str] = None
    ANTHROPIC_MODEL: str = "claude-3-5-sonnet-20241022"
    GEMINI_API_KEY: Optional[str] = None
    GEMINI_MODEL: str = "gemini-1.5-flash"
    OMNIROUTE_API_KEY: Optional[str] = None
    OMNIROUTE_BASE_URL: str = "https://api.omniroute.ai/v1"
    OMNIROUTE_MODEL: str = "gpt-4o-mini"
    AI_REQUEST_TIMEOUT_SECONDS: int = 25
    AI_MAX_TOKENS: int = 1024
    SPEECH_SERVICE_PROVIDER: str = "bhashini_browser_hybrid"

    # Storage and File Uploads
    UPLOAD_DIR: str = "uploads/forensics"
    MAX_UPLOAD_SIZE_BYTES: int = 10 * 1024 * 1024  # 10 MB maximum upload size
    ALLOWED_IMAGE_EXTENSIONS: List[str] = [".jpg", ".jpeg", ".png"]
    ALLOWED_IMAGE_MIME_TYPES: List[str] = ["image/jpeg", "image/png"]

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="allow"
    )

settings = Settings()
