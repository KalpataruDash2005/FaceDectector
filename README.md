Face Detection

Production-ready face detection app with a static frontend, Spring Boot API, PostgreSQL, and a Python DeepFace service.

Project path:

```text
D:\Coading World\face-detection
```

Run full app with Docker:

```bash
cd "D:\Coading World\face-detection"
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
3. Open D:\Coading World\face-detection\backend in IntelliJ.
4. Use Java 17 or newer.
5. Run com.facedetection.FaceDetectionApplication.
```

Start only backend dependencies for IntelliJ:

```bash
cd "D:\Coading World\face-detection"
docker compose up --build postgres ai-service
```

IntelliJ backend defaults:

```text
Backend:  http://localhost:8080/api/v1
Database: jdbc:postgresql://localhost:15433/facedetection
DB user:  faceuser
DB pass:  facepass
AI:       http://localhost:18001
Uploads:  D:/Coading World/face-detection/uploads
```

If Docker says a container name is already in use, the project no longer creates fixed container names. Run this once to stop old containers from the previous configuration:

```bash
docker stop facedetection-db facedetection-ai facedetection-backend facedetection-frontend
```

Main features:

```text
Upload images
Detect face count
Preview uploaded images
Compare two completed uploads
View image metadata and match history
Delete uploaded image records
Check backend and AI health
```

Useful endpoints:

```text
GET    /api/v1/health
GET    /api/v1/stats
GET    /api/v1/images
GET    /api/v1/images/{id}
GET    /api/v1/images/{id}/file
POST   /api/v1/images/upload
POST   /api/v1/images/compare
DELETE /api/v1/images/{id}
```

