import base64
import hashlib
import hmac
import json
from urllib import error, request
from urllib.parse import quote
from uuid import uuid4

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from sqlalchemy.orm import Session, joinedload

import models
import schemas
from auth import get_current_user
from audit_service import create_audit_log
from config import settings
from database import get_db
from notification_service import create_notification

router = APIRouter()


def _serialize_payment(
    payment: models.PaymentTransaction,
    *,
    gateway_name: str | None = None,
    gateway_order_id: str | None = None,
    gateway_key_id: str | None = None,
    requires_confirmation: bool = False,
    gateway_status_message: str | None = None,
    payment_instructions: str | None = None,
    upi_id: str | None = None,
    upi_name: str | None = None,
    upi_link: str | None = None,
) -> schemas.PaymentResponse:
    return schemas.PaymentResponse(
        id=payment.id,
        booking_id=payment.booking_id,
        user_id=payment.user_id,
        provider_id=payment.provider_id,
        method=payment.method.value,
        status=payment.status.value,
        amount=payment.amount,
        gateway_reference=payment.gateway_reference,
        gateway_name=gateway_name,
        gateway_order_id=gateway_order_id,
        gateway_key_id=gateway_key_id,
        requires_confirmation=requires_confirmation,
        gateway_status_message=gateway_status_message,
        payment_instructions=payment_instructions,
        upi_id=upi_id,
        upi_name=upi_name,
        upi_link=upi_link,
        created_at=payment.created_at,
    )


