"""Google sign-in and per-user data storage for Tulu Mitra.

The frontend sends Google's signed ID token to POST /auth/google. We verify
it with Google, then hand back our own signed session token. Each person's
chats / name / progress are saved as one JSON file in storage/users/.
"""
import base64
import hashlib
import hmac
import json
import os
import secrets
import threading
import time
from pathlib import Path

from flask import jsonify, request

try:
    from dotenv import load_dotenv

    load_dotenv()
except Exception:  # python-dotenv missing: config.py may already load .env
    pass

ROOT = Path(__file__).resolve().parent.parent
USERS_DIR = ROOT / "storage" / "users"
SECRET_FILE = ROOT / "storage" / ".session_secret"
SESSION_DAYS = 30
MAX_DATA_BYTES = 2_000_000
_lock = threading.Lock()


def _client_id():
    return os.getenv("GOOGLE_CLIENT_ID", "").strip()


def _admin_emails():
    raw = os.getenv("ADMIN_EMAILS", "")
    return {e.strip().lower() for e in raw.split(",") if e.strip()}


def _secret():
    """Key used to sign session tokens: SECRET_KEY from .env, else a saved random one."""
    env = os.getenv("SECRET_KEY", "").strip()
    if env:
        return env.encode()
    SECRET_FILE.parent.mkdir(parents=True, exist_ok=True)
    if not SECRET_FILE.exists():
        SECRET_FILE.write_text(secrets.token_urlsafe(48))
    return SECRET_FILE.read_text().strip().encode()


def _b64(b):
    return base64.urlsafe_b64encode(b).rstrip(b"=").decode()


def _unb64(s):
    return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))


def make_token(sub):
    body = _b64(json.dumps({"sub": sub, "exp": int(time.time()) + SESSION_DAYS * 86400}).encode())
    sig = _b64(hmac.new(_secret(), body.encode(), hashlib.sha256).digest())
    return f"{body}.{sig}"


def read_token(token):
    """Return the user id inside a valid, unexpired token, else None."""
    try:
        body, sig = token.split(".", 1)
        good = _b64(hmac.new(_secret(), body.encode(), hashlib.sha256).digest())
        if not hmac.compare_digest(sig, good):
            return None
        data = json.loads(_unb64(body))
        return data["sub"] if data["exp"] > time.time() else None
    except Exception:
        return None


def _path(sub):
    return USERS_DIR / (hashlib.sha256(sub.encode()).hexdigest()[:32] + ".json")


def _load(sub):
    p = _path(sub)
    if not p.exists():
        return None
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except Exception:
        return None


def _save(sub, record):
    USERS_DIR.mkdir(parents=True, exist_ok=True)
    p = _path(sub)
    tmp = p.with_suffix(".tmp")
    with _lock:
        tmp.write_text(json.dumps(record, ensure_ascii=False), encoding="utf-8")
        os.replace(tmp, p)


def _public(record):
    prof = record["profile"]
    return {
        "id": prof["sub"],
        "name": prof.get("name", ""),
        "email": prof.get("email", ""),
        "picture": prof.get("picture", ""),
        "is_admin": prof.get("email", "").lower() in _admin_emails(),
    }


def _current():
    """The signed-in user's record from the Authorization header, or None."""
    header = request.headers.get("Authorization", "")
    if not header.startswith("Bearer "):
        return None
    sub = read_token(header[7:])
    return _load(sub) if sub else None


def register(app):
    @app.get("/auth/config")
    def auth_config():
        return jsonify({"google": bool(_client_id())})

    @app.post("/auth/google")
    def auth_google():
        client_id = _client_id()
        if not client_id:
            return jsonify({"error": "Google sign-in isn't set up on the server."}), 503
        credential = (request.get_json(silent=True) or {}).get("credential", "")
        if not credential:
            return jsonify({"error": "Missing Google credential."}), 400
        try:
            from google.auth.transport import requests as grequests
            from google.oauth2 import id_token

            info = id_token.verify_oauth2_token(
                credential, grequests.Request(), client_id, clock_skew_in_seconds=10
            )
        except Exception as exc:
            return jsonify({"error": f"Google sign-in could not be verified: {exc}"}), 401
        sub = info["sub"]
        now = int(time.time())
        record = _load(sub) or {"profile": {"sub": sub, "created": now}, "data": {}}
        record["profile"].update(
            email=info.get("email", ""),
            name=info.get("name", ""),
            picture=info.get("picture", ""),
            last_login=now,
        )
        _save(sub, record)
        return jsonify({"token": make_token(sub), "user": _public(record)})

    @app.get("/auth/me")
    def auth_me():
        record = _current()
        if not record:
            return jsonify({"error": "Not signed in."}), 401
        return jsonify({"user": _public(record)})

    @app.get("/user/data")
    def user_data_get():
        record = _current()
        if not record:
            return jsonify({"error": "Not signed in."}), 401
        return jsonify({"data": record.get("data", {})})

    @app.put("/user/data")
    def user_data_put():
        record = _current()
        if not record:
            return jsonify({"error": "Not signed in."}), 401
        if request.content_length and request.content_length > MAX_DATA_BYTES:
            return jsonify({"error": "Data is too large."}), 413
        data = request.get_json(silent=True)
        if not isinstance(data, dict):
            return jsonify({"error": "Expected a JSON object."}), 400
        record["data"] = data
        _save(record["profile"]["sub"], record)
        return jsonify({"ok": True})

    @app.delete("/user")
    def user_delete():
        record = _current()
        if not record:
            return jsonify({"error": "Not signed in."}), 401
        try:
            _path(record["profile"]["sub"]).unlink()
        except FileNotFoundError:
            pass
        return jsonify({"ok": True})