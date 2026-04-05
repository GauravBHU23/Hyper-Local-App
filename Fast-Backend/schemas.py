from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator

from models import BookingStatus, ServiceCategory, SupportTicketStatus


# ─── Auth / User Schemas ──────────────────────────────────────────────────────

class UserCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    phone: Optional[str] = None
    password: str = Field(..., min_length=8)
    preferred_language: str = "hi"

class UserLogin(BaseModel):
    email: EmailStr
    password: str


class EmailOTPRequest(BaseModel):
    email: EmailStr


class EmailOTPVerify(BaseModel):
    email: EmailStr
    otp: str = Field(..., min_length=4, max_length=6)

class UserResponse(BaseModel):
    id: UUID
    name: str
    email: str
    phone: Optional[str]
    is_provider: bool
    is_admin: bool = False
    preferred_language: str
    profile_image: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


# ─── Service Provider Schemas ─────────────────────────────────────────────────

class WorkingHours(BaseModel):
    open: str  # "09:00"
    close: str  # "18:00"

class ServiceProviderCreate(BaseModel):
    business_name: str = Field(..., min_length=2, max_length=200)
    description: Optional[str] = Field(None, max_length=2000)
    category: ServiceCategory
    tags: List[str] = Field(default_factory=list)
    latitude: Optional[float] = Field(None, ge=-90, le=90)
    longitude: Optional[float] = Field(None, ge=-180, le=180)
    address: str = Field(..., min_length=5, max_length=500)
    city: str = Field(..., min_length=2, max_length=100)
    pincode: Optional[str] = None
    is_available_24x7: bool = False
    working_hours: Optional[Dict[str, Any]] = Field(default_factory=dict)
    base_price: Optional[float] = Field(None, ge=0)
    price_unit: str = "per visit"
    phone: Optional[str] = None
    whatsapp: Optional[str] = None

    @field_validator("business_name", "address", "city", mode="before")
    @classmethod
    def strip_required_strings(cls, value: Optional[str]) -> Optional[str]:
        if isinstance(value, str):
            return value.strip()
        return value

    @field_validator("description", mode="before")
    @classmethod
    def strip_description(cls, value: Optional[str]) -> Optional[str]:
        if isinstance(value, str):
            value = value.strip()
            return value or None
        return value

    @field_validator("tags", mode="before")
    @classmethod
    def normalize_tags(cls, value: Optional[List[str]]) -> List[str]:
        if not value:
            return []
        cleaned: List[str] = []
        seen = set()
        for item in value:
            tag = str(item).strip().lower()
            if tag and tag not in seen:
                seen.add(tag)
                cleaned.append(tag)
        return cleaned[:12]

    @model_validator(mode="after")
    def validate_coordinates_pair(self):
        if (self.latitude is None) != (self.longitude is None):
            raise ValueError("Latitude and longitude must be provided together")
        return self


class ServiceProviderUpdate(BaseModel):
    business_name: Optional[str] = Field(None, min_length=2, max_length=200)
    description: Optional[str] = Field(None, max_length=2000)
    tags: Optional[List[str]] = None
    latitude: Optional[float] = Field(None, ge=-90, le=90)
    longitude: Optional[float] = Field(None, ge=-180, le=180)
    address: Optional[str] = Field(None, min_length=5, max_length=500)
    city: Optional[str] = Field(None, min_length=2, max_length=100)
    pincode: Optional[str] = None
    is_currently_available: Optional[bool] = None
    working_hours: Optional[Dict[str, Any]] = None
    base_price: Optional[float] = Field(None, ge=0)
    price_unit: Optional[str] = Field(None, min_length=2, max_length=50)
    phone: Optional[str] = None
    whatsapp: Optional[str] = None

    @field_validator("business_name", "address", "city", "price_unit", mode="before")
    @classmethod
    def strip_optional_strings(cls, value: Optional[str]) -> Optional[str]:
        if isinstance(value, str):
            value = value.strip()
            return value or None
        return value

    @field_validator("description", mode="before")
    @classmethod
    def strip_optional_description(cls, value: Optional[str]) -> Optional[str]:
        if isinstance(value, str):
            value = value.strip()
            return value or None
        return value

    @field_validator("tags", mode="before")
    @classmethod
    def normalize_optional_tags(cls, value: Optional[List[str]]) -> Optional[List[str]]:
        if value is None:
            return None
        return ServiceProviderCreate.normalize_tags(value)

    @model_validator(mode="after")
    def validate_optional_coordinates_pair(self):
        if (self.latitude is None) != (self.longitude is None):
            raise ValueError("Latitude and longitude must be provided together")
        return self


