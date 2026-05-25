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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
