from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable

import models
from auth import hash_password


@dataclass(frozen=True)
class ProviderSeed:
    name: str
    email: str
    phone: str
    business_name: str
    category: models.ServiceCategory
    description: str
    latitude: float
    longitude: float
    address: str
    city: str
    pincode: str
    base_price: float
    price_unit: str
    response_time_minutes: int
    rating: float
    total_reviews: int
    total_bookings: int
    is_verified: bool = True
    is_available_24x7: bool = False
    is_currently_available: bool = True
    whatsapp: str | None = None
    tags: tuple[str, ...] = ()


PROVIDERS: tuple[ProviderSeed, ...] = (
    ProviderSeed(
        name="Ravi Sharma",
        email="ravi.plumber@hyperlocal.dev",
        phone="9876500001",
        business_name="Ravi Quick Plumbing",
        category=models.ServiceCategory.PLUMBER,
        description="Leak repair, tap fitting, bathroom plumbing, and urgent water line fixes.",
        latitude=28.4595,
        longitude=77.0266,
        address="Sector 14, Old Delhi Road",
        city="Gurugram",
        pincode="122001",
        base_price=299,
        price_unit="per visit",
        response_time_minutes=25,
        rating=4.7,
        total_reviews=41,
        total_bookings=132,
        whatsapp="9876500001",
        tags=("leak", "tap", "bathroom"),
    ),
    ProviderSeed(
        name="Arjun Verma",
        email="arjun.electric@hyperlocal.dev",
        phone="9876500002",
        business_name="Arjun Electric Works",
        category=models.ServiceCategory.ELECTRICIAN,
        description="Wiring, switchboard repair, inverter issues, and emergency electrical visits.",
        latitude=28.5355,
        longitude=77.3910,
        address="Sector 62 Market Road",
        city="Noida",
        pincode="201309",
        base_price=349,
        price_unit="per visit",
        response_time_minutes=18,
        rating=4.8,
        total_reviews=55,
        total_bookings=184,
        whatsapp="9876500002",
        is_available_24x7=True,
        tags=("wiring", "power", "switch"),
    ),
    ProviderSeed(
        name="Imran Khan",
        email="imran.ac@hyperlocal.dev",
        phone="9876500003",
        business_name="CoolAir AC Repair",
        category=models.ServiceCategory.AC_REPAIR,
        description="Split and window AC service, gas refill, cooling repair, and maintenance.",
        latitude=12.9716,
        longitude=77.5946,
        address="MG Road",
        city="Bengaluru",
        pincode="560001",
        base_price=499,
        price_unit="inspection",
        response_time_minutes=32,
        rating=4.6,
        total_reviews=38,
        total_bookings=116,
        whatsapp="9876500003",
        tags=("cooling", "gas refill", "service"),
    ),
    ProviderSeed(
        name="Vikas Yadav",
        email="vikas.carpenter@hyperlocal.dev",
        phone="9876500004",
        business_name="Urban Carpenter Care",
        category=models.ServiceCategory.CARPENTER,
        description="Furniture repair, wardrobe fitting, modular work, and wood polishing.",
        latitude=19.0760,
        longitude=72.8777,
        address="Andheri East",
        city="Mumbai",
        pincode="400069",
        base_price=399,
        price_unit="per visit",
        response_time_minutes=40,
        rating=4.5,
        total_reviews=29,
        total_bookings=90,
        whatsapp="9876500004",
        tags=("furniture", "wardrobe", "woodwork"),
    ),
    ProviderSeed(
        name="Neha Joshi",
        email="neha.cleaning@hyperlocal.dev",
        phone="9876500005",
        business_name="NeatNest Cleaning",
        category=models.ServiceCategory.CLEANING,
        description="Deep home cleaning, kitchen cleaning, bathroom scrubbing, and sofa care.",
        latitude=18.5204,
        longitude=73.8567,
        address="FC Road",
        city="Pune",
        pincode="411005",
        base_price=799,
        price_unit="starting",
        response_time_minutes=50,
        rating=4.7,
        total_reviews=47,
        total_bookings=150,
        whatsapp="9876500005",
        tags=("deep cleaning", "kitchen", "bathroom"),
    ),
    ProviderSeed(
        name="Priya Singh",
        email="priya.tutor@hyperlocal.dev",
        phone="9876500006",
        business_name="BrightPath Home Tutors",
        category=models.ServiceCategory.TUTOR,
        description="Maths, science, and spoken English tutors for school students.",
        latitude=28.6139,
        longitude=77.2090,
        address="Connaught Place",
        city="Delhi",
        pincode="110001",
        base_price=600,
        price_unit="per class",
        response_time_minutes=90,
        rating=4.9,
        total_reviews=33,
        total_bookings=108,
        whatsapp="9876500006",
        tags=("maths", "science", "english"),
    ),
    ProviderSeed(
        name="Dr. Meera Iyer",
        email="meera.doctor@hyperlocal.dev",
        phone="9876500007",
        business_name="CityCare Family Clinic",
        category=models.ServiceCategory.DOCTOR,
        description="General physician consultation for fever, cold, cough, and everyday illness.",
        latitude=13.0827,
        longitude=80.2707,
        address="T Nagar",
        city="Chennai",
        pincode="600017",
        base_price=700,
        price_unit="consultation",
        response_time_minutes=35,
        rating=4.8,
        total_reviews=62,
        total_bookings=210,
        whatsapp="9876500007",
        is_available_24x7=True,
        tags=("clinic", "general physician"),
    ),
    ProviderSeed(
        name="Ankit Saini",
        email="ankit.mechanic@hyperlocal.dev",
        phone="9876500008",
        business_name="Highway Auto Mechanic",
        category=models.ServiceCategory.MECHANIC,
        description="Bike and car breakdown support, battery issues, and doorstep mechanic visits.",
        latitude=26.9124,
        longitude=75.7873,
        address="Malviya Nagar",
        city="Jaipur",
        pincode="302017",
        base_price=450,
        price_unit="inspection",
        response_time_minutes=28,
        rating=4.4,
        total_reviews=24,
        total_bookings=71,
        whatsapp="9876500008",
        tags=("bike", "car", "battery"),
    ),
    ProviderSeed(
        name="Kiran Patel",
        email="kiran.chemist@hyperlocal.dev",
        phone="9876500009",
        business_name="HealthFirst Chemist",
        category=models.ServiceCategory.CHEMIST,
        description="Prescription medicines, OTC essentials, and quick neighborhood delivery.",
        latitude=23.0225,
        longitude=72.5714,
        address="Navrangpura",
        city="Ahmedabad",
        pincode="380009",
        base_price=99,
        price_unit="delivery",
        response_time_minutes=20,
        rating=4.6,
        total_reviews=36,
        total_bookings=164,
        whatsapp="9876500009",
        is_available_24x7=True,
        tags=("medicines", "pharmacy"),
    ),
    ProviderSeed(
        name="Rahul Sethi",
        email="rahul.grocery@hyperlocal.dev",
        phone="9876500010",
        business_name="DailyNeeds Grocery",
        category=models.ServiceCategory.GROCERY,
        description="Fresh groceries, daily essentials, and same-day local delivery.",
        latitude=22.5726,
        longitude=88.3639,
        address="Salt Lake",
        city="Kolkata",
        pincode="700091",
        base_price=49,
        price_unit="delivery",
        response_time_minutes=22,
        rating=4.5,
        total_reviews=44,
        total_bookings=188,
        whatsapp="9876500010",
        tags=("fruits", "vegetables", "delivery"),
    ),
)


