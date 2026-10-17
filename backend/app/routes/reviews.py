from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.models import Review, Order, User
from app.schemas.schemas import ReviewCreate, ReviewResponse
from app.api.deps import get_current_user

router = APIRouter(prefix="/reviews", tags=["Reviews & Ratings"])

@router.post("", response_model=ReviewResponse, status_code=status.HTTP_201_CREATED)
def submit_review(
    payload: ReviewCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Submit a review for a transaction.
    STRICT RULE: Reviews are strictly restricted to eligible completed transactions.
    Reviewer must be either the buyer or seller.
    """
    order = db.query(Order).filter(Order.id == payload.order_id).first()
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found."
        )

    # Restrict review exclusively to completed orders
    if order.order_status != "completed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Reviews are only permitted for completed transactions (current order status: '{order.order_status}')."
        )

    # Ensure reviewer is participant
    if current_user.id not in [order.buyer_id, order.seller_id] and current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a participant in this order and cannot review it."
        )

    # Prevent duplicate review by same reviewer for this order
    existing_review = (
        db.query(Review)
        .filter(Review.order_id == order.id, Review.reviewer_id == current_user.id)
        .first()
    )
    if existing_review:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You have already submitted a review for this transaction."
        )

    # Reviewee is the other party
    if current_user.id == order.buyer_id:
        reviewee_id = order.seller_id
    else:
        reviewee_id = order.buyer_id

    review = Review(
        order_id=order.id,
        reviewer_id=current_user.id,
        reviewee_id=reviewee_id,
        rating=payload.rating,
        comment=payload.comment
    )
    db.add(review)
    db.commit()
    db.refresh(review)

    reviewer = db.query(User).filter(User.id == current_user.id).first()
    reviewee = db.query(User).filter(User.id == reviewee_id).first()

    resp = ReviewResponse.model_validate(review)
    resp.reviewer_name = reviewer.full_name if reviewer else None
    resp.reviewee_name = reviewee.full_name if reviewee else None
    return resp

@router.get("/orders/{order_id}", response_model=List[ReviewResponse])
def get_order_reviews(
    order_id: str,
    db: Session = Depends(get_db)
):
    """Retrieve all reviews associated with a specific completed order."""
    reviews = db.query(Review).filter(Review.order_id == order_id).all()
    results = []
    for r in reviews:
        resp = ReviewResponse.model_validate(r)
        reviewer = db.query(User).filter(User.id == r.reviewer_id).first()
        reviewee = db.query(User).filter(User.id == r.reviewee_id).first()
        resp.reviewer_name = reviewer.full_name if reviewer else None
        resp.reviewee_name = reviewee.full_name if reviewee else None
        results.append(resp)
    return results

@router.get("/users/{user_id}", response_model=List[ReviewResponse])
def get_user_received_reviews(
    user_id: str,
    db: Session = Depends(get_db)
):
    """Retrieve all reviews received by a farmer or buyer to showcase transaction reputation."""
    reviews = db.query(Review).filter(Review.reviewee_id == user_id).order_by(Review.created_at.desc()).all()
    results = []
    for r in reviews:
        resp = ReviewResponse.model_validate(r)
        reviewer = db.query(User).filter(User.id == r.reviewer_id).first()
        reviewee = db.query(User).filter(User.id == r.reviewee_id).first()
        resp.reviewer_name = reviewer.full_name if reviewer else None
        resp.reviewee_name = reviewee.full_name if reviewee else None
        results.append(resp)
    return results
