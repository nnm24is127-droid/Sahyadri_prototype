import base64
import hashlib
import logging
import os
import uuid
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.database import get_db
from app.models.models import CropInvestigation, InvestigationObservation, InvestigationImage, Farm, User
from app.schemas.schemas import (
    InvestigationCreate,
    InvestigationResponse,
    InvestigationObservationCreate,
    InvestigationObservationResponse,
    PossibleCauseItem,
    ImageUploadResponse,
)
from app.api.deps import get_current_user, require_farmer, get_current_user_flexible
from app.services.ai_service import ai_service

logger = logging.getLogger("farmconnect-forensics")

router = APIRouter(prefix="/forensics", tags=["FarmForensics — Crop Pathology"])


@router.post("/upload-image", response_model=ImageUploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_investigation_image(
    file: UploadFile = File(...),
    current_user: User = Depends(require_farmer),
    db: Session = Depends(get_db),
):
    """
    Upload a leaf / bunch photograph for FarmForensics crop disease investigation.
    Enforces maximum 10 MB file size, strict MIME and magic-byte signature validation (JPEG/PNG),
    sanitizes filenames, and stores files using unique server-generated IDs.
    """
    if not file or not file.filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No photograph file provided.")

    # 1. Extension validation
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in settings.ALLOWED_IMAGE_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported image format '{ext}'. Only JPEG and PNG images are accepted (.jpg, .jpeg, .png).",
        )

    # 2. Read content and validate max file size
    content = await file.read()
    size = len(content)
    if size == 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded file is empty.")
    if size > settings.MAX_UPLOAD_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File size exceeds 10 MB limit ({size / (1024 * 1024):.2f} MB).",
        )

    # 3. Magic bytes content signature validation
    is_jpeg = content.startswith(b"\xff\xd8\xff")
    is_png = content.startswith(b"\x89PNG\r\n\x1a\n")
    if not (is_jpeg or is_png):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid image file signature. File is corrupted or not an authentic JPEG or PNG image.",
        )

    mime_type = "image/jpeg" if is_jpeg else "image/png"

    # 4. Generate unique server-side filename and ensure upload directory exists
    safe_orig_filename = os.path.basename(file.filename).replace("\\", "").replace("/", "")
    stored_filename = f"{uuid.uuid4().hex}{ext}"

    upload_dir = os.path.abspath(settings.UPLOAD_DIR)
    os.makedirs(upload_dir, exist_ok=True)

    file_path = os.path.abspath(os.path.join(upload_dir, stored_filename))
    if not file_path.startswith(upload_dir):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid storage path detected.")

    # 5. Persist file to local disk
    with open(file_path, "wb") as f:
        f.write(content)

    # 6. Compute SHA-256 integrity hash
    sha256 = hashlib.sha256(content).hexdigest()

    # 7. Record in database
    image_record = InvestigationImage(
        farmer_id=current_user.id,
        investigation_id=None,
        original_filename=safe_orig_filename,
        stored_filename=stored_filename,
        file_size_bytes=size,
        mime_type=mime_type,
        sha256_hash=sha256,
    )
    db.add(image_record)
    db.commit()
    db.refresh(image_record)

    image_url = f"{settings.API_V1_STR}/forensics/images/{image_record.id}"
    return ImageUploadResponse(
        image_id=image_record.id,
        image_url=image_url,
        filename=safe_orig_filename,
        size_bytes=size,
        mime_type=mime_type,
    )


@router.get("/images/{image_id}")
def get_investigation_image(
    image_id: str,
    db: Session = Depends(get_db),
):
    """
    Serve a crop investigation photograph by its unique image ID.
    Allows browser <img> tags to render the specimen photo seamlessly.
    """
    image = db.query(InvestigationImage).filter(InvestigationImage.id == image_id).first()
    if not image:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Photograph record not found.")

    upload_dir = os.path.abspath(settings.UPLOAD_DIR)
    file_path = os.path.abspath(os.path.join(upload_dir, image.stored_filename))
    if not file_path.startswith(upload_dir) or not os.path.exists(file_path):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Photograph file missing on storage.")

    return FileResponse(file_path, media_type=image.mime_type, filename=image.original_filename)