def _get_or_create_user(db, seed: ProviderSeed) -> models.User:
    user = db.query(models.User).filter(models.User.email == seed.email).first()
    if user:
        return user

    user = models.User(
        name=seed.name,
        email=seed.email,
        phone=seed.phone,
        hashed_password=hash_password("Provider@123"),
        preferred_language="en",
        is_provider=True,
    )
    db.add(user)
    db.flush()
    return user


def seed_database(db) -> int:
    customer = db.query(models.User).filter(models.User.email == "customer@hyperlocal.dev").first()
    if not customer:
        customer = models.User(
            name="Demo Customer",
            email="customer@hyperlocal.dev",
            phone="9876511111",
            hashed_password=hash_password("Customer@123"),
            preferred_language="en",
        )
        db.add(customer)
        db.flush()

    admin_user = db.query(models.User).filter(models.User.email == "admin@hyperlocal.dev").first()
    if not admin_user:
        admin_user = models.User(
            name="Demo Admin",
            email="admin@hyperlocal.dev",
            phone="9876512222",
            hashed_password=hash_password("Admin@123"),
            preferred_language="en",
        )
        db.add(admin_user)
        db.flush()

    if db.query(models.ServiceProvider).count() > 0:
        db.commit()
        return 0

    created = 0

    providers: list[models.ServiceProvider] = []
    for seed in PROVIDERS:
        user = _get_or_create_user(db, seed)
        provider = models.ServiceProvider(
            user_id=user.id,
            business_name=seed.business_name,
            description=seed.description,
            category=seed.category,
            tags=list(seed.tags),
            latitude=seed.latitude,
            longitude=seed.longitude,
            address=seed.address,
            city=seed.city,
            pincode=seed.pincode,
            is_available_24x7=seed.is_available_24x7,
            working_hours={"mon": {"open": "09:00", "close": "20:00"}},
            is_currently_available=seed.is_currently_available,
            base_price=seed.base_price,
            price_unit=seed.price_unit,
            rating=seed.rating,
            total_reviews=seed.total_reviews,
            total_bookings=seed.total_bookings,
            response_time_minutes=seed.response_time_minutes,
            is_verified=seed.is_verified,
            phone=seed.phone,
            whatsapp=seed.whatsapp or seed.phone,
            images=[],
        )
        db.add(provider)
        db.flush()
        providers.append(provider)
        created += 1

    for index, provider in enumerate(providers[:4], start=1):
        booking = models.Booking(
            user_id=customer.id,
            provider_id=provider.id,
            problem_description=f"Completed service request #{index}",
            ai_suggested=index % 2 == 0,
            service_address=f"{provider.address}, {provider.city}",
            status=models.BookingStatus.COMPLETED,
            estimated_cost=provider.base_price,
            final_cost=provider.base_price,
        )
        db.add(booking)
        db.flush()

        review = models.Review(
            user_id=customer.id,
            provider_id=provider.id,
            booking_id=booking.id,
            rating=5 if index % 2 else 4,
            comment=f"Reliable service from {provider.business_name}. Technician arrived on time.",
            is_verified_purchase=True,
            ai_spam_score=0.05,
            is_flagged=False,
        )
        db.add(review)

    db.commit()
    return created
