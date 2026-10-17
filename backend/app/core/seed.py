"""
FarmConnect AI — Database Seeding Script
Populates demonstration accounts, farm profile, APMC mandi references, and initial produce listings.
Usage:
    python -m app.core.seed
"""

import sys
import logging
from datetime import datetime, timezone, timedelta
from app.core.database import SessionLocal, engine, Base
from app.core.security import get_password_hash
from app.models.models import (
    User,
    Farm,
    ProduceListing,
    MarketPriceReference,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("seed")

DEMO_USERS = [
    {
        "email": "ramesh@farmconnect.demo",
        "password": "FarmerPass123!",
        "full_name": "Ramesh Rai (ರಮೇಶ್ ರೈ)",
        "phone_number": "+91 98450 12345",
        "role": "farmer",
        "preferred_language": "kn",
        "district": "Dakshina Kannada",
        "taluk": "Bantwal",
        "village": "Mani",
        "wallet_address": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    },
    {
        "email": "procurement@oceanpearlhotels.demo",
        "password": "BuyerPass123!",
        "full_name": "Suresh Shetty (Ocean Pearl Hotels, Mangalore)",
        "phone_number": "+91 824 249 1000",
        "role": "buyer",
        "preferred_language": "en",
        "district": "Dakshina Kannada",
        "taluk": "Mangalore",
        "village": "Navabharath Circle",
        "wallet_address": "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
    },
    {
        "email": "admin@farmconnect.org",
        "password": "AdminPass123!",
        "full_name": "Dr. Ananya Rao (Agricultural Governance Director)",
        "phone_number": "+91 824 222 0011",
        "role": "admin",
        "preferred_language": "en",
        "district": "Dakshina Kannada",
        "taluk": "Mangalore",
        "village": "Hampankatta",
        "wallet_address": "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
    },
]

DEMO_MANDI_PRICES = [
    {
        "crop_name": "Arecanut (Chali)",
        "variety": "Chali Supari",
        "district": "Dakshina Kannada",
        "market_yard": "APMC Bantwal & CAMPCO",
        "min_price": 420.0,
        "modal_price": 452.0,
        "max_price": 478.0,
        "unit": "kg",
        "data_source": "Karnataka State Agricultural Marketing Board (KSAMB)",
        "is_demonstration_data": True,
    },
    {
        "crop_name": "Udupi Mattu Gulla",
        "variety": "GI Green Brinjal",
        "district": "Udupi",
        "market_yard": "Udupi Kissan Mandi",
        "min_price": 50.0,
        "modal_price": 62.0,
        "max_price": 75.0,
        "unit": "kg",
        "data_source": "Udupi Mattu Gulla Belegarara Sangha",
        "is_demonstration_data": True,
    },
    {
        "crop_name": "Black Pepper",
        "variety": "Panniyur-1 Bold",
        "district": "Dakshina Kannada",
        "market_yard": "APMC Puttur Yard",
        "min_price": 580.0,
        "modal_price": 615.0,
        "max_price": 640.0,
        "unit": "kg",
        "data_source": "Spices Board Regional Bulletin",
        "is_demonstration_data": True,
    },
    {
        "crop_name": "Tomato",
        "variety": "Local Hybrid",
        "district": "Dakshina Kannada",
        "market_yard": "APMC Mangaluru Wholesale",
        "min_price": 24.0,
        "modal_price": 28.0,
        "max_price": 32.0,
        "unit": "kg",
        "data_source": "KSAMB Daily Mandi Bulletin",
        "is_demonstration_data": True,
    },
]

def seed_database():
    logger.info("Connecting to database and ensuring schema...")
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        # 1. Seed Demo Users
        farmer_user = None
        for u in DEMO_USERS:
            existing = db.query(User).filter(User.email == u["email"].lower()).first()
            if not existing:
                user = User(
                    email=u["email"].lower(),
                    password_hash=get_password_hash(u["password"]),
                    full_name=u["full_name"],
                    phone_number=u["phone_number"],
                    role=u["role"],
                    preferred_language=u["preferred_language"],
                    district=u["district"],
                    taluk=u["taluk"],
                    village=u["village"],
                    wallet_address=u["wallet_address"],
                    is_active=True,
                )
                db.add(user)
                db.commit()
                db.refresh(user)
                logger.info("Created user: %s (%s)", user.email, user.role)
                if user.role == "farmer":
                    farmer_user = user
            else:
                if existing.role == "farmer":
                    farmer_user = existing

        # 2. Seed Farm for Farmer
        if farmer_user:
            existing_farm = db.query(Farm).filter(Farm.farmer_id == farmer_user.id).first()
            if not existing_farm:
                farm = Farm(
                    farmer_id=farmer_user.id,
                    farm_name="Rai Betel & Arecanut Estate",
                    kannada_farm_alias="ರೈ ತೋಟ ಮಣಿ",
                    total_area_acres=3.5,
                    soil_type="Coastal Laterite Soil",
                    irrigation_source="Borewell & Perennial Nethravathi Stream",
                    latitude=12.8645,
                    longitude=75.1092,
                )
                db.add(farm)
                db.commit()
                db.refresh(farm)
                logger.info("Created farm: %s", farm.farm_name)

                # Seed sample listing
                harvest_str = (datetime.now(timezone.utc).date() + timedelta(days=1)).isoformat()
                listing = ProduceListing(
                    farm_id=farm.id,
                    farmer_id=farmer_user.id,
                    crop_name="Tomato",
                    variety="Local Hybrid High-Yield",
                    category="Vegetables",
                    total_quantity=40.0,
                    available_quantity=40.0,
                    unit="kg",
                    minimum_order_quantity=10.0,
                    price_per_unit=30.0,
                    district="Dakshina Kannada",
                    taluk="Bantwal",
                    harvest_date=harvest_str,
                    quality_grade="Grade A (Standard Packed)",
                    organic_certified=False,
                    allow_group_pooling=True,
                    status="active",
                )
                db.add(listing)
                db.commit()
                logger.info("Created sample listing: %s (40 kg)", listing.crop_name)

        # 3. Seed Mandi Benchmark References
        for p in DEMO_MANDI_PRICES:
            existing_p = db.query(MarketPriceReference).filter(
                MarketPriceReference.crop_name == p["crop_name"],
                MarketPriceReference.district == p["district"],
            ).first()
            if not existing_p:
                ref = MarketPriceReference(
                    crop_name=p["crop_name"],
                    variety=p["variety"],
                    district=p["district"],
                    market_yard=p["market_yard"],
                    min_price=p["min_price"],
                    modal_price=p["modal_price"],
                    max_price=p["max_price"],
                    unit=p["unit"],
                    data_source=p["data_source"],
                    is_demonstration_data=p["is_demonstration_data"],
                    as_of_date=datetime.now(timezone.utc),
                )
                db.add(ref)
                logger.info("Created Mandi price reference: %s (%s)", ref.crop_name, ref.market_yard)
        db.commit()

        logger.info("Database seeding successfully completed!")
    except Exception as e:
        db.rollback()
        logger.error("Error seeding database: %s", e)
        sys.exit(1)
    finally:
        db.close()

if __name__ == "__main__":
    seed_database()
