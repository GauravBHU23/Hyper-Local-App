from sqlalchemy import (
    Column, String, Integer, Float, Boolean, DateTime, Text,
    ForeignKey, Enum, JSON, ARRAY
)
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid
import enum
from database import Base
from config import settings


class ServiceCategory(str, enum.Enum):
    PLUMBER = "plumber"
    ELECTRICIAN = "electrician"
    AC_REPAIR = "ac_repair"
    CARPENTER = "carpenter"
    TUTOR = "tutor"
    DOCTOR = "doctor"
    CHEMIST = "chemist"
    HOSPITAL = "hospital"
    GROCERY = "grocery"
    SALON = "salon"
    CLEANING = "cleaning"
    PEST_CONTROL = "pest_control"
    PAINTER = "painter"
    MECHANIC = "mechanic"
    OTHER = "other"


class BookingStatus(str, enum.Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class PaymentMethod(str, enum.Enum):
    COD = "cod"
    ONLINE = "online"


class PaymentStatus(str, enum.Enum):
    PENDING = "pending"
    PAID = "paid"
    FAILED = "failed"
    REFUNDED = "refunded"


class NotificationType(str, enum.Enum):
    BOOKING = "booking"
    PAYMENT = "payment"
    REVIEW = "review"
    SYSTEM = "system"


class MediaAssetType(str, enum.Enum):
    PROFILE_IMAGE = "profile_image"
    KYC_DOCUMENT = "kyc_document"
    WORK_SAMPLE = "work_sample"


class OtpPurpose(str, enum.Enum):
    LOGIN = "login"


class SupportTicketStatus(str, enum.Enum):
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    RESOLVED = "resolved"
    CLOSED = "closed"


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    phone = Column(String(20), unique=True, index=True)
    hashed_password = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True)
    is_provider = Column(Boolean, default=False)
    preferred_language = Column(String(10), default="hi")
    profile_image = Column(String(500), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    bookings = relationship("Booking", back_populates="user", foreign_keys="Booking.user_id")
    reviews = relationship("Review", back_populates="user")
    chat_sessions = relationship("ChatSession", back_populates="user")
    notifications = relationship("Notification", back_populates="user")
    payments = relationship("PaymentTransaction", back_populates="user")
    media_assets = relationship("MediaAsset", back_populates="user")
    otps = relationship("EmailOTP", back_populates="user")

    @property
    def is_admin(self) -> bool:
        return self.email.lower() in set(settings.ADMIN_EMAILS)


class ServiceProvider(Base):
    __tablename__ = "service_providers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    business_name = Column(String(200), nullable=False)
    description = Column(Text)
    category = Column(Enum(ServiceCategory), nullable=False)
    tags = Column(ARRAY(String), default=[])
    
    # Location
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    address = Column(String(500), nullable=False)
    city = Column(String(100), nullable=False)
    pincode = Column(String(10))
    
    # Availability
    is_available_24x7 = Column(Boolean, default=False)
    working_hours = Column(JSON, default={})  # {"mon": {"open": "09:00", "close": "18:00"}, ...}
    is_currently_available = Column(Boolean, default=True)
    
    # Pricing
    base_price = Column(Float)
    price_unit = Column(String(50), default="per visit")
    
    # Stats
    rating = Column(Float, default=0.0)
    total_reviews = Column(Integer, default=0)
    total_bookings = Column(Integer, default=0)
    response_time_minutes = Column(Integer, default=30)
    
    # Verification
    is_verified = Column(Boolean, default=False)
    aadhaar_verified = Column(Boolean, default=False)
    
    # Contact
    phone = Column(String(20))
    whatsapp = Column(String(20))
    
    images = Column(ARRAY(String), default=[])
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    user = relationship("User", foreign_keys=[user_id])
    bookings = relationship("Booking", back_populates="provider")
    reviews = relationship("Review", back_populates="provider")
    payments = relationship("PaymentTransaction", back_populates="provider")
    media_assets = relationship("MediaAsset", back_populates="provider")


class Booking(Base):
    __tablename__ = "bookings"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    provider_id = Column(UUID(as_uuid=True), ForeignKey("service_providers.id"), nullable=False)
    
    problem_description = Column(Text, nullable=False)
    ai_suggested = Column(Boolean, default=False)
    
    scheduled_at = Column(DateTime(timezone=True))
    status = Column(Enum(BookingStatus), default=BookingStatus.PENDING)
    
    # Location of service
    service_address = Column(String(500))
    service_latitude = Column(Float)
    service_longitude = Column(Float)
    
    estimated_cost = Column(Float)
    final_cost = Column(Float)
    
    notes = Column(Text)
    otp = Column(String(6))
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    user = relationship("User", back_populates="bookings", foreign_keys=[user_id])
    provider = relationship("ServiceProvider", back_populates="bookings")
    review = relationship("Review", back_populates="booking", uselist=False)
    payments = relationship("PaymentTransaction", back_populates="booking")

    @property
    def has_review(self) -> bool:
        return self.review is not None


class Review(Base):
    __tablename__ = "reviews"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    provider_id = Column(UUID(as_uuid=True), ForeignKey("service_providers.id"), nullable=False)
    booking_id = Column(UUID(as_uuid=True), ForeignKey("bookings.id"), unique=True)
    
    rating = Column(Integer, nullable=False)  # 1-5
    comment = Column(Text)
    
    # Fake review detection
    is_verified_purchase = Column(Boolean, default=False)
    ai_spam_score = Column(Float, default=0.0)  # 0-1, higher = more likely spam
    is_flagged = Column(Boolean, default=False)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="reviews")
    provider = relationship("ServiceProvider", back_populates="reviews")
    booking = relationship("Booking", back_populates="review")


