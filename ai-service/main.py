import json
import os
import traceback

import cv2
import numpy as np
from deepface import DeepFace
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(
    title="Face Detection AI Service",
    description="Python microservice for face detection and recognition using DeepFace",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class DetectRequest(BaseModel):
    imagePath: str
    model: str = "VGG-Face"
    detectorBackend: str = "retinaface"


class CompareRequest(BaseModel):
    imagePath1: str
    imagePath2: str
    model: str = "VGG-Face"
    detectorBackend: str = "retinaface"


class AnalyzeRequest(BaseModel):
    imagePath: str
    detectorBackend: str = "retinaface"


class StudioAnalysisRequest(BaseModel):
    imagePath: str
    detectorBackend: str = "retinaface"


def validate_image_path(path: str) -> None:
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail=f"Image not found at path: {path}")
    if not os.path.isfile(path):
        raise HTTPException(status_code=400, detail=f"Path is not a file: {path}")


def read_image(path: str) -> np.ndarray:
    img = cv2.imread(path)
    if img is None:
        raise HTTPException(status_code=400, detail=f"Could not read image: {path}")
    return img


def get_image_metadata(path: str, img: np.ndarray) -> dict:
    h, w = img.shape[:2]
    channels = img.shape[2] if len(img.shape) == 3 else 1
    size_bytes = os.path.getsize(path)
    return {
        "width": w,
        "height": h,
        "channels": channels,
        "size_bytes": size_bytes,
    }


def clamp(value: float, low: float = 0.0, high: float = 100.0) -> float:
    return round(max(low, min(high, value)), 2)


def compute_quality(img: np.ndarray, faces: list) -> dict:
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    blur_score = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    brightness = float(np.mean(gray))
    contrast = float(np.std(gray))
    h, w = gray.shape[:2]

    sharpness_score = clamp(blur_score / 5)
    lighting_score = clamp(100 - abs(brightness - 128) * 0.8)
    contrast_score = clamp(contrast * 2.2)
    face_score = 35.0
    angle_label = "unknown"
    eye_visibility = "unknown"

    if faces:
        region = faces[0].get("facial_area", {})
        fw = float(region.get("w", 0))
        fh = float(region.get("h", 0))
        fx = float(region.get("x", 0))
        fy = float(region.get("y", 0))
        face_area_ratio = (fw * fh) / max(1.0, float(w * h))
        center_x = fx + fw / 2
        center_y = fy + fh / 2
        center_offset = abs(center_x - w / 2) / max(1.0, w / 2) + abs(center_y - h / 2) / max(1.0, h / 2)
        face_score = clamp(face_area_ratio * 420 - center_offset * 18)
        angle_label = "front-facing" if center_offset < 0.45 else "off-center"
        eye_visibility = "likely visible" if fh > 80 and fw > 80 else "uncertain"

    overall = clamp(sharpness_score * 0.3 + lighting_score * 0.25 + contrast_score * 0.2 + face_score * 0.25)
    use_case = "recognition"
    if overall >= 78 and face_score >= 55 and lighting_score >= 65:
        use_case = "passport or ID"
    elif overall >= 62:
        use_case = "profile photo"
    elif overall < 45:
        use_case = "needs retake"

    return {
        "overallScore": overall,
        "sharpnessScore": sharpness_score,
        "lightingScore": lighting_score,
        "contrastScore": contrast_score,
        "faceFramingScore": face_score,
        "blurVariance": round(blur_score, 2),
        "brightness": round(brightness, 2),
        "contrast": round(contrast, 2),
        "faceAngle": angle_label,
        "eyeVisibility": eye_visibility,
        "recommendedUse": use_case,
    }


