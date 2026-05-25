package com.facedetection.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

public class FaceMatchDto {
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class DetectRequest {
        private String imagePath;
        private String model;
        private String detectorBackend;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CompareRequest {
        private String imagePath1;
        private String imagePath2;
        private String model;
        private String detectorBackend;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class DetectedFace {
        private int x;
        private int y;
        private int w;
        private int h;
        private double confidence;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class DetectionResult {
        private boolean success;
        private int faceCount;
        private List<DetectedFace> faces;
        private String error;
        private String metadata;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ComparisonResult {
        private boolean success;
        private boolean isMatch;
        private double distance;
        private double confidenceScore;
        private String model;
        private String detectorBackend;
        private String faceRegion;
        private String error;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class MatchResult {
        private Long id;
        private Long sourceImageId;
        private Long matchedImageId;
        private Double confidenceScore;
        private Double distance;
        private Boolean isMatch;
        private String modelUsed;
        private LocalDateTime matchedAt;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CompareImagesRequest {
        private Long imageId1;
        private Long imageId2;
        private String model;
        private String detectorBackend;
    }
}
