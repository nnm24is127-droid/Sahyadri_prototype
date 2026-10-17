from typing import Generator, Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import decode_access_token
from app.models.models import User, Farm, Order

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)

def get_current_user(
    db: Session = Depends(get_db),
    token: Optional[str] = Depends(oauth2_scheme)
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not token:
        raise credentials_exception

    payload = decode_access_token(token)
    if not payload:
        raise credentials_exception

    user_id: str = payload.get("sub")
    if not user_id:
        raise credentials_exception

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise credentials_exception
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user account"
        )
    return user

def get_current_user_flexible(
    token: Optional[str] = None,
    token_header: Optional[str] = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> User:
    effective_token = token_header or token
    return get_current_user(db=db, token=effective_token)

def require_role(required_role: str):
    def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role != required_role and current_user.role != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Operation not permitted. Requires '{required_role}' role."
            )
        return current_user
    return role_checker

require_farmer = require_role("farmer")
require_buyer = require_role("buyer")
require_admin = require_role("admin")

def verify_farm_ownership(farm_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> Farm:
    farm = db.query(Farm).filter(Farm.id == farm_id).first()
    if not farm:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Farm not found")
    if farm.farmer_id != current_user.id and current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: You do not own this farm."
        )
    return farm

def verify_order_participant(order_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> Order:
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    is_contributor = any(item.contributing_farmer_id == current_user.id for item in order.items)
    if order.buyer_id != current_user.id and order.seller_id != current_user.id and not is_contributor and current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: You are not a party to this order."
        )
    return order