class ChatSession(Base):
    __tablename__ = "chat_sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    session_token = Column(String(255), unique=True, index=True)
    
    messages = Column(JSON, default=[])  # [{role, content, timestamp}]
    detected_problem = Column(String(500))
    suggested_category = Column(String(100))
    language = Column(String(10), default="hi")
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    user = relationship("User", back_populates="chat_sessions")


class PaymentTransaction(Base):
    __tablename__ = "payment_transactions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    booking_id = Column(UUID(as_uuid=True), ForeignKey("bookings.id"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    provider_id = Column(UUID(as_uuid=True), ForeignKey("service_providers.id"), nullable=False)
    method = Column(Enum(PaymentMethod), default=PaymentMethod.ONLINE)
    status = Column(Enum(PaymentStatus), default=PaymentStatus.PENDING)
    amount = Column(Float, nullable=False)
    gateway_reference = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    booking = relationship("Booking", back_populates="payments")
    user = relationship("User", back_populates="payments")
    provider = relationship("ServiceProvider", back_populates="payments")


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    type = Column(Enum(NotificationType), default=NotificationType.SYSTEM)
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    action_url = Column(String(500), nullable=True)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="notifications")


class MediaAsset(Base):
    __tablename__ = "media_assets"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    provider_id = Column(UUID(as_uuid=True), ForeignKey("service_providers.id"), nullable=True)
    asset_type = Column(Enum(MediaAssetType), nullable=False)
    file_url = Column(String(1000), nullable=False)
    original_name = Column(String(255), nullable=False)
    is_verified = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="media_assets")
    provider = relationship("ServiceProvider", back_populates="media_assets")


class EmailOTP(Base):
    __tablename__ = "email_otps"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    email = Column(String(255), index=True, nullable=False)
    purpose = Column(Enum(OtpPurpose), default=OtpPurpose.LOGIN, nullable=False)
    code = Column(String(6), nullable=False)
    is_used = Column(Boolean, default=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="otps")


class SupportTicket(Base):
    __tablename__ = "support_tickets"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    booking_id = Column(UUID(as_uuid=True), ForeignKey("bookings.id"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    provider_id = Column(UUID(as_uuid=True), ForeignKey("service_providers.id"), nullable=False)
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    status = Column(Enum(SupportTicketStatus), default=SupportTicketStatus.OPEN, nullable=False)
    admin_notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    booking = relationship("Booking")
    user = relationship("User")
    provider = relationship("ServiceProvider")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    action = Column(String(120), nullable=False)
    entity_type = Column(String(120), nullable=False)
    entity_id = Column(String(120), nullable=True)
    details = Column(JSON, default={})
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User")