class ProviderLocationUpdate(BaseModel):
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)

class ServiceProviderResponse(BaseModel):
    id: UUID
    business_name: str
    description: Optional[str]
    category: ServiceCategory
    tags: List[str]
    latitude: float
    longitude: float
    address: str
    city: str
    pincode: Optional[str]
    is_available_24x7: bool
    working_hours: Optional[Dict[str, Any]]
    is_currently_available: bool
    base_price: Optional[float]
    price_unit: str
    rating: float
    total_reviews: int
    total_bookings: int
    response_time_minutes: int
    is_verified: bool
    phone: Optional[str]
    whatsapp: Optional[str]
    images: List[str]
    distance_km: Optional[float] = None  # computed at query time
    created_at: datetime

    class Config:
        from_attributes = True


# ─── Search / Nearby Schemas ──────────────────────────────────────────────────

class NearbySearchRequest(BaseModel):
    latitude: float
    longitude: float
    radius_km: float = 10.0
    category: Optional[ServiceCategory] = None
    query: Optional[str] = None
    available_now: bool = False
    min_rating: float = 0.0
    max_price: Optional[float] = None
    limit: int = 20
    offset: int = 0


class GeocodeResult(BaseModel):
    formatted_address: str
    latitude: float
    longitude: float
    place_id: Optional[str] = None


class PlaceSuggestion(BaseModel):
    place_id: str
    text: str


# ─── Booking Schemas ──────────────────────────────────────────────────────────

class BookingCreate(BaseModel):
    provider_id: UUID
    problem_description: str = Field(..., min_length=8, max_length=500)
    scheduled_at: Optional[datetime] = None
    service_address: Optional[str] = Field(None, max_length=500)
    service_latitude: Optional[float] = None
    service_longitude: Optional[float] = None
    notes: Optional[str] = Field(None, max_length=1000)
    ai_suggested: bool = False

    @field_validator("problem_description", "service_address", "notes", mode="before")
    @classmethod
    def strip_booking_strings(cls, value: Optional[str]) -> Optional[str]:
        if isinstance(value, str):
            value = value.strip()
            return value or None
        return value

    @model_validator(mode="after")
    def validate_scheduling_and_location(self):
        if self.scheduled_at:
            scheduled_at = self.scheduled_at
            if scheduled_at.tzinfo is None:
                scheduled_at = scheduled_at.replace(tzinfo=timezone.utc)
            if scheduled_at <= datetime.now(timezone.utc):
                raise ValueError("Scheduled time must be in the future")
        if (self.service_latitude is None) != (self.service_longitude is None):
            raise ValueError("Both service latitude and longitude are required together")
        return self

class BookingResponse(BaseModel):
    id: UUID
    user_id: UUID
    provider_id: UUID
    problem_description: str
    status: BookingStatus
    scheduled_at: Optional[datetime]
    service_address: Optional[str]
    service_latitude: Optional[float] = None
    service_longitude: Optional[float] = None
    estimated_cost: Optional[float]
    final_cost: Optional[float]
    notes: Optional[str]
    ai_suggested: bool
    has_review: bool = False
    created_at: datetime
    user: Optional[UserResponse] = None
    provider: Optional[ServiceProviderResponse] = None

    class Config:
        from_attributes = True


class CustomerBookingResponse(BookingResponse):
    service_otp: Optional[str] = None

class BookingUpdate(BaseModel):
    status: Optional[BookingStatus] = None
    scheduled_at: Optional[datetime] = None
    final_cost: Optional[float] = Field(None, ge=0)
    notes: Optional[str] = Field(None, max_length=1000)

    @field_validator("notes", mode="before")
    @classmethod
    def strip_update_notes(cls, value: Optional[str]) -> Optional[str]:
        if isinstance(value, str):
            value = value.strip()
            return value or None
        return value


class BookingOTPVerify(BaseModel):
    otp: str = Field(..., min_length=4, max_length=6)

    @field_validator("otp", mode="before")
    @classmethod
    def strip_otp(cls, value: Optional[str]) -> Optional[str]:
        if isinstance(value, str):
            value = value.strip()
            return value or None
        return value


# ─── Review Schemas ───────────────────────────────────────────────────────────

class ReviewCreate(BaseModel):
    provider_id: UUID
    booking_id: UUID
    rating: int = Field(..., ge=1, le=5)
    comment: Optional[str] = None

class ReviewResponse(BaseModel):
    id: UUID
    user_id: UUID
    provider_id: UUID
    rating: int
    comment: Optional[str]
    is_verified_purchase: bool
    is_flagged: bool
    created_at: datetime
    user: Optional[UserResponse] = None

    class Config:
        from_attributes = True


