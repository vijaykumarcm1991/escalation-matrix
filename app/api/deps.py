from fastapi import Depends, HTTPException
from app.core.security import decode_token
from jose import JWTError
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

security = HTTPBearer()

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    try:
        payload = decode_token(token)
        return payload
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")

def require_admin(user: dict = Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

def require_service(user: dict = Depends(get_current_user)):
    if user.get("role") != "service":
        raise HTTPException(status_code=403, detail="Service access required")
    return user