def _map_investigation_response(case: CropInvestigation) -> InvestigationResponse:
    observations = [
        InvestigationObservationResponse.model_validate(obs)
        for obs in sorted(case.observations, key=lambda o: o.observation_date)
    ]
    possible_causes = [
        PossibleCauseItem(**c) if isinstance(c, dict) else PossibleCauseItem(cause=str(c), likelihood="Possible")
        for c in (case.possible_causes_json or [])
    ]
    resp = InvestigationResponse(
        id=case.id,
        farm_id=case.farm_id,
        farmer_id=case.farmer_id,
        crop_name=case.crop_name,
        symptoms_description=case.symptoms_description,
        voice_note_transcript_kannada=case.voice_note_transcript_kannada,
        affected_percentage=case.affected_percentage,
        image_url=case.image_url,
        ai_preliminary_diagnosis=case.ai_preliminary_diagnosis,
        ai_confidence_score=case.ai_confidence_score,
        urgency=case.urgency or "medium",
        remedies=case.remedies_json or [],
        possible_causes=possible_causes,
        recommended_next_checks=case.recommended_checks_json or [],
        observations=observations,
        ai_disclaimer_notice=case.ai_disclaimer_notice or (
            "Notice: AI-assisted agricultural observation for early warning purposes. "
            "Consult local Krishi Vigyan Kendra (KVK) Brahmavar / Mangalore or horticulture officers before applying chemical treatments."
        ),
        status=case.status or "open",
        created_at=case.created_at,
    )
    return resp


@router.post("/investigations", response_model=InvestigationResponse, status_code=status.HTTP_201_CREATED)
async def create_investigation(
    payload: InvestigationCreate,
    current_user: User = Depends(require_farmer),
    db: Session = Depends(get_db),
):
    """
    Initiate a crop pathology investigation using Anthropic Claude (with multimodal image support)
    or expert regional agronomic fallback.
    Clearly communicates uncertainty and builds the starting event in the chronological timeline.
    """
    farm_id = payload.farm_id
    if farm_id:
        farm = db.query(Farm).filter(Farm.id == farm_id, Farm.farmer_id == current_user.id).first()
        if not farm:
            raise HTTPException(status_code=404, detail="Farm not found or does not belong to user")
    else:
        farm = db.query(Farm).filter(Farm.farmer_id == current_user.id).first()
        if not farm:
            farm = Farm(
                farmer_id=current_user.id,
                farm_name=f"{current_user.full_name}'s Farm",
                total_area_acres=2.5,
                soil_type="Coastal Laterite",
                irrigation_source="Borewell",
            )
            db.add(farm)
            db.commit()
            db.refresh(farm)
        farm_id = farm.id

    # Locate and associate uploaded image if provided
    image_record: Optional[InvestigationImage] = None
    target_image_id = payload.image_id
    if not target_image_id and payload.image_url and "/forensics/images/" in payload.image_url:
        try:
            target_image_id = payload.image_url.split("/forensics/images/")[1].split("?")[0].strip()
        except Exception:
            target_image_id = None

    if target_image_id:
        image_record = db.query(InvestigationImage).filter(
            InvestigationImage.id == target_image_id,
            InvestigationImage.farmer_id == current_user.id,
        ).first()

    image_base64 = payload.image_base64
    image_media_type = "image/jpeg"
    if image_record and not image_base64:
        upload_dir = os.path.abspath(settings.UPLOAD_DIR)
        file_path = os.path.abspath(os.path.join(upload_dir, image_record.stored_filename))
        if os.path.exists(file_path):
            try:
                with open(file_path, "rb") as img_file:
                    raw_bytes = img_file.read()
                    image_base64 = base64.b64encode(raw_bytes).decode("utf-8")
                    image_media_type = image_record.mime_type
            except Exception as ex:
                logger.warning(f"Could not read uploaded specimen for AI analysis: {ex}")

    # Call AI service (Anthropic Claude / Gemini / OmniRoute with regional fallback)
    ai_result = await ai_service.analyze_crop_pathology(
        crop_name=payload.crop_name,
        symptoms_description=payload.symptoms_description,
        affected_percentage=payload.affected_percentage,
        irrigation_details=payload.irrigation_details,
        image_base64=image_base64,
        image_media_type=image_media_type,
    )

    case = CropInvestigation(
        farm_id=farm_id,
        farmer_id=current_user.id,
        crop_name=payload.crop_name,
        symptoms_description=payload.symptoms_description,
        voice_note_transcript_kannada=payload.voice_note_transcript_kannada,
        affected_percentage=payload.affected_percentage,
        irrigation_details=payload.irrigation_details,
        image_url=payload.image_url or (f"{settings.API_V1_STR}/forensics/images/{image_record.id}" if image_record else None),
        ai_preliminary_diagnosis=ai_result.get("preliminary_diagnosis"),
        ai_confidence_score=ai_result.get("confidence_score", 0.85),
        urgency=ai_result.get("urgency", "medium"),
        remedies_json=ai_result.get("remedies", []),
        possible_causes_json=ai_result.get("possible_causes", []),
        recommended_checks_json=ai_result.get("recommended_next_checks", []),
        ai_disclaimer_notice=ai_result.get(
            "disclaimer",
            "Notice: AI-assisted agricultural observation for early warning purposes. Consult local KVK Brahmavar / Mangalore.",
        ),
        status="open",
        created_at=payload.observation_date or datetime.now(timezone.utc),
    )
    db.add(case)
    db.flush()

    if image_record:
        image_record.investigation_id = case.id
        db.add(image_record)

    # Create initial timeline observation
    initial_obs = InvestigationObservation(
        investigation_id=case.id,
        observation_date=case.created_at,
        action_taken="Initial investigation logged by farmer with symptom observations.",
        treatment_type="Diagnostic Recording",
        spread_status=f"Initial affected area estimated at {payload.affected_percentage or 10.0}%",
        notes=payload.symptoms_description,
        image_url=payload.image_url,
    )
    db.add(initial_obs)

    db.commit()
    db.refresh(case)
    return _map_investigation_response(case)


