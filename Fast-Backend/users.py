from datetime import datetime, timedelta, timezone
import random

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from database import get_db
import models, schemas
from auth import hash_password, verify_password, create_access_token, get_current_user
from config import settings
from email_service import send_otp_email

router = APIRouter()


def generate_email_otp() -> str:
    return f"{random.randint(0, 999999):06d}"


@router.post("/register", response_model=schemas.Token, status_code=201)
def register(user_data: schemas.UserCreate, db: Session = Depends(get_db)):
    # Check existing email
    if db.query(models.User).filter(models.User.email == user_data.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    
    if user_data.phone and db.query(models.User).filter(models.User.phone == user_data.phone).first():
        raise HTTPException(status_code=400, detail="Phone already registered")

    user = models.User(
        name=user_data.name,
        email=user_data.email,
        phone=user_data.phone,
        hashed_password=hash_password(user_data.password),
        preferred_language=user_data.preferred_language,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token({"sub": str(user.id)})
    return schemas.Token(access_token=token, user=user)


@router.post("/login", response_model=schemas.Token)
def login(credentials: schemas.UserLogin, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == credentials.email).first()
    if not user or not verify_password(credentials.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is deactivated")

    token = create_access_token({"sub": str(user.id)})
    return schemas.Token(access_token=token, user=user)


@router.post("/login/request-otp", response_model=schemas.MessageResponse)
def request_login_otp(payload: schemas.EmailOTPRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == payload.email).first()
    if not user:
        raise HTTPException(status_code=404, detail="No account found for this email")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is deactivated")

    db.query(models.EmailOTP).filter(
        models.EmailOTP.email == payload.email,
        models.EmailOTP.purpose == models.OtpPurpose.LOGIN,
        models.EmailOTP.is_used == False,
    ).update({"is_used": True})

    otp_code = generate_email_otp()
    otp = models.EmailOTP(
        user_id=user.id,
        email=user.email,
        purpose=models.OtpPurpose.LOGIN,
        code=otp_code,
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=settings.EMAIL_OTP_EXPIRE_MINUTES),
    )
    db.add(otp)
    db.commit()
    send_otp_email(user.email, otp_code, "login")
    return schemas.MessageResponse(message="OTP sent to your email")


@router.post("/login/verify-otp", response_model=schemas.Token)
def verify_login_otp(payload: schemas.EmailOTPVerify, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == payload.email).first()
    if not user:
        raise HTTPException(status_code=404, detail="No account found for this email")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is deactivated")

    otp = (
        db.query(models.EmailOTP)
        .filter(
            models.EmailOTP.email == payload.email,
            models.EmailOTP.purpose == models.OtpPurpose.LOGIN,
            models.EmailOTP.code == payload.otp.strip(),
            models.EmailOTP.is_used == False,
        )
        .order_by(models.EmailOTP.created_at.desc())
        .first()
    )
    if not otp:
        raise HTTPException(status_code=400, detail="Invalid OTP")
    if otp.expires_at <= datetime.now(timezone.utc):
        otp.is_used = True
        db.commit()
        raise HTTPException(status_code=400, detail="OTP expired")

    otp.is_used = True
    db.commit()

    token = create_access_token({"sub": str(user.id)})
    return schemas.Token(access_token=token, user=user)


@router.get("/me", response_model=schemas.UserResponse)
def get_me(current_user: models.User = Depends(get_current_user)):
    return current_user


@router.put("/me", response_model=schemas.UserResponse)
def update_profile(
    update_data: dict,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    allowed = {"name", "phone", "preferred_language", "profile_image"}
    next_phone = update_data.get("phone")
    if isinstance(next_phone, str):
        next_phone = next_phone.strip() or None

    if next_phone:
        existing_user = (
            db.query(models.User)
            .filter(models.User.phone == next_phone, models.User.id != current_user.id)
            .first()
        )
        if existing_user:
            raise HTTPException(status_code=400, detail="Phone already registered")

    for key, value in update_data.items():
        if key in allowed:
            if isinstance(value, str):
                value = value.strip() or None
            setattr(current_user, key, value)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Could not update profile with this phone number")
    db.refresh(current_user)
    return current_user


@router.delete("/me", response_model=schemas.MessageResponse)
def deactivate_account(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    current_user.is_active = False
    db.commit()
    return {"message": "Account deactivated successfully"}
