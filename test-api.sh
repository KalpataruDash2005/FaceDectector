#!/bin/bash

BASE_URL="http://localhost:18081/api/v1"
AI_URL="http://localhost:18001"

echo ""
echo "Face Detection API Tests"
echo ""

echo "1. Spring Boot health"
curl -s "$BASE_URL/health" | python3 -m json.tool
echo ""

echo "2. Python AI service health"
curl -s "$AI_URL/health" | python3 -m json.tool
echo ""

echo "3. System stats"
curl -s "$BASE_URL/stats" | python3 -m json.tool
echo ""

echo "4. Uploading test image"

TEST_IMAGE="./test-image.jpg"
if [ ! -f "$TEST_IMAGE" ]; then
  echo "No test image found at $TEST_IMAGE"
  echo "Place a JPEG named test-image.jpg in this directory and re-run."
else
  UPLOAD_RESPONSE=$(curl -s -X POST "$BASE_URL/images/upload" \
    -F "file=@$TEST_IMAGE" \
    -F "model=VGG-Face" \
    -F "detectorBackend=retinaface")
  echo "$UPLOAD_RESPONSE" | python3 -m json.tool
  IMAGE_ID=$(echo "$UPLOAD_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['id'])" 2>/dev/null)
  echo "Uploaded image ID: $IMAGE_ID"
  echo ""

  if [ -n "$IMAGE_ID" ]; then
    echo "5. Get image detail"
    curl -s "$BASE_URL/images/$IMAGE_ID" | python3 -m json.tool
    echo ""
  fi
fi

echo "6. List all images"
curl -s "$BASE_URL/images?page=0&size=5" | python3 -m json.tool
echo ""

echo "Tests complete."
echo ""

