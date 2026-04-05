from math import radians, cos, sin, asin, sqrt
from typing import List, Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

import models, schemas
from auth import get_current_user
from config import settings
from database import get_db

router = APIRouter()


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance in km between two coordinates."""
    earth_radius_km = 6371
    lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = sin(dlat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(dlon / 2) ** 2
    return earth_radius_km * 2 * asin(sqrt(a))


def ensure_google_maps_api_key() -> str:
    if not settings.GOOGLE_MAPS_API_KEY:
        raise HTTPException(status_code=503, detail="Google Maps API key is not configured")
    return settings.GOOGLE_MAPS_API_KEY


def geocode_provider_address(address: str, city: str) -> tuple[float, float]:
    api_key = ensure_google_maps_api_key()
    query = f"{address}, {city}"

    with httpx.Client(timeout=15.0) as client:
        response = client.get(
            settings.GOOGLE_GEOCODING_API_URL,
            params={"address": query, "key": api_key},
        )
        response.raise_for_status()
        data = response.json()

    if data.get("status") != "OK" or not data.get("results"):
        raise HTTPException(status_code=400, detail="Could not geocode provider address")

    location = data["results"][0]["geometry"]["location"]
    return float(location["lat"]), float(location["lng"])


@router.get("/categories/all")
def get_categories():
    return [
        {"value": c.value, "label": c.value.replace("_", " ").title()}
        for c in models.ServiceCategory
    ]


@router.get("/discover", response_model=List[schemas.ServiceProviderResponse])
def discover_services(
    category: Optional[models.ServiceCategory] = None,
    query: Optional[str] = None,
    limit: int = Query(12, ge=1, le=50),
    db: Session = Depends(get_db),
):
    providers = db.query(models.ServiceProvider)

    if category:
        providers = providers.filter(models.ServiceProvider.category == category)

    if query:
        search = f"%{query.lower()}%"
        providers = providers.filter(
            or_(
                func.lower(models.ServiceProvider.business_name).like(search),
                func.lower(models.ServiceProvider.description).like(search),
                func.lower(models.ServiceProvider.city).like(search),
            )
        )

    ranked = (
        providers.order_by(
            models.ServiceProvider.is_verified.desc(),
            models.ServiceProvider.is_currently_available.desc(),
            models.ServiceProvider.rating.desc(),
            models.ServiceProvider.total_bookings.desc(),
        )
        .limit(limit)
        .all()
    )
    return [schemas.ServiceProviderResponse.model_validate(provider) for provider in ranked]


@router.get("/mine", response_model=Optional[schemas.ServiceProviderResponse])
def get_my_provider(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    provider = (
        db.query(models.ServiceProvider)
        .filter(models.ServiceProvider.user_id == current_user.id)
        .first()
    )
    return provider


@router.get("/search/suggest")
def search_suggestions(
    q: str = Query(..., min_length=2),
    db: Session = Depends(get_db),
):
    search = f"%{q.lower()}%"
    results = (
        db.query(
            models.ServiceProvider.business_name,
            models.ServiceProvider.category,
            models.ServiceProvider.city,
        )
        .filter(
            or_(
                func.lower(models.ServiceProvider.business_name).like(search),
                func.lower(models.ServiceProvider.city).like(search),
                func.lower(models.ServiceProvider.description).like(search),
            )
        )
        .limit(8)
        .all()
    )
    return [{"name": r[0], "category": r[1], "city": r[2]} for r in results]


@router.get("/maps/geocode", response_model=schemas.GeocodeResult)
async def geocode_address(address: str = Query(..., min_length=3)):
    api_key = ensure_google_maps_api_key()

    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.get(
            settings.GOOGLE_GEOCODING_API_URL,
            params={"address": address, "key": api_key},
        )
        response.raise_for_status()
        data = response.json()

    if data.get("status") != "OK" or not data.get("results"):
        raise HTTPException(status_code=404, detail="Address not found")

    result = data["results"][0]
    location = result["geometry"]["location"]
    return schemas.GeocodeResult(
        formatted_address=result["formatted_address"],
        latitude=location["lat"],
        longitude=location["lng"],
        place_id=result.get("place_id"),
    )


@router.get("/maps/reverse-geocode", response_model=schemas.GeocodeResult)
async def reverse_geocode(
    latitude: float = Query(..., ge=-90, le=90),
    longitude: float = Query(..., ge=-180, le=180),
):
    api_key = ensure_google_maps_api_key()

    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.get(
            settings.GOOGLE_GEOCODING_API_URL,
            params={"latlng": f"{latitude},{longitude}", "key": api_key},
        )
        response.raise_for_status()
        data = response.json()

    if data.get("status") != "OK" or not data.get("results"):
        raise HTTPException(status_code=404, detail="Location not found")

    result = data["results"][0]
    location = result["geometry"]["location"]
    return schemas.GeocodeResult(
        formatted_address=result["formatted_address"],
        latitude=location["lat"],
        longitude=location["lng"],
        place_id=result.get("place_id"),
    )


@router.get("/maps/autocomplete", response_model=List[schemas.PlaceSuggestion])
async def autocomplete_places(
    input_text: str = Query(..., min_length=2),
    limit: int = Query(5, ge=1, le=10),
):
    api_key = ensure_google_maps_api_key()

    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.post(
            settings.GOOGLE_PLACES_AUTOCOMPLETE_API_URL,
            headers={
                "Content-Type": "application/json",
                "X-Goog-Api-Key": api_key,
                "X-Goog-FieldMask": "suggestions.placePrediction.placeId,suggestions.placePrediction.text",
            },
            json={"input": input_text},
        )
        response.raise_for_status()
        data = response.json()

    suggestions = []
    for item in data.get("suggestions", []):
        prediction = item.get("placePrediction")
        if not prediction:
            continue
        suggestions.append(
            schemas.PlaceSuggestion(
                place_id=prediction["placeId"],
                text=prediction["text"]["text"],
            )
        )

    return suggestions[:limit]


@router.get("/nearby", response_model=List[schemas.ServiceProviderResponse])
def get_nearby_services(
    latitude: float = Query(...),
    longitude: float = Query(...),
    radius_km: float = Query(10.0, le=50),
    category: Optional[models.ServiceCategory] = None,
    query: Optional[str] = None,
    available_now: bool = False,
    min_rating: float = Query(0.0, ge=0, le=5),
    max_price: Optional[float] = None,
    limit: int = Query(20, le=100),
    offset: int = 0,
    db: Session = Depends(get_db),
):
    providers = db.query(models.ServiceProvider)

    if category:
        providers = providers.filter(models.ServiceProvider.category == category)

    if available_now:
        providers = providers.filter(models.ServiceProvider.is_currently_available == True)

    if min_rating > 0:
        providers = providers.filter(models.ServiceProvider.rating >= min_rating)

    if max_price:
        providers = providers.filter(
            or_(
                models.ServiceProvider.base_price <= max_price,
                models.ServiceProvider.base_price == None,
            )
        )

    if query:
        search = f"%{query.lower()}%"
        providers = providers.filter(
            or_(
                func.lower(models.ServiceProvider.business_name).like(search),
                func.lower(models.ServiceProvider.description).like(search),
                func.lower(models.ServiceProvider.city).like(search),
            )
        )

    nearby = []
    for provider in providers.all():
        distance_km = haversine_distance(latitude, longitude, provider.latitude, provider.longitude)
        if distance_km <= radius_km:
            score = (
                distance_km * 0.55
                + max(0.0, 5 - provider.rating) * 1.75
                + min(provider.response_time_minutes, 180) / 60 * 0.9
                - (0.75 if provider.is_verified else 0.0)
                - (0.35 if provider.is_currently_available else 0.0)
            )
            provider_dict = {**provider.__dict__, "distance_km": round(distance_km, 2)}
            nearby.append((score, distance_km, provider_dict))

    nearby.sort(key=lambda item: (item[0], item[1]))
    paginated = [item[2] for item in nearby[offset : offset + limit]]
    return [schemas.ServiceProviderResponse(**item) for item in paginated]


@router.post("/", response_model=schemas.ServiceProviderResponse, status_code=201)
def create_provider(
    data: schemas.ServiceProviderCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    existing = (
        db.query(models.ServiceProvider)
        .filter(models.ServiceProvider.user_id == current_user.id)
        .first()
    )
    if existing:
        raise HTTPException(status_code=400, detail="Provider profile already exists")

    payload = data.model_dump()
    if payload.get("latitude") is None or payload.get("longitude") is None:
        latitude, longitude = geocode_provider_address(payload["address"], payload["city"])
        payload["latitude"] = latitude
        payload["longitude"] = longitude

    provider = models.ServiceProvider(
        user_id=current_user.id,
        **payload,
    )
    db.add(provider)

    current_user.is_provider = True
    db.commit()
    db.refresh(provider)
    return provider


@router.get("/{provider_id}", response_model=schemas.ServiceProviderResponse)
def get_provider(provider_id: str, db: Session = Depends(get_db)):
    provider = db.query(models.ServiceProvider).filter(
        models.ServiceProvider.id == provider_id
    ).first()
    if not provider:
        raise HTTPException(status_code=404, detail="Service provider not found")
    return provider


@router.put("/{provider_id}", response_model=schemas.ServiceProviderResponse)
def update_provider(
    provider_id: str,
    update_data: schemas.ServiceProviderUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    provider = db.query(models.ServiceProvider).filter(
        models.ServiceProvider.id == provider_id,
        models.ServiceProvider.user_id == current_user.id,
    ).first()
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found or unauthorized")

    payload = update_data.model_dump(exclude_unset=True)
    needs_geocode = (
        ("address" in payload or "city" in payload)
        and "latitude" not in payload
        and "longitude" not in payload
    )
    if needs_geocode:
        latitude, longitude = geocode_provider_address(
            payload.get("address", provider.address),
            payload.get("city", provider.city),
        )
        payload["latitude"] = latitude
        payload["longitude"] = longitude

    for key, value in payload.items():
        setattr(provider, key, value)

    db.commit()
    db.refresh(provider)
    return provider


@router.put("/mine/live-location", response_model=schemas.ServiceProviderResponse)
def update_my_live_location(
    location: schemas.ProviderLocationUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    provider = (
        db.query(models.ServiceProvider)
        .filter(models.ServiceProvider.user_id == current_user.id)
        .first()
    )
    if not provider:
        raise HTTPException(status_code=404, detail="Provider profile not found")

    provider.latitude = location.latitude
    provider.longitude = location.longitude
    provider.is_currently_available = True
    db.commit()
    db.refresh(provider)
    return provider