@router.get("/investigations", response_model=List[InvestigationResponse])
def get_my_investigations(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieve all crop investigations for authenticated farmer with chronological observations."""
    if current_user.role == "admin":
        cases = db.query(CropInvestigation).order_by(CropInvestigation.created_at.desc()).all()
    else:
        cases = (
            db.query(CropInvestigation)
            .filter(CropInvestigation.farmer_id == current_user.id)
            .order_by(CropInvestigation.created_at.desc())
            .all()
        )
    return [_map_investigation_response(c) for c in cases]


@router.get("/investigations/{investigation_id}", response_model=InvestigationResponse)
def get_investigation_detail(
    investigation_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get single investigation detail including timeline and recommended checks."""
    case = db.query(CropInvestigation).filter(CropInvestigation.id == investigation_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Investigation record not found")
    if case.farmer_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Access forbidden to this investigation")
    return _map_investigation_response(case)


@router.get("/investigations/{investigation_id}/timeline", response_model=List[InvestigationObservationResponse])
def get_investigation_timeline(
    investigation_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Build and return a chronological timeline from the recorded observation events."""
    case = db.query(CropInvestigation).filter(CropInvestigation.id == investigation_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Investigation record not found")
    if case.farmer_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Access forbidden to this investigation")

    observations = (
        db.query(InvestigationObservation)
        .filter(InvestigationObservation.investigation_id == investigation_id)
        .order_by(InvestigationObservation.observation_date.asc())
        .all()
    )
    return [InvestigationObservationResponse.model_validate(o) for o in observations]


@router.post("/investigations/{investigation_id}/observations", response_model=InvestigationResponse)
def add_investigation_observation(
    investigation_id: str,
    payload: InvestigationObservationCreate,
    current_user: User = Depends(require_farmer),
    db: Session = Depends(get_db),
):
    """
    Farmer records a follow-up observation on an existing case to track disease spread,
    applied treatments, or recovery progress over time.
    """
    case = db.query(CropInvestigation).filter(CropInvestigation.id == investigation_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Investigation record not found")
    if case.farmer_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Access forbidden to this investigation")

    obs = InvestigationObservation(
        investigation_id=case.id,
        observation_date=payload.observation_date or datetime.now(timezone.utc),
        action_taken=payload.action_taken,
        treatment_type=payload.treatment_type,
        spread_status=payload.spread_status,
        notes=payload.notes,
        image_url=payload.image_url,
    )
    db.add(obs)

    # If spread status indicates recovery or contained, update investigation status
    if "resolved" in payload.spread_status.lower() or "cured" in payload.spread_status.lower():
        case.status = "resolved"
    elif case.status == "open":
        case.status = "monitoring"

    db.commit()
    db.refresh(case)
    return _map_investigation_response(case)
