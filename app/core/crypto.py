import os
import base64
import hashlib
import logging
from pathlib import Path
from cryptography.fernet import Fernet
from app.config import settings

logger = logging.getLogger("case_studio.crypto")

_fernet_instance: Fernet = None


def _get_or_create_master_key() -> bytes:
    """
    Retrieves or creates the Fernet master encryption key.
    Priority:
    1. APP_SECRET_KEY environment variable.
    2. Persistent .master_key file in data directory (chmod 0600).
    """
    env_secret = os.getenv("APP_SECRET_KEY", "").strip()
    if env_secret:
        try:
            # Try if it's already a valid 32-byte url-safe base64 Fernet key
            decoded = base64.urlsafe_b64decode(env_secret.encode("utf-8"))
            if len(decoded) == 32:
                return env_secret.encode("utf-8")
        except Exception:
            pass
        # Derive a 32-byte key from arbitrary passphrase via SHA-256
        derived = base64.urlsafe_b64encode(hashlib.sha256(env_secret.encode("utf-8")).digest())
        return derived

    data_dir = settings.resolved_data_dir
    data_dir.mkdir(parents=True, exist_ok=True)
    key_path = data_dir / ".master_key"

    if key_path.exists():
        try:
            content = key_path.read_bytes().strip()
            if len(content) > 0:
                return content
        except Exception as e:
            logger.error(f"Error reading master key from {key_path}: {e}")

    # Generate fresh Fernet key
    new_key = Fernet.generate_key()
    try:
        key_path.write_bytes(new_key)
        try:
            os.chmod(key_path, 0o600)
        except Exception:
            pass
        logger.info(f"Generated new master encryption key stored at {key_path} (0600)")
    except Exception as e:
        logger.error(f"Failed to persist master key to {key_path}: {e}")

    return new_key


def get_fernet() -> Fernet:
    global _fernet_instance
    if _fernet_instance is None:
        key = _get_or_create_master_key()
        _fernet_instance = Fernet(key)
    return _fernet_instance


def encrypt_key(plain: str) -> str:
    """Encrypts plaintext API key into Fernet ciphertext string."""
    if not plain:
        return ""
    fernet = get_fernet()
    return fernet.encrypt(plain.strip().encode("utf-8")).decode("utf-8")


def decrypt_key(encrypted: str) -> str:
    """Decrypts Fernet ciphertext string back to plaintext API key."""
    if not encrypted:
        return ""
    fernet = get_fernet()
    return fernet.decrypt(encrypted.strip().encode("utf-8")).decode("utf-8")


def compute_key_fingerprint(key: str) -> str:
    """Computes SHA-256 fingerprint (first 16 hex chars) for deduplication without storing plaintext."""
    clean = key.strip()
    return hashlib.sha256(clean.encode("utf-8")).hexdigest()[:16]


def mask_key(key: str) -> str:
    """Masks key for safe UI rendering e.g. AIza...lLpw."""
    clean = key.strip()
    if len(clean) <= 8:
        return "***"
    return f"{clean[:4]}...{clean[-4:]}"
