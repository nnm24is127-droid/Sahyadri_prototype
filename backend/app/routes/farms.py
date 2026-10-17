from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.models import Farm, User
from app.schemas.schemas import FarmCreate, FarmUpdate, FarmResponse
from app.api.deps import get_current_user, require_farmer, verify_farm_ownership

router = APIRouter(prefix="/farms", tags=["Farm Profiles & Crops"])

@router.post("", response_model=FarmResponse, status_code=status.HTTP_201_CREATED)
def create_farm(
    payload: FarmCreate,
    current_user: User = Depends(require_farmer),
    db: Session = Depends(get_db)
):
    farm = Farm(
        farmer_id=current_user.id,
        farm_name=payload.farm_name,
        kannada_farm_alias=payload.kannada_farm_alias,
        total_area_acres=payload.total_area_acres,
        soil_type=payload.soil_type,
        irrigation_source=payload.irrigation_source,
        latitude=payload.latitude,
        longitude=payload.longitude,
    )
    db.add(farm)
    db.commit()
    db.refresh(farm)
    return FarmResponse.model_validate(farm)

@router.get("", response_model=List[FarmResponse])
def get_my_farms(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role == "admin":
        farms = db.query(Farm).all()
    else:
        farms = db.query(Farm).filter(Farm.farmer_id == current_user.id).all()
    return [FarmResponse.model_validate(f) for f in farms]

@router.get("/{farm_id}", response_model=FarmResponse)
def get_farm_by_id(
    farm_id: str,
    farm: Farm = Depends(verify_farm_ownership)
):
    return FarmResponse.model_validate(farm)

@router.put("/{farm_id}", response_model=FarmResponse)
def update_farm(
    farm_id: str,
    payload: FarmUpdate,
    farm: Farm = Depends(verify_farm_ownership),
    db: Session = Depends(get_db)
):
    if payload.farm_name is not None:
        farm.farm_name = payload.farm_name
    if payload.kannada_farm_alias is not None:
        farm.kannada_farm_alias = payload.kannada_farm_alias
    if payload.total_area_acres is not None:
        farm.total_area_acres = payload.total_area_acres
    if payload.soil_type is not None:
        farm.soil_type = payload.soil_type
    if payload.irrigation_source is not None:
        farm.irrigation_source = payload.irrigation_source

    db.commit()
    db.refresh(farm)
    return FarmResponse.model_validate(farm)
