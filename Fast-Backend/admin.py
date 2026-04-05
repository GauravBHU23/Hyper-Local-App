from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

import models
import schemas
from auth import get_admin_user
from audit_service import create_audit_log
from database import get_db
from notification_service import create_notification

router = APIRouter()


@router.get("/overview", response_model=schemas.AdminOverviewResponse)
def get_admin_overview(
    db: Session = Depends(get_db),
    _: models.User = Depends(get_admin_user),
):
    total_users = db.query(func.count(models.User.id)).scalar() or 0
    total_providers = db.query(func.count(models.ServiceProvider.id)).scalar() or 0
    total_bookings = db.query(func.count(models.Booking.id)).scalar() or 0
    pending_bookings = (
        db.query(func.count(models.Booking.id))
        .filter(models.Booking.status == models.BookingStatus.PENDING)
        .scalar()
        or 0
    )
    completed_bookings = (
        db.query(func.count(models.Booking.id))
        .filter(models.Booking.status == models.BookingStatus.COMPLETED)
        .scalar()
        or 0
    )
    flagged_reviews = (
        db.query(func.count(models.Review.id))
        .filter(models.Review.is_flagged == True)
        .scalar()
        or 0
    )
    pending_kyc_assets = (
        db.query(func.count(models.MediaAsset.id))
        .filter(models.MediaAsset.asset_type == models.MediaAssetType.KYC_DOCUMENT)
        .filter(models.MediaAsset.is_verified == False)
        .scalar()
        or 0
    )
    return schemas.AdminOverviewResponse(
        total_users=total_users,
        total_providers=total_providers,
        total_bookings=total_bookings,
        pending_bookings=pending_bookings,
        completed_bookings=completed_bookings,
        flagged_reviews=flagged_reviews,
        pending_kyc_assets=pending_kyc_assets,
    )


@router.get("/users", response_model=list[schemas.UserResponse])
def get_admin_users(
    limit: int = Query(100, le=200),
    offset: int = 0,
    db: Session = Depends(get_db),
    _: models.User = Depends(get_admin_user),
):
    return (
        db.query(models.User)
        .order_by(models.User.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )


@router.get("/providers", response_model=list[schemas.ServiceProviderResponse])
def get_admin_providers(
    limit: int = Query(100, le=200),
    offset: int = 0,
    db: Session = Depends(get_db),
    _: models.User = Depends(get_admin_user),
):
    return (
        db.query(models.ServiceProvider)
        .order_by(models.ServiceProvider.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )


@router.get("/reviews", response_model=list[schemas.ReviewResponse])
def get_admin_reviews(
    flagged_only: bool = False,
    limit: int = Query(100, le=200),
    offset: int = 0,
    db: Session = Depends(get_db),
    _: models.User = Depends(get_admin_user),
):
    query = db.query(models.Review).options(joinedload(models.Review.user))
    if flagged_only:
        query = query.filter(models.Review.is_flagged == True)
    return query.order_by(models.Review.created_at.desc()).offset(offset).limit(limit).all()


@router.put("/providers/{provider_id}", response_model=schemas.ServiceProviderResponse)
def moderate_provider(
    provider_id: str,
    update: schemas.AdminProviderModerationUpdate,
    db: Session = Depends(get_db),
    _: models.User = Depends(get_admin_user),
):
    provider = db.query(models.ServiceProvider).filter(models.ServiceProvider.id == provider_id).first()
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")

    if update.is_verified is not None:
        provider.is_verified = update.is_verified
    if update.is_currently_available is not None:
        provider.is_currently_available = update.is_currently_available
    if update.user_active is not None and provider.user:
        provider.user.is_active = update.user_active
    create_audit_log(
        db,
        action="moderate_provider",
        entity_type="service_provider",
        entity_id=str(provider.id),
        details={
            "is_verified": provider.is_verified,
            "is_currently_available": provider.is_currently_available,
            "user_active": provider.user.is_active if provider.user else None,
        },
    )

    db.commit()
    db.refresh(provider)
    return provider


@router.put("/reviews/{review_id}", response_model=schemas.ReviewResponse)
def moderate_review(
    review_id: str,
    update: schemas.AdminReviewModerationUpdate,
    db: Session = Depends(get_db),
    _: models.User = Depends(get_admin_user),
):
    review = (
        db.query(models.Review)
        .options(joinedload(models.Review.user))
        .filter(models.Review.id == review_id)
        .first()
    )
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")

    review.is_flagged = update.is_flagged
    create_audit_log(
        db,
        action="moderate_review",
        entity_type="review",
        entity_id=str(review.id),
        details={"is_flagged": review.is_flagged},
    )
    db.commit()
    db.refresh(review)
    return review


@router.get("/media-assets", response_model=list[schemas.MediaAssetResponse])
def get_admin_media_assets(
    asset_type: str | None = None,
    verified: bool | None = None,
    limit: int = Query(100, le=200),
    offset: int = 0,
    db: Session = Depends(get_db),
    _: models.User = Depends(get_admin_user),
):
    query = db.query(models.MediaAsset).options(
        joinedload(models.MediaAsset.user),
        joinedload(models.MediaAsset.provider),
    )

    if asset_type:
        try:
            query = query.filter(models.MediaAsset.asset_type == models.MediaAssetType(asset_type))
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid asset type")
    if verified is not None:
        query = query.filter(models.MediaAsset.is_verified == verified)

    return (
        query.order_by(models.MediaAsset.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )


@router.get("/audit-logs", response_model=list[schemas.AuditLogResponse])
def get_admin_audit_logs(
    limit: int = Query(100, le=200),
    offset: int = 0,
    db: Session = Depends(get_db),
    _: models.User = Depends(get_admin_user),
):
    return (
        db.query(models.AuditLog)
        .options(joinedload(models.AuditLog.user))
        .order_by(models.AuditLog.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )


@router.put("/media-assets/{asset_id}", response_model=schemas.MediaAssetResponse)
def moderate_media_asset(
    asset_id: str,
    update: schemas.AdminMediaAssetModerationUpdate,
    db: Session = Depends(get_db),
    _: models.User = Depends(get_admin_user),
):
    asset = (
        db.query(models.MediaAsset)
        .options(joinedload(models.MediaAsset.user), joinedload(models.MediaAsset.provider))
        .filter(models.MediaAsset.id == asset_id)
        .first()
    )
    if not asset:
        raise HTTPException(status_code=404, detail="Media asset not found")

    asset.is_verified = update.is_verified
    if asset.asset_type == models.MediaAssetType.KYC_DOCUMENT and asset.provider:
        asset.provider.aadhaar_verified = update.is_verified
    create_audit_log(
        db,
        action="moderate_media_asset",
        entity_type="media_asset",
        entity_id=str(asset.id),
        details={"is_verified": update.is_verified, "asset_type": asset.asset_type.value},
    )
    create_notification(
        db,
        user_id=asset.user_id,
        title="KYC document reviewed",
        message=(
            "Your KYC document has been approved."
            if update.is_verified
            else "Your KYC document review was reset. Please re-upload if needed."
        ),
        notification_type=models.NotificationType.SYSTEM,
        action_url="/profile",
    )

    db.commit()
    db.refresh(asset)
    return asset
