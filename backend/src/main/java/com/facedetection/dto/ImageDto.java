package com.facedetection.dto;

import com.facedetection.entity.ImageRecord;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.core.io.Resource;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

public class ImageDto {
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class UploadResponse {
        private Long id;
        private String originalFilename;
        private String storedFilename;
        private Long fileSize;
        private String contentType;
        private ImageRecord.ProcessingStatus processingStatus;
        private LocalDateTime uploadedAt;
        private String message;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ImageDetail {
        private Long id;
        private String originalFilename;
        private String storedFilename;
        private Long fileSize;
        private String contentType;
        private Integer faceCount;
        private ImageRecord.ProcessingStatus processingStatus;
        private String metadata;
        private LocalDateTime uploadedAt;
        private LocalDateTime processedAt;
        private List<FaceMatchDto.MatchResult> faceMatches;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ImageSummary {
        private Long id;
        private String originalFilename;
        private Integer faceCount;
        private Long fileSize;
        private String contentType;
        private ImageRecord.ProcessingStatus processingStatus;
        private LocalDateTime uploadedAt;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Stats {
        private long totalImages;
        private long pendingImages;
        private long completedImages;
        private long failedImages;
        private long totalMatches;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ImageFile {
        private Resource resource;
        private String contentType;
    }
}
