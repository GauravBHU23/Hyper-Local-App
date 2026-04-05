from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

import models
import schemas
from auth import get_admin_user, get_current_user
from audit_service import create_audit_log
from database import get_db
from notification_service import create_notification

router = APIRouter()


@router.post("/tickets", response_model=schemas.SupportTicketResponse, status_code=201)
def create_support_ticket(
    payload: schemas.SupportTicketCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    booking = (
        db.query(models.Booking)
        .options(joinedload(models.Booking.provider), joinedload(models.Booking.user))
        .filter(models.Booking.id == payload.booking_id)
        .first()
    )
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    provider = booking.provider
    provider_user_id = provider.user_id if provider else None
    if current_user.id not in {booking.user_id, provider_user_id} and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="You cannot raise support for this booking")

    ticket = models.SupportTicket(
        booking_id=booking.id,
        user_id=current_user.id,
        provider_id=booking.provider_id,
        title=payload.title,
        message=payload.message,
    )
    db.add(ticket)
    create_audit_log(
        db,
        action="create_support_ticket",
        entity_type="support_ticket",
        user_id=current_user.id,
        details={"booking_id": str(booking.id), "title": payload.title},
    )

    if booking.user_id != current_user.id:
        create_notification(
            db,
            user_id=booking.user_id,
            title="Support ticket created",
            message=f"A support request was opened for booking: {payload.title}",
            notification_type=models.NotificationType.SYSTEM,
            action_url="/bookings",
        )
    if provider and provider.user_id != current_user.id:
        create_notification(
            db,
            user_id=provider.user_id,
            title="Support ticket created",
            message=f"A support request was opened for booking: {payload.title}",
            notification_type=models.NotificationType.SYSTEM,
            action_url="/provider",
        )

    db.commit()
    db.refresh(ticket)
    return (
        db.query(models.SupportTicket)
        .options(
            joinedload(models.SupportTicket.booking).joinedload(models.Booking.provider),
            joinedload(models.SupportTicket.booking).joinedload(models.Booking.user),
            joinedload(models.SupportTicket.user),
            joinedload(models.SupportTicket.provider),
        )
        .filter(models.SupportTicket.id == ticket.id)
        .first()
    )


@router.get("/my", response_model=list[schemas.SupportTicketResponse])
def get_my_support_tickets(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    return (
        db.query(models.SupportTicket)
        .options(
            joinedload(models.SupportTicket.booking).joinedload(models.Booking.provider),
            joinedload(models.SupportTicket.booking).joinedload(models.Booking.user),
            joinedload(models.SupportTicket.user),
            joinedload(models.SupportTicket.provider),
        )
        .filter(models.SupportTicket.user_id == current_user.id)
        .order_by(models.SupportTicket.created_at.desc())
        .all()
    )


@router.get("/admin/all", response_model=list[schemas.SupportTicketResponse])
def get_all_support_tickets(
    db: Session = Depends(get_db),
    _: models.User = Depends(get_admin_user),
):
    return (
        db.query(models.SupportTicket)
        .options(
            joinedload(models.SupportTicket.booking).joinedload(models.Booking.provider),
            joinedload(models.SupportTicket.booking).joinedload(models.Booking.user),
            joinedload(models.SupportTicket.user),
            joinedload(models.SupportTicket.provider),
        )
        .order_by(models.SupportTicket.created_at.desc())
        .all()
    )


@router.put("/admin/{ticket_id}", response_model=schemas.SupportTicketResponse)
def update_support_ticket(
    ticket_id: str,
    payload: schemas.SupportTicketUpdate,
    db: Session = Depends(get_db),
    _: models.User = Depends(get_admin_user),
):
    ticket = (
        db.query(models.SupportTicket)
        .options(
            joinedload(models.SupportTicket.booking).joinedload(models.Booking.provider),
            joinedload(models.SupportTicket.booking).joinedload(models.Booking.user),
            joinedload(models.SupportTicket.user),
            joinedload(models.SupportTicket.provider),
        )
        .filter(models.SupportTicket.id == ticket_id)
        .first()
    )
    if not ticket:
        raise HTTPException(status_code=404, detail="Support ticket not found")

    if payload.status is not None:
        ticket.status = payload.status
    if payload.admin_notes is not None:
        ticket.admin_notes = payload.admin_notes
    create_audit_log(
        db,
        action="update_support_ticket",
        entity_type="support_ticket",
        entity_id=str(ticket.id),
        details={"status": ticket.status.value, "admin_notes": ticket.admin_notes},
    )

    create_notification(
        db,
        user_id=ticket.user_id,
        title="Support ticket updated",
        message=f"Your support request is now {ticket.status.value.replace('_', ' ')}",
        notification_type=models.NotificationType.SYSTEM,
        action_url="/bookings",
    )

    db.commit()
    db.refresh(ticket)
    return ticket