def _create_razorpay_order(amount: float, receipt: str) -> tuple[str, str] | None:
    if not settings.RAZORPAY_KEY_ID or not settings.RAZORPAY_KEY_SECRET:
        return None

    payload = json.dumps(
        {
            "amount": max(int(round(amount * 100)), 100),
            "currency": "INR",
            "receipt": receipt,
        }
    ).encode("utf-8")
    credentials = base64.b64encode(
        f"{settings.RAZORPAY_KEY_ID}:{settings.RAZORPAY_KEY_SECRET}".encode("utf-8")
    ).decode("utf-8")
    req = request.Request(
        "https://api.razorpay.com/v1/orders",
        data=payload,
        headers={
            "Authorization": f"Basic {credentials}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with request.urlopen(req, timeout=10) as response:
            data = json.loads(response.read().decode("utf-8"))
            return data["id"], "Razorpay order created"
    except (error.URLError, error.HTTPError, KeyError, TimeoutError, json.JSONDecodeError):
        return None


def _verify_razorpay_signature(
    order_id: str,
    payment_id: str,
    signature: str,
) -> bool:
    if not settings.RAZORPAY_KEY_SECRET:
        return False

    body = f"{order_id}|{payment_id}".encode("utf-8")
    digest = hmac.new(
        settings.RAZORPAY_KEY_SECRET.encode("utf-8"),
        body,
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(digest, signature)


def _build_upi_link(amount: float, receipt: str) -> str | None:
    if not settings.UPI_PAYMENT_ID:
        return None
    note = "HyperLocal Booking Payment"
    params = {
        "pa": settings.UPI_PAYMENT_ID,
        "pn": settings.UPI_PAYMENT_NAME or "HyperLocal",
        "am": f"{amount:.2f}",
        "cu": "INR",
        "tn": note,
        "tr": receipt,
    }
    encoded = "&".join(f"{key}={quote(str(value), safe='')}" for key, value in params.items())
    return f"upi://pay?{encoded}"


@router.post("/bookings/{booking_id}/create", response_model=schemas.PaymentResponse, status_code=201)
def create_payment(
    booking_id: str,
    payload: schemas.PaymentCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    booking = (
        db.query(models.Booking)
        .filter(
            models.Booking.id == booking_id,
            models.Booking.user_id == current_user.id,
        )
        .first()
    )
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    existing = (
        db.query(models.PaymentTransaction)
        .filter(models.PaymentTransaction.booking_id == booking.id)
        .order_by(models.PaymentTransaction.created_at.desc())
        .first()
    )
    if existing and existing.status == models.PaymentStatus.PAID:
        raise HTTPException(status_code=400, detail="Booking already paid")

    manual_upi = payload.method.lower() == "manual_upi"
    if manual_upi:
        method = models.PaymentMethod.ONLINE
    else:
        method = models.PaymentMethod(payload.method.lower())
    amount = booking.final_cost or booking.estimated_cost or 0
    gateway_order_id = None
    gateway_name = None
    gateway_status_message = None
    payment_instructions = None
    upi_link = None

    if method == models.PaymentMethod.ONLINE and not manual_upi:
        gateway_result = _create_razorpay_order(amount, f"booking_{booking.id}")
        if gateway_result:
            gateway_order_id, gateway_status_message = gateway_result
            gateway_name = "razorpay"
        elif settings.UPI_PAYMENT_ID:
            upi_link = _build_upi_link(amount, f"booking_{booking.id}")
            payment_instructions = "Razorpay not available right now. Use the UPI option to pay manually."
    elif manual_upi:
        if not settings.UPI_PAYMENT_ID:
            raise HTTPException(status_code=400, detail="Manual UPI is not configured")
        upi_link = _build_upi_link(amount, f"booking_{booking.id}")
        payment_instructions = "Pay using any UPI app, then tap 'I have paid' to generate your bill."
        gateway_status_message = "Manual UPI payment created"
    elif method == models.PaymentMethod.COD:
        payment_instructions = "Pay cash directly to the provider after service completion."
        gateway_status_message = "Cash on delivery selected"

    payment = models.PaymentTransaction(
        booking_id=booking.id,
        user_id=current_user.id,
        provider_id=booking.provider_id,
        method=method,
        status=models.PaymentStatus.PENDING,
        amount=amount,
        gateway_reference=gateway_order_id or f"pay_{uuid4().hex[:10]}",
    )
    db.add(payment)
    create_notification(
        db,
        user_id=current_user.id,
        title="Payment initiated",
        message=f"Payment started for booking {booking.problem_description[:40]}",
        notification_type=models.NotificationType.PAYMENT,
        action_url="/bookings",
    )
    create_audit_log(
        db,
        action="create_payment",
        entity_type="payment",
        entity_id=str(payment.id),
        user_id=current_user.id,
        details={"booking_id": str(booking.id), "method": method.value, "amount": amount},
    )
    db.commit()
    db.refresh(payment)
    return _serialize_payment(
        payment,
        gateway_name=gateway_name,
        gateway_order_id=gateway_order_id,
        gateway_key_id=settings.RAZORPAY_KEY_ID if gateway_order_id else None,
        requires_confirmation=method == models.PaymentMethod.ONLINE and not gateway_order_id,
        gateway_status_message=gateway_status_message or (
            "Gateway not configured, using built-in confirmation flow"
            if method == models.PaymentMethod.ONLINE and not gateway_order_id
            else None
        ),
        payment_instructions=payment_instructions,
        upi_id=settings.UPI_PAYMENT_ID,
        upi_name=settings.UPI_PAYMENT_NAME,
        upi_link=upi_link,
    )


@router.post("/{payment_id}/confirm", response_model=schemas.PaymentResponse)
def confirm_payment(
    payment_id: str,
    payload: schemas.PaymentConfirmRequest | None = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    payment = (
        db.query(models.PaymentTransaction)
        .filter(
            models.PaymentTransaction.id == payment_id,
            models.PaymentTransaction.user_id == current_user.id,
        )
        .first()
    )
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    if payment.status == models.PaymentStatus.PAID:
        return _serialize_payment(payment)

    if payment.method == models.PaymentMethod.ONLINE and payload:
        if payload.gateway_payment_id and payload.gateway_signature:
            if not payment.gateway_reference:
                raise HTTPException(status_code=400, detail="Gateway order is missing")
            if not _verify_razorpay_signature(
                payment.gateway_reference,
                payload.gateway_payment_id,
                payload.gateway_signature,
            ):
                raise HTTPException(status_code=400, detail="Invalid payment signature")
            payment.gateway_reference = payload.gateway_payment_id

    payment.status = models.PaymentStatus.PAID
    create_audit_log(
        db,
        action="confirm_payment",
        entity_type="payment",
        entity_id=str(payment.id),
        user_id=current_user.id,
        details={"booking_id": str(payment.booking_id), "gateway_reference": payment.gateway_reference},
    )
    create_notification(
        db,
        user_id=current_user.id,
        title="Payment successful",
        message=f"Payment of Rs. {int(payment.amount)} completed successfully",
        notification_type=models.NotificationType.PAYMENT,
        action_url="/bookings",
    )
    provider = db.query(models.ServiceProvider).filter(models.ServiceProvider.id == payment.provider_id).first()
    if provider:
        create_notification(
            db,
            user_id=provider.user_id,
            title="Booking paid",
            message="A customer payment has been received for one of your bookings",
            notification_type=models.NotificationType.PAYMENT,
            action_url="/provider",
    )
    db.commit()
    db.refresh(payment)
    return _serialize_payment(payment)


@router.post("/webhooks/razorpay", response_model=schemas.MessageResponse)
async def razorpay_webhook(
    request: Request,
    x_razorpay_signature: str | None = Header(default=None),
    db: Session = Depends(get_db),
):
    raw_body = await request.body()
    if not settings.RAZORPAY_KEY_SECRET:
        raise HTTPException(status_code=400, detail="Razorpay webhook secret is not configured")
    if not x_razorpay_signature:
        raise HTTPException(status_code=400, detail="Missing Razorpay signature header")

    expected = hmac.new(
        settings.RAZORPAY_KEY_SECRET.encode("utf-8"),
        raw_body,
        hashlib.sha256,
    ).hexdigest()
    if not hmac.compare_digest(expected, x_razorpay_signature):
        raise HTTPException(status_code=400, detail="Invalid webhook signature")

    try:
        payload = json.loads(raw_body.decode("utf-8"))
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail="Invalid webhook payload") from exc

    event = payload.get("event", "unknown")
    payment_entity = (
        payload.get("payload", {})
        .get("payment", {})
        .get("entity", {})
    )
    gateway_payment_id = payment_entity.get("id")
    gateway_order_id = payment_entity.get("order_id")

    payment = None
    if gateway_payment_id:
        payment = (
            db.query(models.PaymentTransaction)
            .filter(models.PaymentTransaction.gateway_reference == gateway_payment_id)
            .first()
        )
    if not payment and gateway_order_id:
        payment = (
            db.query(models.PaymentTransaction)
            .filter(models.PaymentTransaction.gateway_reference == gateway_order_id)
            .first()
        )

    if payment and event == "payment.captured":
        payment.status = models.PaymentStatus.PAID
        payment.gateway_reference = gateway_payment_id or payment.gateway_reference
        create_audit_log(
            db,
            action="razorpay_webhook_captured",
            entity_type="payment",
            entity_id=str(payment.id),
            details={"event": event, "gateway_payment_id": gateway_payment_id},
        )
        create_notification(
            db,
            user_id=payment.user_id,
            title="Payment confirmed",
            message="Your online payment was confirmed by gateway webhook",
            notification_type=models.NotificationType.PAYMENT,
            action_url="/bookings",
        )
        db.commit()
    else:
        create_audit_log(
            db,
            action="razorpay_webhook_received",
            entity_type="payment",
            entity_id=str(payment.id) if payment else gateway_order_id,
            details={"event": event, "gateway_payment_id": gateway_payment_id},
        )
        db.commit()

    return schemas.MessageResponse(message="Webhook received")


@router.get("/my", response_model=list[schemas.PaymentResponse])
def get_my_payments(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    payments = (
        db.query(models.PaymentTransaction)
        .filter(models.PaymentTransaction.user_id == current_user.id)
        .order_by(models.PaymentTransaction.created_at.desc())
        .all()
    )
    return [_serialize_payment(payment) for payment in payments]


@router.get("/{payment_id}/invoice", response_model=schemas.PaymentInvoiceResponse)
def get_payment_invoice(
    payment_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    payment = (
        db.query(models.PaymentTransaction)
        .options(
            joinedload(models.PaymentTransaction.booking).joinedload(models.Booking.provider),
            joinedload(models.PaymentTransaction.booking).joinedload(models.Booking.user),
            joinedload(models.PaymentTransaction.provider),
            joinedload(models.PaymentTransaction.user),
        )
        .filter(
            models.PaymentTransaction.id == payment_id,
            models.PaymentTransaction.user_id == current_user.id,
        )
        .first()
    )
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    if payment.status != models.PaymentStatus.PAID:
        raise HTTPException(status_code=400, detail="Invoice is available only after successful payment")
    if not payment.booking or not payment.booking.provider or not payment.user or not payment.provider:
        raise HTTPException(status_code=400, detail="Invoice data is incomplete")

    invoice_number = f"INV-{str(payment.id).split('-')[0].upper()}"
    return schemas.PaymentInvoiceResponse(
        payment=_serialize_payment(payment),
        booking=schemas.BookingResponse.model_validate(payment.booking),
        customer=schemas.UserResponse.model_validate(payment.user),
        provider=schemas.ServiceProviderResponse.model_validate(payment.provider),
        invoice_number=invoice_number,
        issued_at=payment.updated_at or payment.created_at,
    )
