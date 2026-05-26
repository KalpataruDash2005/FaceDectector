package com.facedetection.controller;

import com.facedetection.dto.FaceMatchDto;
import com.facedetection.dto.ImageDto;
import com.facedetection.service.ImageService;
import com.facedetection.service.PythonAIService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
@Slf4j
@CrossOrigin(origins = "*")
public class ImageController {

    private final ImageService imageService;
    private final PythonAIService pythonAIService;

    @GetMapping("/health")
    public ResponseEntity<Map<String, Object>> health() {
        boolean aiHealthy = pythonAIService.isAiServiceHealthy();
        return ResponseEntity.ok(Map.of(
                "status", "UP",
                "backend", "Spring Boot",
                "aiService", aiHealthy ? "UP" : "DOWN"
        ));
    }

    @PostMapping(value = "/images/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ImageDto.UploadResponse> uploadImage(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "model", defaultValue = "VCG-Face") String model,
            @RequestParam(value = "detectorBackend", defaultValue = "opencv") String detectorBackend) {

        log.info("Upload request: file={}, model={}, detector={}",
                file.getOriginalFilename(), model, detectorBackend);
        try {
            ImageDto.UploadResponse response = imageService.uploadAndDetect(file, model, detectorBackend);
            return ResponseEntity.status(HttpStatus.CREATED).body(response);
        } catch (IllegalArgumentException e) {
            throw e;
        } catch (Exception e) {
            log.error("Upload failed: {}", e.getMessage(), e);
            return ResponseEntity.internalServerError().build();
        }
    }

    @PostMapping("/images/compare")
    public ResponseEntity<FaceMatchDto.MatchResult> compareImages(
            @RequestBody FaceMatchDto.CompareImagesRequest request) {

        log.info("Compare request: image {} vs image {}", request.getImageId1(), request.getImageId2());
        try {
            FaceMatchDto.MatchResult result = imageService.compareImages(request);
            return ResponseEntity.ok(result);
        } catch (jakarta.persistence.EntityNotFoundException e) {
            return ResponseEntity.notFound().build();
        } catch (IllegalArgumentException e) {
            throw e;
        } catch (Exception e) {
            log.error("Compare failed: {}", e.getMessage(), e);
            return ResponseEntity.internalServerError().build();
        }
    }

    @GetMapping("/images")
    public ResponseEntity<Page<ImageDto.ImageSummary>> getAllImages(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {

        Page<ImageDto.ImageSummary> result = imageService.getAllImages(page, size);
        return ResponseEntity.ok(result);
    }

    @GetMapping("/images/{id}")
    public ResponseEntity<ImageDto.ImageDetail> getImage(@PathVariable Long id) {
        try {
            return ResponseEntity.ok(imageService.getImageById(id));
        } catch (jakarta.persistence.EntityNotFoundException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @GetMapping("/images/{id}/file")
    public ResponseEntity<Resource> getImageFile(@PathVariable Long id) {
        ImageDto.ImageFile imageFile = imageService.getImageFile(id);
        MediaType mediaType = imageFile.getContentType() != null
                ? MediaType.parseMediaType(imageFile.getContentType())
                : MediaType.APPLICATION_OCTET_STREAM;

        return ResponseEntity.ok()
                .contentType(mediaType)
                .body(imageFile.getResource());
    }

    @GetMapping("/images/{id}/matches")
    public ResponseEntity<List<FaceMatchDto.MatchResult>> getMatches(@PathVariable Long id) {
        return ResponseEntity.ok(imageService.getMatchesForImage(id));
    }

    @GetMapping("/images/{id}/studio-analysis")
    public ResponseEntity<Map<String, Object>> analyzeImage(
            @PathVariable Long id,
            @RequestParam(value = "detectorBackend", defaultValue = "opencv") String detectorBackend) {
        return ResponseEntity.ok(imageService.analyzeImage(id, detectorBackend));
    }

    @GetMapping("/stats")
    public ResponseEntity<ImageDto.Stats> getStats() {
        return ResponseEntity.ok(imageService.getStats());
    }

    @DeleteMapping("/images/{id}")
    public ResponseEntity<Void> deleteImage(@PathVariable Long id) {
        try {
            imageService.deleteImage(id);
            return ResponseEntity.noContent().build();
        } catch (jakarta.persistence.EntityNotFoundException e) {
            return ResponseEntity.notFound().build();
        } catch (Exception e) {
            log.error("Delete failed: {}", e.getMessage(), e);
            return ResponseEntity.internalServerError().build();
        }
    }
}
