package com.facedetection.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;

@Entity
@Table(name = "face_matches")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class FaceMatch {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "source_image_id", nullable = false)
    private ImageRecord sourceImage;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "matched_image_id")
    private ImageRecord matchedImage;

    @Column(name = "confidence_score")
    private Double confidenceScore;

    @Column(name = "distance")
    private Double distance;

    @Column(name = "model_used")
    private String modelUsed;

    @Column(name = "detector_backend")
    private String detectorBackend;

    @Column(name = "face_region", columnDefinition = "jsonb")
    @JdbcTypeCode(SqlTypes.JSON)
    private String faceRegion;

    @Column(name = "is_match")
    private Boolean isMatch;

    @Column(name = "matched_at")
    private LocalDateTime matchedAt;

    @PrePersist
    protected void onCreate() {
        matchedAt = LocalDateTime.now();
    }
}