def compute_fake_signal(img: np.ndarray) -> dict:
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    resized = cv2.resize(gray, (512, 512), interpolation=cv2.INTER_AREA)
    lap = cv2.Laplacian(resized, cv2.CV_64F)
    noise = float(np.std(lap))
    edges = cv2.Canny(resized, 80, 180)
    edge_density = float(np.mean(edges > 0))
    smoothness = 100.0 - clamp(noise / 2.5)
    symmetry = 0.0

    left = resized[:, :256]
    right = cv2.flip(resized[:, 256:], 1)
    symmetry = float(np.corrcoef(left.flatten(), right.flatten())[0, 1])
    if np.isnan(symmetry):
        symmetry = 0.0

    risk = 0.0
    risk += max(0.0, smoothness - 55) * 0.7
    risk += max(0.0, (0.015 - edge_density) * 1600)
    risk += max(0.0, symmetry - 0.82) * 55
    risk = clamp(risk)

    label = "low risk"
    if risk >= 68:
        label = "high risk"
    elif risk >= 38:
        label = "review needed"

    return {
        "riskScore": risk,
        "label": label,
        "noiseSignature": round(noise, 2),
        "edgeDensity": round(edge_density, 4),
        "symmetryScore": round(symmetry * 100, 2),
        "explanation": "Local heuristic based on smoothness, edge density, facial symmetry, and texture noise.",
    }


def extract_palette(img: np.ndarray) -> list:
    small = cv2.resize(img, (120, 120), interpolation=cv2.INTER_AREA)
    rgb = cv2.cvtColor(small, cv2.COLOR_BGR2RGB).reshape((-1, 3)).astype(np.float32)
    _, labels, centers = cv2.kmeans(
        rgb,
        5,
        None,
        (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 20, 1.0),
        3,
        cv2.KMEANS_PP_CENTERS,
    )
    counts = np.bincount(labels.flatten())
    order = np.argsort(counts)[::-1]
    palette = []
    for idx in order[:5]:
        color = centers[idx].astype(int)
        palette.append({
            "hex": "#{:02x}{:02x}{:02x}".format(int(color[0]), int(color[1]), int(color[2])),
            "weight": round(float(counts[idx]) / float(len(labels)), 3),
        })
    return palette


def summarize_identity(quality: dict, fake_signal: dict, expression: str, face_count: int) -> dict:
    confidence = clamp((quality["overallScore"] * 0.62) + ((100 - fake_signal["riskScore"]) * 0.25) + min(face_count, 1) * 13)
    if confidence >= 76:
        tier = "strong identity sample"
    elif confidence >= 55:
        tier = "usable identity sample"
    else:
        tier = "weak identity sample"
    return {
        "samePersonReadiness": confidence,
        "identityTier": tier,
        "expressionStyle": expression or "neutral",
        "roleTransformationScore": clamp(100 - confidence + fake_signal["riskScore"] * 0.25),
    }


@app.get("/health")
def health():
    return {
        "status": "UP",
        "service": "face-detection-ai",
        "version": "1.0.0",
    }


@app.post("/detect")
def detect_faces(request: DetectRequest):
    validate_image_path(request.imagePath)
    img = read_image(request.imagePath)
    metadata = get_image_metadata(request.imagePath, img)

    try:
        faces = DeepFace.extract_faces(
            img_path=request.imagePath,
            detector_backend=request.detectorBackend,
            enforce_detection=False,
        )

        face_list = []
        for face in faces:
            region = face.get("facial_area", {})
            confidence = face.get("confidence", 0.0)

            if confidence > 0.5 or len(faces) == 1:
                face_list.append({
                    "x": region.get("x", 0),
                    "y": region.get("y", 0),
                    "w": region.get("w", 0),
                    "h": region.get("h", 0),
                    "confidence": round(float(confidence), 4),
                })

        return {
            "success": True,
            "faceCount": len(face_list),
            "faces": face_list,
            "metadata": json.dumps(metadata),
            "error": None,
        }

    except Exception as e:
        print(f"[detect] Error: {e}")
        traceback.print_exc()
        return {
            "success": False,
            "faceCount": 0,
            "faces": [],
            "metadata": json.dumps(metadata),
            "error": str(e),
        }