# ─── AI Chat Schemas ──────────────────────────────────────────────────────────

class ChatMessage(BaseModel):
    message: str
    session_token: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    language: str = "hi"

class ChatResponse(BaseModel):
    reply: str
    session_token: str
    detected_problem: Optional[str] = None
    suggested_category: Optional[str] = None
    suggested_services: Optional[List[ServiceProviderResponse]] = None
    estimated_cost_range: Optional[Dict[str, float]] = None
    best_time_to_book: Optional[str] = None


# ─── Common Schemas ───────────────────────────────────────────────────────────

class PaginatedResponse(BaseModel):
    data: List[Any]
    total: int
    limit: int
    offset: int
    has_more: bool

class MessageResponse(BaseModel):
    message: str
    success: bool = True


class AdminOverviewResponse(BaseModel):
    total_users: int
    total_providers: int
    total_bookings: int
    pending_bookings: int
    completed_bookings: int
    flagged_reviews: int
    pending_kyc_assets: int = 0


class ProviderEarningsStats(BaseModel):
    total_jobs: int
    pending_jobs: int
    completed_jobs: int
    total_revenue: float
    average_ticket_size: float


class AdminProviderModerationUpdate(BaseModel):
    is_verified: Optional[bool] = None
    is_currently_available: Optional[bool] = None
    user_active: Optional[bool] = None


class AdminReviewModerationUpdate(BaseModel):
    is_flagged: bool


class PaymentCreate(BaseModel):
    method: str = "online"


class PaymentConfirmRequest(BaseModel):
    gateway_payment_id: Optional[str] = None
    gateway_signature: Optional[str] = None


class PaymentResponse(BaseModel):
    id: UUID
    booking_id: UUID
    user_id: UUID
    provider_id: UUID
    method: str
    status: str
    amount: float
    gateway_reference: Optional[str] = None
    gateway_name: Optional[str] = None
    gateway_order_id: Optional[str] = None
    gateway_key_id: Optional[str] = None
    requires_confirmation: bool = False
    gateway_status_message: Optional[str] = None
    payment_instructions: Optional[str] = None
    upi_id: Optional[str] = None
    upi_name: Optional[str] = None
    upi_link: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class PaymentInvoiceResponse(BaseModel):
    payment: PaymentResponse
    booking: BookingResponse
    customer: UserResponse
    provider: ServiceProviderResponse
    invoice_number: str
    issued_at: datetime


class NotificationResponse(BaseModel):
    id: UUID
    type: str
    title: str
    message: str
    action_url: Optional[str] = None
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True


class MediaAssetResponse(BaseModel):
    id: UUID
    asset_type: str
    file_url: str
    original_name: str
    is_verified: bool
    created_at: datetime
    user: Optional[UserResponse] = None
    provider: Optional[ServiceProviderResponse] = None

    class Config:
        from_attributes = True


class AdminMediaAssetModerationUpdate(BaseModel):
    is_verified: bool


class SupportTicketCreate(BaseModel):
    booking_id: UUID
    title: str = Field(..., min_length=4, max_length=255)
    message: str = Field(..., min_length=8, max_length=2000)

    @field_validator("title", "message", mode="before")
    @classmethod
    def strip_support_strings(cls, value: Optional[str]) -> Optional[str]:
        if isinstance(value, str):
            value = value.strip()
            return value or None
        return value


class SupportTicketUpdate(BaseModel):
    status: Optional[SupportTicketStatus] = None
    admin_notes: Optional[str] = Field(None, max_length=2000)

    @field_validator("admin_notes", mode="before")
    @classmethod
    def strip_admin_notes(cls, value: Optional[str]) -> Optional[str]:
        if isinstance(value, str):
            value = value.strip()
            return value or None
        return value


class SupportTicketResponse(BaseModel):
    id: UUID
    booking_id: UUID
    user_id: UUID
    provider_id: UUID
    title: str
    message: str
    status: SupportTicketStatus
    admin_notes: Optional[str] = None
    created_at: datetime
    booking: Optional[BookingResponse] = None
    user: Optional[UserResponse] = None
    provider: Optional[ServiceProviderResponse] = None

    class Config:
        from_attributes = True


class AuditLogResponse(BaseModel):
    id: UUID
    action: str
    entity_type: str
    entity_id: Optional[str] = None
    details: Dict[str, Any] = Field(default_factory=dict)
    created_at: datetime
    user: Optional[UserResponse] = None

    class Config:
        from_attributes = True
