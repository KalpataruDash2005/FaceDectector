package com.facedetection.repository;

import com.facedetection.entity.ImageRecord;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ImageRepository extends JpaRepository<ImageRecord, Long> {

    Optional<ImageRecord> findByStoredFilename(String storedFilename);

    List<ImageRecord> findByProcessingStatus(ImageRecord.ProcessingStatus status);

    Page<ImageRecord> findAllByOrderByUploadedAtDesc(Pageable pageable);

    @Query("SELECT i FROM ImageRecord i WHERE i.faceCount > 0 ORDER BY i.uploadedAt DESC")
    List<ImageRecord> findAllWithFaces();

    @Query("SELECT COUNT(i) FROM ImageRecord i WHERE i.processingStatus = :status")
    long countByStatus(ImageRecord.ProcessingStatus status);
}
