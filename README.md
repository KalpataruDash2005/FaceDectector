Face Timeline Studio

Dark-mode local face intelligence app with a static frontend, Spring Boot API, PostgreSQL, and a Python DeepFace/OpenCV service.

Project path:

```text
D:\Coading World\face-detection-latest
```

Run full app with Docker:

```bash
cd "D:\Coading World\face-detection-latest"
docker compose up --build
```

Open:

```text
http://localhost:3000
```

Docker service URLs:

```text
Frontend: http://localhost:3000
Backend:  http://localhost:18081/api/v1
AI:       http://localhost:18001
Database: localhost:15433
```

Run backend from IntelliJ:

```text
1. Stop the backend container if it is running.
2. Keep postgres and ai-service running with Docker.
3. Open D:\Coading World\face-detection-latest\backend in IntelliJ.
4. Use Java 17 or newer.
5. Run com.facedetection.FaceDetectionApplication.
```

Start only backend dependencies for IntelliJ:

```bash
cd "D:\Coading World\face-detection-latest"
docker compose up --build postgres ai-service
```

IntelliJ backend defaults:

```text
Backend:  http://localhost:8080/api/v1
Database: jdbc:postgresql://localhost:15433/facedetection
DB user:  faceuser
DB pass:  facepass
AI:       http://localhost:18001
Uploads:  D:/Coading World/face-detection-latest/uploads
```

Studio features:

```text
Face Timeline Studio
Movie Character Look Lab
Local Doppelganger Finder
Face Quality Analyzer
Disguise / Look Change Detector
Cinematic Identity Board
Missing Poster / ID Card Generator
AI Fake Photo Detector
```

Useful endpoints:

```text
GET    /api/v1/health
GET    /api/v1/stats
GET    /api/v1/images
GET    /api/v1/images/{id}
GET    /api/v1/images/{id}/file
GET    /api/v1/images/{id}/studio-analysis
POST   /api/v1/images/upload
POST   /api/v1/images/compare
DELETE /api/v1/images/{id}
```

The AI fake-photo detector is a local heuristic based on texture, edge density, smoothness, and symmetry. Treat it as a review signal, not a guaranteed authenticity verdict.