@app.post("/compare")
def compare_faces(request: CompareRequest):
    validate_image_path(request.imagePath1)
    validate_image_path(request.imagePath2)

    try:
        result = DeepFace.verify(
            img1_path=request.imagePath1,
            img2_path=request.imagePath2,
            model_name=request.model,
            detector_backend=request.detectorBackend,
            enforce_detection=False,
        )

        distance = float(result.get("distance", 1.0))
        threshold = float(result.get("threshold", 0.4))
        is_match = bool(result.get("verified", False))
        confidence_score = round(max(0.0, (1.0 - distance / threshold) * 100), 2)

        facial_areas = result.get("facial_areas", {})
        face_region = json.dumps({
            "img1": facial_areas.get("img1", {}),
            "img2": facial_areas.get("img2", {}),
        })

        return {
            "success": True,
            "isMatch": is_match,
            "distance": round(distance, 6),
            "confidenceScore": confidence_score,
            "model": request.model,
            "detectorBackend": request.detectorBackend,
            "faceRegion": face_region,
            "error": None,
        }

    except Exception as e:
        print(f"[compare] Error: {e}")
        traceback.print_exc()
        return {
            "success": False,
            "isMatch": False,
            "distance": 1.0,
            "confidenceScore": 0.0,
            "model": request.model,
            "detectorBackend": request.detectorBackend,
            "faceRegion": "{}",
            "error": str(e),
        }


@app.post("/analyze")
def analyze_face(request: AnalyzeRequest):
    validate_image_path(request.imagePath)

    try:
        results = DeepFace.analyze(
            img_path=request.imagePath,
            actions=["age", "gender", "emotion", "race"],
            detector_backend=request.detectorBackend,
            enforce_detection=False,
        )

        if isinstance(results, list):
            analysis = results[0] if results else {}
        else:
            analysis = results

        return {
            "success": True,
            "faceCount": len(results) if isinstance(results, list) else 1,
            "results": [
                {
                    "age": analysis.get("age"),
                    "gender": analysis.get("dominant_gender"),
                    "emotion": analysis.get("dominant_emotion"),
                    "race": analysis.get("dominant_race"),
                    "region": analysis.get("region", {}),
                }
            ],
            "error": None,
        }

    except Exception as e:
        print(f"[analyze] Error: {e}")
        traceback.print_exc()
        return {
            "success": False,
            "faceCount": 0,
            "results": [],
            "error": str(e),
        }


@app.post("/studio-analysis")
def studio_analysis(request: StudioAnalysisRequest):
    validate_image_path(request.imagePath)
    img = read_image(request.imagePath)
    metadata = get_image_metadata(request.imagePath, img)

    try:
        faces = DeepFace.extract_faces(
            img_path=request.imagePath,
            detector_backend=request.detectorBackend,
            enforce_detection=False,
        )
    except Exception:
        faces = []

    face_list = []
    for face in faces:
        region = face.get("facial_area", {})
        confidence = face.get("confidence", 0.0)
        if confidence > 0.5 or len(faces) == 1:
            face_list.append({
                "x": region.get("x", 0),
                "y": region.get("y", 0),
                "w": region.get("w", 0),
                "h": region.get("h", 0),
                "confidence": round(float(confidence), 4),
            })

    expression = "neutral"
    demographic = {}
    try:
        analysis = DeepFace.analyze(
            img_path=request.imagePath,
            actions=["age", "gender", "emotion"],
            detector_backend=request.detectorBackend,
            enforce_detection=False,
        )
        if isinstance(analysis, list):
            analysis = analysis[0] if analysis else {}
        expression = analysis.get("dominant_emotion", "neutral")
        demographic = {
            "estimatedAge": analysis.get("age"),
            "dominantGender": analysis.get("dominant_gender"),
            "dominantEmotion": expression,
            "region": analysis.get("region", {}),
        }
    except Exception:
        demographic = {
            "estimatedAge": None,
            "dominantGender": None,
            "dominantEmotion": expression,
            "region": {},
        }

    quality = compute_quality(img, faces)
    fake_signal = compute_fake_signal(img)
    palette = extract_palette(img)
    identity = summarize_identity(quality, fake_signal, expression, len(face_list))

    return {
        "success": True,
        "metadata": metadata,
        "faceCount": len(face_list),
        "faces": face_list,
        "quality": quality,
        "fakePhoto": fake_signal,
        "palette": palette,
        "demographic": demographic,
        "identityCard": identity,
        "timeline": {
            "timelineReady": len(face_list) == 1 and quality["overallScore"] >= 45,
            "similarityDriftHint": "Compare this image with older or newer uploads to estimate visual drift.",
        },
        "missingPoster": {
            "reportReady": len(face_list) >= 1,
            "recommendedNote": "Use only consented images and add verified human notes before printing.",
        },
        "error": None,
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
