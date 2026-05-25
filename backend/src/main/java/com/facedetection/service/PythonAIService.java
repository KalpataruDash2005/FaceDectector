package com.facedetection.service;

import com.facedetection.dto.FaceMatchDto;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

@Service
@RequiredArgsConstructor
@Slf4j
public class PythonAIService {

    private final RestTemplate restTemplate;

    @Value("${app.ai.service.url}")
    private String aiServiceUrl;

    public FaceMatchDto.DetectionResult detectFaces(String imagePath, String model, String detectorBackend) {
        String url = aiServiceUrl + "/detect";

        FaceMatchDto.DetectRequest request = FaceMatchDto.DetectRequest.builder()
                .imagePath(imagePath)
                .model(model != null ? model : "VGG-Face")
                .detectorBackend(detectorBackend != null ? detectorBackend : "retinaface")
                .build();

        try {
            log.debug("Calling AI service for face detection: {}", imagePath);
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<FaceMatchDto.DetectRequest> entity = new HttpEntity<>(request, headers);

            ResponseEntity<FaceMatchDto.DetectionResult> response =
                    restTemplate.postForEntity(url, entity, FaceMatchDto.DetectionResult.class);

            if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
                log.debug("Detection successful, faces found: {}", response.getBody().getFaceCount());
                return response.getBody();
            }

            log.warn("AI service returned non-OK status: {}", response.getStatusCode());
            FaceMatchDto.DetectionResult failed = new FaceMatchDto.DetectionResult();
            failed.setSuccess(false);
            failed.setError("AI service returned: " + response.getStatusCode());
            return failed;

        } catch (RestClientException e) {
            log.error("Error calling AI service for detection: {}", e.getMessage());
            FaceMatchDto.DetectionResult failed = new FaceMatchDto.DetectionResult();
            failed.setSuccess(false);
            failed.setError("Could not reach AI service: " + e.getMessage());
            return failed;
        }
    }

    public FaceMatchDto.ComparisonResult compareFaces(String imagePath1, String imagePath2,
                                                       String model, String detectorBackend) {
        String url = aiServiceUrl + "/compare";

        FaceMatchDto.CompareRequest request = FaceMatchDto.CompareRequest.builder()
                .imagePath1(imagePath1)
                .imagePath2(imagePath2)
                .model(model != null ? model : "VGG-Face")
                .detectorBackend(detectorBackend != null ? detectorBackend : "retinaface")
                .build();

        try {
            log.debug("Calling AI service for face comparison: {} vs {}", imagePath1, imagePath2);
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<FaceMatchDto.CompareRequest> entity = new HttpEntity<>(request, headers);

            ResponseEntity<FaceMatchDto.ComparisonResult> response =
                    restTemplate.postForEntity(url, entity, FaceMatchDto.ComparisonResult.class);

            if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
                log.debug("Comparison done. Match: {}, Score: {}",
                        response.getBody().isMatch(), response.getBody().getConfidenceScore());
                return response.getBody();
            }

            FaceMatchDto.ComparisonResult failed = new FaceMatchDto.ComparisonResult();
            failed.setSuccess(false);
            failed.setError("AI service returned: " + response.getStatusCode());
            return failed;

        } catch (RestClientException e) {
            log.error("Error calling AI service for comparison: {}", e.getMessage());
            FaceMatchDto.ComparisonResult failed = new FaceMatchDto.ComparisonResult();
            failed.setSuccess(false);
            failed.setError("Could not reach AI service: " + e.getMessage());
            return failed;
        }
    }

    public boolean isAiServiceHealthy() {
        try {
            ResponseEntity<String> response =
                    restTemplate.getForEntity(aiServiceUrl + "/health", String.class);
            return response.getStatusCode() == HttpStatus.OK;
        } catch (Exception e) {
            log.warn("AI service health check failed: {}", e.getMessage());
            return false;
        }
    }
}
