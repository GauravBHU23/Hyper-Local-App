from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
import random, string
import models, schemas
from database import get_db
from auth import get_admin_user, get_current_user
from notification_service import create_notification

router = APIRouter()


def generate_otp() -> str:
    return "".join(random.choices(string.digits, k=6))


def serialize_customer_booking(booking: models.Booking) -> schemas.CustomerBookingResponse:
    payload = schemas.BookingResponse.model_validate(booking).model_dump()
    payload["service_otp"] = booking.otp
    return schemas.CustomerBookingResponse(**payload)


@router.post("", response_model=schemas.CustomerBookingResponse, status_code=201, include_in_schema=False)
@router.post("/", response_model=schemas.CustomerBookingResponse, status_code=201)
def create_booking(
    booking_data: schemas.BookingCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    provider = db.query(models.ServiceProvider).filter(
        models.ServiceProvider.id == booking_data.provider_id,
        models.ServiceProvider.is_currently_available == True,
    ).first()
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found or unavailable")
    if not booking_data.service_address and (
        booking_data.service_latitude is None or booking_data.service_longitude is None
    ):
        raise HTTPException(
            status_code=400,
            detail="Provide a service address or precise location coordinates",
        )

    booking = models.Booking(
        user_id=current_user.id,
        provider_id=booking_data.provider_id,
        problem_description=booking_data.problem_description,
        scheduled_at=booking_data.scheduled_at,
        service_address=booking_data.service_address,
        service_latitude=booking_data.service_latitude,
        service_longitude=booking_data.service_longitude,
        notes=booking_data.notes,
        ai_suggested=booking_data.ai_suggested,
        estimated_cost=provider.base_price,
        otp=generate_otp(),
    )
    db.add(booking)
    
    # Update provider stats
    provider.total_bookings += 1
    create_notification(
        db,
        user_id=current_user.id,
        title="Booking created",
        message=f"Your booking with {provider.business_name} has been created",
        notification_type=models.NotificationType.BOOKING,
        action_url="/bookings",
    )
    create_notification(
        db,
        user_id=provider.user_id,
        title="New booking request",
        message=f"You received a new booking for {booking.problem_description[:40]}",
        notification_type=models.NotificationType.BOOKING,
        action_url="/provider",
    )
    
    db.commit()
    db.refresh(booking)
    return serialize_customer_booking(booking)


@router.get("/my", response_model=List[schemas.CustomerBookingResponse])
def get_my_bookings(
    status: Optional[models.BookingStatus] = None,
    limit: int = Query(20, le=100),
    offset: int = 0,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    query = (
        db.query(models.Booking)
        .options(joinedload(models.Booking.provider), joinedload(models.Booking.user), joinedload(models.Booking.review))
        .filter(models.Booking.user_id == current_user.id)
    )
    if status:
        query = query.filter(models.Booking.status == status)
    
    bookings = query.order_by(models.Booking.created_at.desc()).offset(offset).limit(limit).all()
    return [serialize_customer_booking(booking) for booking in bookings]


@router.get("/{booking_id}", response_model=schemas.CustomerBookingResponse)
def get_booking(
    booking_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    booking = (
        db.query(models.Booking)
        .options(joinedload(models.Booking.provider), joinedload(models.Booking.user), joinedload(models.Booking.review))
        .filter(
            models.Booking.id == booking_id,
            models.Booking.user_id == current_user.id,
        )
        .first()
    )
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    return serialize_customer_booking(booking)


@router.put("/{booking_id}", response_model=schemas.CustomerBookingResponse)
def update_booking(
    booking_id: str,
    update_data: schemas.BookingUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    booking = (
        db.query(models.Booking)
        .options(joinedload(models.Booking.provider), joinedload(models.Booking.user), joinedload(models.Booking.review))
        .filter(
            models.Booking.id == booking_id,
            models.Booking.user_id == current_user.id,
        )
        .first()
    )
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    changed_parts: list[str] = []

    if update_data.status:
        if update_data.status != models.BookingStatus.CANCELLED:
            raise HTTPException(
                status_code=400,
                detail="Customers can only cancel their own bookings",
            )
        if booking.status not in [models.BookingStatus.PENDING, models.BookingStatus.CONFIRMED]:
            raise HTTPException(
                status_code=400,
                detail="Only pending or confirmed bookings can be cancelled",
            )
        booking.status = update_data.status
        changed_parts.append("status")

    if update_data.scheduled_at is not None:
        if booking.status not in [models.BookingStatus.PENDING, models.BookingStatus.CONFIRMED]:
            raise HTTPException(
                status_code=400,
                detail="Only pending or confirmed bookings can be rescheduled",
            )
        booking.scheduled_at = update_data.scheduled_at
        changed_parts.append("schedule")
    if update_data.notes is not None:
        booking.notes = update_data.notes
        changed_parts.append("notes")
    if update_data.final_cost is not None:
        raise HTTPException(status_code=400, detail="Customers cannot change final cost")

    message = "Your booking details were updated"
    if "status" in changed_parts:
        message = f"Your booking status is now {booking.status.value.replace('_', ' ')}"
    elif "schedule" in changed_parts:
        message = "Your booking schedule was updated"

    create_notification(
        db,
        user_id=booking.user_id,
        title="Booking updated",
        message=message,
        notification_type=models.NotificationType.BOOKING,
        action_url="/bookings",
    )
    if booking.provider:
        create_notification(
            db,
            user_id=booking.provider.user_id,
            title="Customer updated a booking",
            message=message,
            notification_type=models.NotificationType.BOOKING,
            action_url="/provider",
        )
    db.commit()
    db.refresh(booking)
    return serialize_customer_booking(booking)


@router.delete("/{booking_id}", response_model=schemas.MessageResponse)
def cancel_booking(
    booking_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    booking = db.query(models.Booking).filter(
        models.Booking.id == booking_id,
        models.Booking.user_id == current_user.id,
        models.Booking.status == models.BookingStatus.PENDING,
    ).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found or cannot be cancelled")
    
    booking.status = models.BookingStatus.CANCELLED
    create_notification(
        db,
        user_id=current_user.id,
        title="Booking cancelled",
        message="Your booking has been cancelled successfully",
        notification_type=models.NotificationType.BOOKING,
        action_url="/bookings",
    )
    db.commit()
    return {"message": "Booking cancelled successfully"}


@router.get("/provider/my", response_model=List[schemas.BookingResponse])
def get_provider_bookings(
    status: Optional[models.BookingStatus] = None,
    limit: int = Query(50, le=100),
    offset: int = 0,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    provider = db.query(models.ServiceProvider).filter(
        models.ServiceProvider.user_id == current_user.id
    ).first()
    if not provider:
        raise HTTPException(status_code=404, detail="Provider profile not found")

    query = (
        db.query(models.Booking)
        .options(joinedload(models.Booking.provider), joinedload(models.Booking.user), joinedload(models.Booking.review))
        .filter(models.Booking.provider_id == provider.id)
    )
    if status:
        query = query.filter(models.Booking.status == status)
    return query.order_by(models.Booking.created_at.desc()).offset(offset).limit(limit).all()


@router.put("/provider/{booking_id}", response_model=schemas.BookingResponse)
def update_provider_booking(
    booking_id: str,
    update_data: schemas.BookingUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    provider = db.query(models.ServiceProvider).filter(
        models.ServiceProvider.user_id == current_user.id
    ).first()
    if not provider:
        raise HTTPException(status_code=404, detail="Provider profile not found")

    booking = (
        db.query(models.Booking)
        .options(joinedload(models.Booking.provider), joinedload(models.Booking.user), joinedload(models.Booking.review))
        .filter(
            models.Booking.id == booking_id,
            models.Booking.provider_id == provider.id,
        )
        .first()
    )
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    if update_data.status:
        valid_transitions = {
            models.BookingStatus.PENDING: [models.BookingStatus.CONFIRMED, models.BookingStatus.CANCELLED],
            models.BookingStatus.CONFIRMED: [models.BookingStatus.IN_PROGRESS, models.BookingStatus.CANCELLED],
        }
        allowed = valid_transitions.get(booking.status, [])
        if update_data.status not in allowed:
            raise HTTPException(status_code=400, detail="Invalid provider status transition")
        booking.status = update_data.status

    if update_data.scheduled_at is not None:
        booking.scheduled_at = update_data.scheduled_at
    if update_data.notes is not None:
        booking.notes = update_data.notes
    if update_data.final_cost is not None:
        booking.final_cost = update_data.final_cost

    create_notification(
        db,
        user_id=booking.user_id,
        title="Provider updated your booking",
        message=f"Booking is now {booking.status.value.replace('_', ' ')}",
        notification_type=models.NotificationType.BOOKING,
        action_url="/bookings",
    )
    db.commit()
    db.refresh(booking)
    return booking


@router.post("/provider/{booking_id}/complete", response_model=schemas.BookingResponse)
def complete_provider_booking(
    booking_id: str,
    payload: schemas.BookingOTPVerify,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    provider = db.query(models.ServiceProvider).filter(
        models.ServiceProvider.user_id == current_user.id
    ).first()
    if not provider:
        raise HTTPException(status_code=404, detail="Provider profile not found")

    booking = (
        db.query(models.Booking)
        .options(joinedload(models.Booking.provider), joinedload(models.Booking.user), joinedload(models.Booking.review))
        .filter(
            models.Booking.id == booking_id,
            models.Booking.provider_id == provider.id,
        )
        .first()
    )
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking.status != models.BookingStatus.IN_PROGRESS:
        raise HTTPException(
            status_code=400,
            detail="Only in-progress bookings can be completed with OTP",
        )
    if booking.otp != payload.otp:
        raise HTTPException(status_code=400, detail="Invalid service OTP")

    booking.status = models.BookingStatus.COMPLETED
    create_notification(
        db,
        user_id=booking.user_id,
        title="Booking completed",
        message="Your provider completed the job successfully",
        notification_type=models.NotificationType.BOOKING,
        action_url="/bookings",
    )
    if booking.provider:
        create_notification(
            db,
            user_id=booking.provider.user_id,
            title="Job marked complete",
            message=f"Booking for {booking.user.name if booking.user else 'customer'} was completed",
            notification_type=models.NotificationType.BOOKING,
            action_url="/provider",
        )

    db.commit()
    db.refresh(booking)
    return booking


@router.get("/admin/all", response_model=List[schemas.BookingResponse])
def get_all_bookings(
    status: Optional[models.BookingStatus] = None,
    limit: int = Query(100, le=200),
    offset: int = 0,
    db: Session = Depends(get_db),
    _: models.User = Depends(get_admin_user),
):
    query = (
        db.query(models.Booking)
        .options(joinedload(models.Booking.provider), joinedload(models.Booking.user), joinedload(models.Booking.review))
    )
    if status:
        query = query.filter(models.Booking.status == status)
    return query.order_by(models.Booking.created_at.desc()).offset(offset).limit(limit).all()


@router.put("/admin/{booking_id}", response_model=schemas.BookingResponse)
def update_admin_booking(
    booking_id: str,
    update_data: schemas.BookingUpdate,
    db: Session = Depends(get_db),
    _: models.User = Depends(get_admin_user),
):
    booking = (
        db.query(models.Booking)
        .options(joinedload(models.Booking.provider), joinedload(models.Booking.user))
        .filter(models.Booking.id == booking_id)
        .first()
    )
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    if update_data.status is not None:
        booking.status = update_data.status
    if update_data.scheduled_at is not None:
        booking.scheduled_at = update_data.scheduled_at
    if update_data.notes is not None:
        booking.notes = update_data.notes
    if update_data.final_cost is not None:
        booking.final_cost = update_data.final_cost

    db.commit()
    db.refresh(booking)
    return booking


@router.get("/provider/stats", response_model=schemas.ProviderEarningsStats)
def get_provider_stats(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    provider = db.query(models.ServiceProvider).filter(
        models.ServiceProvider.user_id == current_user.id
    ).first()
    if not provider:
        raise HTTPException(status_code=404, detail="Provider profile not found")

    total_jobs = (
        db.query(func.count(models.Booking.id))
        .filter(models.Booking.provider_id == provider.id)
        .scalar()
        or 0
    )
    pending_jobs = (
        db.query(func.count(models.Booking.id))
        .filter(
            models.Booking.provider_id == provider.id,
            models.Booking.status.in_([models.BookingStatus.PENDING, models.BookingStatus.CONFIRMED, models.BookingStatus.IN_PROGRESS]),
        )
        .scalar()
        or 0
    )
    completed_jobs = (
        db.query(func.count(models.Booking.id))
        .filter(
            models.Booking.provider_id == provider.id,
            models.Booking.status == models.BookingStatus.COMPLETED,
        )
        .scalar()
        or 0
    )
    revenue_rows = (
        db.query(models.Booking.final_cost, models.Booking.estimated_cost)
        .filter(
            models.Booking.provider_id == provider.id,
            models.Booking.status == models.BookingStatus.COMPLETED,
        )
        .all()
    )
    total_revenue = float(sum((row[0] if row[0] is not None else row[1] or 0) for row in revenue_rows))
    average_ticket_size = round(total_revenue / completed_jobs, 2) if completed_jobs else 0.0

    return schemas.ProviderEarningsStats(
        total_jobs=total_jobs,
        pending_jobs=pending_jobs,
        completed_jobs=completed_jobs,
        total_revenue=round(total_revenue, 2),
        average_ticket_size=average_ticket_size,
    )
