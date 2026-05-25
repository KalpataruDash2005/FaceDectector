package com.facedetection.repository;

import com.facedetection.entity.FaceMatch;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface FaceMatchRepository extends JpaRepository<FaceMatch, Long> {

    List<FaceMatch> findBySourceImageId(Long sourceImageId);

    List<FaceMatch> findByMatchedImageId(Long matchedImageId);

    @Query("SELECT fm FROM FaceMatch fm WHERE fm.sourceImage.id = :imageId OR fm.matchedImage.id = :imageId ORDER BY fm.confidenceScore DESC")
    List<FaceMatch> findAllMatchesForImage(Long imageId);

    @Query("SELECT fm FROM FaceMatch fm WHERE fm.isMatch = true AND fm.confidenceScore >= :minScore ORDER BY fm.confidenceScore DESC")
    List<FaceMatch> findHighConfidenceMatches(Double minScore);
}
