from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.models import Experiment, ExperimentObservation, Farm, User
from app.schemas.schemas import (
    ExperimentCreate,
    ExperimentResponse,
    ExperimentObservationCreate,
    ExperimentObservationResponse,
)
from app.api.deps import get_current_user, require_farmer
from app.services.ai_service import ai_service

router = APIRouter(prefix="/lab", tags=["FarmLab — Farming Experiments"])


def _map_experiment_response(exp: Experiment) -> ExperimentResponse:
    observations = [
        ExperimentObservationResponse.model_validate(obs)
        for obs in sorted(exp.observations, key=lambda o: o.observation_date)
    ]
    return ExperimentResponse(
        id=exp.id,
        farmer_id=exp.farmer_id,
        farm_id=exp.farm_id,
        title=exp.title,
        hypothesis=exp.hypothesis,
        crop_tested=exp.crop_tested,
        control_method=exp.control_method,
        experimental_method=exp.experimental_method,
        plot_size_description=exp.plot_size_description,
        duration_days=exp.duration_days or 30,
        status=exp.status or "in_progress",
        ai_synthesis_summary=exp.ai_synthesis_summary,
        limitations_summary=exp.limitations_summary,
        next_experiment_suggestions=exp.next_experiment_suggestions,
        observations=observations,
        created_at=exp.created_at,
    )


@router.post("/experiments", response_model=ExperimentResponse, status_code=status.HTTP_201_CREATED)
async def create_experiment(
    payload: ExperimentCreate,
    current_user: User = Depends(require_farmer),
    db: Session = Depends(get_db),
):
    """
    Define a new small-scale farm trial with control and experimental plot methods.
    """
    farm_id = payload.farm_id
    if farm_id:
        farm = db.query(Farm).filter(Farm.id == farm_id, Farm.farmer_id == current_user.id).first()
        if not farm:
            raise HTTPException(status_code=404, detail="Farm not found or not owned by user")
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

    exp = Experiment(
        farmer_id=current_user.id,
        farm_id=farm_id,
        title=payload.title,
        hypothesis=payload.hypothesis,
        crop_tested=payload.crop_tested,
        control_method=payload.control_method,
        experimental_method=payload.experimental_method,
        plot_size_description=payload.plot_size_description,
        duration_days=payload.duration_days,
        status="in_progress",
        ai_synthesis_summary="Awaiting trial observations to compute comparative analysis.",
    )
    db.add(exp)
    db.commit()
    db.refresh(exp)
    return _map_experiment_response(exp)


@router.get("/experiments", response_model=List[ExperimentResponse])
def get_my_experiments(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieve all FarmLab experiments for the farmer."""
    if current_user.role == "admin":
        experiments = db.query(Experiment).order_by(Experiment.created_at.desc()).all()
    else:
        experiments = (
            db.query(Experiment)
            .filter(Experiment.farmer_id == current_user.id)
            .order_by(Experiment.created_at.desc())
            .all()
        )
    return [_map_experiment_response(e) for e in experiments]


@router.get("/experiments/{experiment_id}", response_model=ExperimentResponse)
def get_experiment_by_id(
    experiment_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get single experiment with all deterministic observations and AI synthesis."""
    exp = db.query(Experiment).filter(Experiment.id == experiment_id).first()
    if not exp:
        raise HTTPException(status_code=404, detail="Experiment not found")
    if exp.farmer_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Access forbidden to this experiment")
    return _map_experiment_response(exp)


@router.post("/experiments/{experiment_id}/observations", response_model=ExperimentResponse)
async def record_experiment_observation(
    experiment_id: str,
    payload: ExperimentObservationCreate,
    current_user: User = Depends(require_farmer),
    db: Session = Depends(get_db),
):
    """
    Record an observation comparing control plot vs experimental treatment plot.
    Calculates numerical difference, percentage change, and cost delta deterministically in backend code.
    Triggers AI synthesis to explain results, limitations, and next steps without inventing measurements.
    """
    exp = db.query(Experiment).filter(Experiment.id == experiment_id).first()
    if not exp:
        raise HTTPException(status_code=404, detail="Experiment not found")
    if exp.farmer_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Access forbidden to this experiment")

    # DETERMINISTIC CALCULATION (Do NOT rely on LLM for arithmetic!)
    diff = round(payload.experimental_metric_value - payload.control_metric_value, 2)
    if payload.control_metric_value != 0:
        pct_change = round((diff / payload.control_metric_value) * 100, 2)
    else:
        pct_change = 0.0

    cost_delta = None
    if payload.input_cost_experimental is not None and payload.input_cost_control is not None:
        cost_delta = round(payload.input_cost_experimental - payload.input_cost_control, 2)

    obs = ExperimentObservation(
        experiment_id=exp.id,
        observation_date=payload.observation_date or datetime.now(timezone.utc),
        metric_name=payload.metric_name,
        control_metric_value=payload.control_metric_value,
        experimental_metric_value=payload.experimental_metric_value,
        numerical_difference=diff,
        percentage_change=pct_change,
        cost_delta=cost_delta,
        input_cost_control=payload.input_cost_control,
        input_cost_experimental=payload.input_cost_experimental,
        notes=payload.notes,
    )
    db.add(obs)
    db.flush()

    # Re-synthesize using AI
    all_obs = exp.observations
    metrics_summary = [
        {
            "metric_name": o.metric_name,
            "control_value": o.control_metric_value,
            "experimental_value": o.experimental_metric_value,
            "difference": o.numerical_difference,
            "percentage_change": o.percentage_change,
        }
        for o in all_obs
    ]

    synthesis = await ai_service.synthesize_experiment(
        experiment_title=exp.title,
        crop_tested=exp.crop_tested,
        hypothesis=exp.hypothesis,
        control_method=exp.control_method,
        experimental_method=exp.experimental_method,
        duration_days=exp.duration_days or 30,
        metrics_summary=metrics_summary,
    )

    exp.ai_synthesis_summary = synthesis.get("synthesis_summary")
    exp.limitations_summary = synthesis.get("limitations_summary")
    exp.next_experiment_suggestions = synthesis.get("next_experiment_suggestions")
    exp.status = "completed"

    db.commit()
    db.refresh(exp)
    return _map_experiment_response(exp)
