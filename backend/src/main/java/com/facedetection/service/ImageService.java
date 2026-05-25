package com.facedetection.service;

import com.facedetection.dto.FaceMatchDto;
import com.facedetection.dto.ImageDto;
import com.facedetection.entity.FaceMatch;
import com.facedetection.entity.ImageRecord;
import com.facedetection.repository.FaceMatchRepository;
import com.facedetection.repository.ImageRepository;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class ImageService {

    private final ImageRepository imageRepository;
    private final FaceMatchRepository faceMatchRepository;
    private final PythonAIService pythonAIService;
    private final Path uploadPath;

    @Transactional
    public ImageDto.UploadResponse uploadAndDetect(MultipartFile file,
                                                    String model,
                                                    String detectorBackend) throws IOException {
        validateImageFile(file);

        String storedFilename = UUID.randomUUID() + "_" + file.getOriginalFilename();
        Path filePath = uploadPath.resolve(storedFilename);
        Files.copy(file.getInputStream(), filePath, StandardCopyOption.REPLACE_EXISTING);
        log.info("Saved uploaded file: {}", filePath);

        ImageRecord record = ImageRecord.builder()
                .originalFilename(file.getOriginalFilename())
                .storedFilename(storedFilename)
                .filePath(filePath.toString())
                .fileSize(file.getSize())
                .contentType(file.getContentType())
                .processingStatus(ImageRecord.ProcessingStatus.PENDING)
                .build();
        record = imageRepository.save(record);

        record.setProcessingStatus(ImageRecord.ProcessingStatus.PROCESSING);
        imageRepository.save(record);

        FaceMatchDto.DetectionResult detectionResult =
                pythonAIService.detectFaces(filePath.toString(), model, detectorBackend);

        if (detectionResult.isSuccess()) {
            record.setFaceCount(detectionResult.getFaceCount());
            record.setMetadata(detectionResult.getMetadata());
            record.setProcessingStatus(ImageRecord.ProcessingStatus.COMPLETED);
        } else {
            log.warn("Detection failed for {}: {}", storedFilename, detectionResult.getError());
            record.setFaceCount(0);
            record.setProcessingStatus(ImageRecord.ProcessingStatus.FAILED);
        }
        record.setProcessedAt(LocalDateTime.now());
        imageRepository.save(record);

        return ImageDto.UploadResponse.builder()
                .id(record.getId())
                .originalFilename(record.getOriginalFilename())
                .storedFilename(record.getStoredFilename())
                .fileSize(record.getFileSize())
                .contentType(record.getContentType())
                .processingStatus(record.getProcessingStatus())
                .uploadedAt(record.getUploadedAt())
                .message(detectionResult.isSuccess()
                        ? "Detected " + record.getFaceCount() + " face(s)"
                        : "Detection failed: " + detectionResult.getError())
                .build();
    }

    @Transactional
    public FaceMatchDto.MatchResult compareImages(FaceMatchDto.CompareImagesRequest request) {
        ImageRecord source = imageRepository.findById(request.getImageId1())
                .orElseThrow(() -> new EntityNotFoundException("Image not found: " + request.getImageId1()));
        ImageRecord target = imageRepository.findById(request.getImageId2())
                .orElseThrow(() -> new EntityNotFoundException("Image not found: " + request.getImageId2()));

        FaceMatchDto.ComparisonResult result = pythonAIService.compareFaces(
                source.getFilePath(),
                target.getFilePath(),
                request.getModel(),
                request.getDetectorBackend()
        );

        if (!result.isSuccess()) {
            throw new IllegalStateException("Face comparison failed: " + result.getError());
        }

        FaceMatch match = FaceMatch.builder()
                .sourceImage(source)
                .matchedImage(target)
                .isMatch(result.isMatch())
                .confidenceScore(result.getConfidenceScore())
                .distance(result.getDistance())
                .modelUsed(result.getModel())
                .detectorBackend(result.getDetectorBackend())
                .faceRegion(result.getFaceRegion())
                .build();
        match = faceMatchRepository.save(match);

        return toMatchResult(match);
    }

    @Transactional(readOnly = true)
    public ImageDto.ImageDetail getImageById(Long id) {
        ImageRecord record = imageRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Image not found: " + id));

        List<FaceMatchDto.MatchResult> matches = faceMatchRepository
                .findBySourceImageId(id)
                .stream()
                .map(this::toMatchResult)
                .collect(Collectors.toList());

        return ImageDto.ImageDetail.builder()
                .id(record.getId())
                .originalFilename(record.getOriginalFilename())
                .storedFilename(record.getStoredFilename())
                .fileSize(record.getFileSize())
                .contentType(record.getContentType())
                .faceCount(record.getFaceCount())
                .processingStatus(record.getProcessingStatus())
                .metadata(record.getMetadata())
                .uploadedAt(record.getUploadedAt())
                .processedAt(record.getProcessedAt())
                .faceMatches(matches)
                .build();
    }

    @Transactional(readOnly = true)
    public Page<ImageDto.ImageSummary> getAllImages(int page, int size) {
        Pageable pageable = PageRequest.of(page, size);
        return imageRepository.findAllByOrderByUploadedAtDesc(pageable)
                .map(r -> ImageDto.ImageSummary.builder()
                        .id(r.getId())
                        .originalFilename(r.getOriginalFilename())
                        .faceCount(r.getFaceCount())
                        .fileSize(r.getFileSize())
                        .contentType(r.getContentType())
                        .processingStatus(r.getProcessingStatus())
                        .uploadedAt(r.getUploadedAt())
                        .build());
    }

    @Transactional(readOnly = true)
    public ImageDto.Stats getStats() {
        return ImageDto.Stats.builder()
                .totalImages(imageRepository.count())
                .pendingImages(imageRepository.countByStatus(ImageRecord.ProcessingStatus.PENDING))
                .completedImages(imageRepository.countByStatus(ImageRecord.ProcessingStatus.COMPLETED))
                .failedImages(imageRepository.countByStatus(ImageRecord.ProcessingStatus.FAILED))
                .totalMatches(faceMatchRepository.count())
                .build();
    }

    @Transactional(readOnly = true)
    public List<FaceMatchDto.MatchResult> getMatchesForImage(Long imageId) {
        return faceMatchRepository.findAllMatchesForImage(imageId)
                .stream()
                .map(this::toMatchResult)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public ImageDto.ImageFile getImageFile(Long id) {
        ImageRecord record = imageRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Image not found: " + id));

        try {
            Path filePath = Path.of(record.getFilePath()).toAbsolutePath().normalize();
            if (!Files.exists(filePath) || !Files.isRegularFile(filePath)) {
                throw new EntityNotFoundException("Image file not found: " + id);
            }

            Resource resource = new UrlResource(filePath.toUri());
            return ImageDto.ImageFile.builder()
                    .resource(resource)
                    .contentType(record.getContentType())
                    .build();
        } catch (Exception e) {
            if (e instanceof EntityNotFoundException) {
                throw (EntityNotFoundException) e;
            }
            throw new IllegalStateException("Could not read image file", e);
        }
    }

    @Transactional
    public void deleteImage(Long id) throws IOException {
        ImageRecord record = imageRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Image not found: " + id));

        Path filePath = Path.of(record.getFilePath());
        if (Files.exists(filePath)) {
            Files.delete(filePath);
        }

        imageRepository.delete(record);
        log.info("Deleted image record and file: {}", record.getStoredFilename());
    }

    private void validateImageFile(MultipartFile file) {
        if (file.isEmpty()) {
            throw new IllegalArgumentException("Uploaded file is empty");
        }
        String contentType = file.getContentType();
        if (contentType == null || !contentType.startsWith("image/")) {
            throw new IllegalArgumentException("File must be an image. Got: " + contentType);
        }
        if (file.getSize() > 10 * 1024 * 1024) {
            throw new IllegalArgumentException("File size exceeds 10MB limit");
        }
    }

    private FaceMatchDto.MatchResult toMatchResult(FaceMatch match) {
        return FaceMatchDto.MatchResult.builder()
                .id(match.getId())
                .sourceImageId(match.getSourceImage() != null ? match.getSourceImage().getId() : null)
                .matchedImageId(match.getMatchedImage() != null ? match.getMatchedImage().getId() : null)
                .confidenceScore(match.getConfidenceScore())
                .distance(match.getDistance())
                .isMatch(match.getIsMatch())
                .modelUsed(match.getModelUsed())
                .matchedAt(match.getMatchedAt())
                .build();
    }
}
