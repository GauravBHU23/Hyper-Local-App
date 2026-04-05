from pathlib import Path
from urllib.parse import urlparse
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

import models
import schemas
from auth import get_current_user
from audit_service import create_audit_log
from config import settings
from database import get_db

router = APIRouter()

UPLOAD_ROOT = Path(__file__).resolve().parent / "uploads"
UPLOAD_ROOT.mkdir(exist_ok=True)


def _delete_asset_file(file_url: str) -> None:
    parsed = urlparse(file_url)
    relative_path = parsed.path.removeprefix("/uploads/").strip("/")
    if not relative_path:
        return
    target = UPLOAD_ROOT / relative_path
    try:
        resolved = target.resolve()
        upload_root_resolved = UPLOAD_ROOT.resolve()
        if upload_root_resolved in resolved.parents or resolved == upload_root_resolved:
            resolved.unlink(missing_ok=True)
    except OSError:
        pass


@router.post("/", response_model=schemas.MediaAssetResponse, status_code=201)
async def upload_asset(
    asset_type: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    try:
        media_type = models.MediaAssetType(asset_type)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid asset type")

    extension = Path(file.filename or "upload.bin").suffix or ".bin"
    extension = extension.lower()
    if extension not in settings.ALLOWED_UPLOAD_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Unsupported file type")
    target_dir = UPLOAD_ROOT / media_type.value
    target_dir.mkdir(parents=True, exist_ok=True)
    filename = f"{uuid4().hex}{extension}"
    file_path = target_dir / filename
    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="Empty file upload is not allowed")
    if len(contents) > settings.MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=400, detail="File is too large")
    file_path.write_bytes(contents)

    provider = (
        db.query(models.ServiceProvider)
        .filter(models.ServiceProvider.user_id == current_user.id)
        .first()
    )
    existing_assets = (
        db.query(models.MediaAsset)
        .filter(
            models.MediaAsset.user_id == current_user.id,
            models.MediaAsset.asset_type == media_type,
        )
        .all()
    )
    for existing_asset in existing_assets:
        _delete_asset_file(existing_asset.file_url)
        db.delete(existing_asset)

    asset = models.MediaAsset(
        user_id=current_user.id,
        provider_id=provider.id if provider else None,
        asset_type=media_type,
        file_url=f"{settings.BACKEND_PUBLIC_URL}/uploads/{media_type.value}/{filename}",
        original_name=file.filename or filename,
    )
    db.add(asset)
    create_audit_log(
        db,
        action="upload_asset",
        entity_type="media_asset",
        entity_id=filename,
        user_id=current_user.id,
        details={"asset_type": media_type.value, "filename": asset.original_name},
    )
    db.commit()
    db.refresh(asset)
    return asset


@router.get("/my", response_model=list[schemas.MediaAssetResponse])
def get_my_assets(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    return (
        db.query(models.MediaAsset)
        .filter(models.MediaAsset.user_id == current_user.id)
        .order_by(models.MediaAsset.created_at.desc())
        .all()
    )


@router.delete("/{asset_id}", response_model=schemas.MessageResponse)
def delete_my_asset(
    asset_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    asset = (
        db.query(models.MediaAsset)
        .filter(
            models.MediaAsset.id == asset_id,
            models.MediaAsset.user_id == current_user.id,
        )
        .first()
    )
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    _delete_asset_file(asset.file_url)
    create_audit_log(
        db,
        action="delete_asset",
        entity_type="media_asset",
        entity_id=str(asset.id),
        user_id=current_user.id,
        details={"asset_type": asset.asset_type.value, "filename": asset.original_name},
    )
    db.delete(asset)
    db.commit()
    return schemas.MessageResponse(message="Asset deleted")
