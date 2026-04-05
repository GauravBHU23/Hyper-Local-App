from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from typing import List
import models, schemas
from database import get_db
from auth import get_current_user
from notification_service import create_notification

router = APIRouter()


def detect_spam_review(comment: str) -> float:
    """
    Simple heuristic spam detection (0.0 = legit, 1.0 = spam).
    In production, use AI/ML model.
    """
    if not comment:
        return 0.1
    
    spam_score = 0.0
    comment_lower = comment.lower()
    
    # Very short reviews
    if len(comment) < 10:
        spam_score += 0.3
    
    # Repetitive characters
    for char in "!?.":
        if comment.count(char) > 5:
            spam_score += 0.2
    
    # All caps
    if comment == comment.upper() and len(comment) > 5:
        spam_score += 0.2
    
    # Generic spam phrases
    spam_phrases = ["best ever", "100% recommend", "5 stars", "amazing amazing"]
    for phrase in spam_phrases:
        if phrase in comment_lower:
            spam_score += 0.1
    
    return min(spam_score, 1.0)


@router.post("/", response_model=schemas.ReviewResponse, status_code=201)
def create_review(
    review_data: schemas.ReviewCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    # Check if booking exists and is completed
    booking = db.query(models.Booking).filter(
        models.Booking.id == review_data.booking_id,
        models.Booking.user_id == current_user.id,
        models.Booking.provider_id == review_data.provider_id,
        models.Booking.status == models.BookingStatus.COMPLETED,
    ).first()

    if not booking:
        raise HTTPException(
            status_code=400,
            detail="Can only review completed bookings",
        )

    # Check duplicate review
    existing = db.query(models.Review).filter(
        models.Review.booking_id == review_data.booking_id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Already reviewed this booking")

    spam_score = detect_spam_review(review_data.comment)

    review = models.Review(
        user_id=current_user.id,
        provider_id=review_data.provider_id,
        booking_id=review_data.booking_id,
        rating=review_data.rating,
        comment=review_data.comment,
        is_verified_purchase=True,
        ai_spam_score=spam_score,
        is_flagged=spam_score > 0.7,
    )
    db.add(review)

    # Update provider rating
    provider = db.query(models.ServiceProvider).filter(
        models.ServiceProvider.id == review_data.provider_id
    ).first()
    if provider:
        total = provider.total_reviews
        new_rating = ((provider.rating * total) + review_data.rating) / (total + 1)
        provider.rating = round(new_rating, 2)
        provider.total_reviews = total + 1
        create_notification(
            db,
            user_id=provider.user_id,
            title="New customer review",
            message=f"You received a {review_data.rating}-star review",
            notification_type=models.NotificationType.REVIEW,
            action_url="/provider",
        )

    db.commit()
    db.refresh(review)
    return review


@router.get("/provider/{provider_id}", response_model=List[schemas.ReviewResponse])
def get_provider_reviews(
    provider_id: str,
    limit: int = Query(20, le=100),
    offset: int = 0,
    db: Session = Depends(get_db),
):
    reviews = (
        db.query(models.Review)
        .options(joinedload(models.Review.user))
        .filter(
            models.Review.provider_id == provider_id,
            models.Review.is_flagged == False,  # hide spam
        )
        .order_by(models.Review.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return reviews


@router.get("/provider/{provider_id}/stats")
def get_review_stats(provider_id: str, db: Session = Depends(get_db)):
    stats = (
        db.query(
            func.count(models.Review.id).label("total"),
            func.avg(models.Review.rating).label("average"),
            func.count(func.nullif(models.Review.rating == 5, False)).label("five_star"),
            func.count(func.nullif(models.Review.rating == 4, False)).label("four_star"),
            func.count(func.nullif(models.Review.rating == 3, False)).label("three_star"),
            func.count(func.nullif(models.Review.rating == 2, False)).label("two_star"),
            func.count(func.nullif(models.Review.rating == 1, False)).label("one_star"),
        )
        .filter(models.Review.provider_id == provider_id, models.Review.is_flagged == False)
        .first()
    )
    return {
        "total": stats.total or 0,
        "average": round(stats.average or 0, 1),
        "breakdown": {
            "5": stats.five_star or 0,
            "4": stats.four_star or 0,
            "3": stats.three_star or 0,
            "2": stats.two_star or 0,
            "1": stats.one_star or 0,
        },
    }
