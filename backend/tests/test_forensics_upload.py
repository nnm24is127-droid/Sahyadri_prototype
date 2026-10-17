import io
import pytest
from starlette.testclient import TestClient


def register_user(client: TestClient, email: str, role: str = "farmer"):
    res = client.post("/api/v1/auth/register", json={
        "email": email,
        "password": "Password123!",
        "full_name": f"Test User {email}",
        "phone_number": "+91 98800 11111",
        "role": role,
        "taluk": "Bantwal",
        "district": "Dakshina Kannada"
    })
    assert res.status_code == 201
    return res.json()["access_token"], res.json()["user"]["id"]


def test_upload_valid_jpeg_and_png(client: TestClient):
    token, _ = register_user(client, "upload.farmer1@test.com", "farmer")
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Valid JPEG with magic bytes \xFF\xD8\xFF
    fake_jpeg_bytes = b"\xff\xd8\xff\xe0" + b"JFIF" + b"\x00" * 200
    res = client.post(
        "/api/v1/forensics/upload-image",
        files={"file": ("leaf_lesion.jpg", io.BytesIO(fake_jpeg_bytes), "image/jpeg")},
        headers=headers,
    )
    assert res.status_code == 201
    data = res.json()
    assert "image_id" in data
    assert "image_url" in data
    assert data["filename"] == "leaf_lesion.jpg"
    assert data["mime_type"] == "image/jpeg"
    assert data["size_bytes"] == len(fake_jpeg_bytes)

    # 2. Valid PNG with magic bytes \x89PNG\r\n\x1a\n
    fake_png_bytes = b"\x89PNG\r\n\x1a\n" + b"\x00" * 300
    res_png = client.post(
        "/api/v1/forensics/upload-image",
        files={"file": ("bunch_rot.png", io.BytesIO(fake_png_bytes), "image/png")},
        headers=headers,
    )
    assert res_png.status_code == 201
    data_png = res_png.json()
    assert data_png["mime_type"] == "image/png"


def test_upload_rejects_oversized_file(client: TestClient):
    token, _ = register_user(client, "upload.farmer2@test.com", "farmer")
    headers = {"Authorization": f"Bearer {token}"}

    # 10MB + 1KB
    oversized_bytes = b"\xff\xd8\xff\xe0" + (b"0" * (10 * 1024 * 1024 + 1024))
    res = client.post(
        "/api/v1/forensics/upload-image",
        files={"file": ("huge_photo.jpg", io.BytesIO(oversized_bytes), "image/jpeg")},
        headers=headers,
    )
    assert res.status_code == 400
    assert "exceeds 10 MB" in res.json()["detail"]


def test_upload_rejects_unsupported_and_malformed_files(client: TestClient):
    token, _ = register_user(client, "upload.farmer3@test.com", "farmer")
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Unsupported extension
    fake_pdf = b"%PDF-1.4" + b"\x00" * 50
    res_pdf = client.post(
        "/api/v1/forensics/upload-image",
        files={"file": ("report.pdf", io.BytesIO(fake_pdf), "application/pdf")},
        headers=headers,
    )
    assert res_pdf.status_code == 400
    assert "Unsupported image format" in res_pdf.json()["detail"]

    # 2. Spoofed extension with executable/malformed content
    spoofed = b"MZ\x90\x00\x03\x00\x00\x00" + b"\x00" * 50  # Windows PE header
    res_spoofed = client.post(
        "/api/v1/forensics/upload-image",
        files={"file": ("malware.jpg", io.BytesIO(spoofed), "image/jpeg")},
        headers=headers,
    )
    assert res_spoofed.status_code == 400
    assert "Invalid image file signature" in res_spoofed.json()["detail"]


def test_image_authorization_protection(client: TestClient):
    # Farmer A uploads image
    token_a, user_a_id = register_user(client, "farmer.alice@test.com", "farmer")
    fake_jpeg = b"\xff\xd8\xff\xe0JFIF" + b"\x00" * 100
    res_upload = client.post(
        "/api/v1/forensics/upload-image",
        files={"file": ("private_leaf.jpg", io.BytesIO(fake_jpeg), "image/jpeg")},
        headers={"Authorization": f"Bearer {token_a}"},
    )
    assert res_upload.status_code == 201
    image_id = res_upload.json()["image_id"]

    # Farmer B attempts to access Farmer A's image -> MUST RETURN 403 Forbidden
    token_b, _ = register_user(client, "farmer.bob@test.com", "farmer")
    res_b = client.get(
        f"/api/v1/forensics/images/{image_id}",
        headers={"Authorization": f"Bearer {token_b}"},
    )
    assert res_b.status_code == 403

    # Unauthenticated access -> MUST RETURN 401 Unauthorized
    res_unauth = client.get(f"/api/v1/forensics/images/{image_id}")
    assert res_unauth.status_code == 401

    # Farmer A accesses own image with header -> 200 OK
    res_a = client.get(
        f"/api/v1/forensics/images/{image_id}",
        headers={"Authorization": f"Bearer {token_a}"},
    )
    assert res_a.status_code == 200
    assert res_a.content == fake_jpeg

    # Farmer A accesses own image with query token -> 200 OK
    res_a_query = client.get(
        f"/api/v1/forensics/images/{image_id}?token={token_a}"
    )
    assert res_a_query.status_code == 200
    assert res_a_query.content == fake_jpeg


def test_investigation_with_and_without_image(client: TestClient):
    token, _ = register_user(client, "farmer.inv@test.com", "farmer")
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Investigation WITHOUT image
    inv_no_img = {
        "crop_name": "Black Pepper (ಕಾಳುಮೆಣಸು)",
        "symptoms_description": "Leaves wilting and dark lesions at vine collar",
        "affected_percentage": 15.0,
    }
    res_no_img = client.post("/api/v1/forensics/investigations", json=inv_no_img, headers=headers)
    assert res_no_img.status_code == 201
    data_no_img = res_no_img.json()
    assert data_no_img["crop_name"] == "Black Pepper (ಕಾಳುಮೆಣಸು)"
    assert data_no_img["image_url"] is None

    # 2. Upload image and create investigation WITH image
    fake_png = b"\x89PNG\r\n\x1a\n" + b"\x00" * 80
    up_res = client.post(
        "/api/v1/forensics/upload-image",
        files={"file": ("pepper_wilt.png", io.BytesIO(fake_png), "image/png")},
        headers=headers,
    )
    assert up_res.status_code == 201
    img_info = up_res.json()

    inv_with_img = {
        "crop_name": "Black Pepper (ಕಾಳುಮೆಣಸು)",
        "symptoms_description": "Leaves wilting and dark lesions at vine collar",
        "affected_percentage": 15.0,
        "image_id": img_info["image_id"],
        "image_url": img_info["image_url"],
    }
    res_with_img = client.post("/api/v1/forensics/investigations", json=inv_with_img, headers=headers)
    assert res_with_img.status_code == 201
    data_with_img = res_with_img.json()
    assert data_with_img["image_url"] == img_info["image_url"]
