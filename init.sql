\c facedetection;

CREATE TABLE IF NOT EXISTS images (
    id                BIGSERIAL       PRIMARY KEY,
    original_filename VARCHAR(255)    NOT NULL,
    stored_filename   VARCHAR(255)    NOT NULL UNIQUE,
    file_path         TEXT            NOT NULL,
    file_size         BIGINT,
    content_type      VARCHAR(100),
    face_count        INTEGER         DEFAULT 0,
    processing_status VARCHAR(20)     NOT NULL DEFAULT 'PENDING'
                          CHECK (processing_status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED')),
    metadata          JSONB,
    uploaded_at       TIMESTAMP       NOT NULL DEFAULT NOW(),
    processed_at      TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_images_status       ON images (processing_status);
CREATE INDEX IF NOT EXISTS idx_images_uploaded_at  ON images (uploaded_at DESC);
CREATE INDEX IF NOT EXISTS idx_images_face_count   ON images (face_count);

CREATE TABLE IF NOT EXISTS face_matches (
    id                BIGSERIAL       PRIMARY KEY,
    source_image_id   BIGINT          NOT NULL REFERENCES images(id) ON DELETE CASCADE,
    matched_image_id  BIGINT          REFERENCES images(id) ON DELETE SET NULL,
    confidence_score  DOUBLE PRECISION,
    distance          DOUBLE PRECISION,
    model_used        VARCHAR(50),
    detector_backend  VARCHAR(50),
    face_region       JSONB,
    is_match          BOOLEAN,
    matched_at        TIMESTAMP       NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_matches_source     ON face_matches (source_image_id);
CREATE INDEX IF NOT EXISTS idx_matches_matched    ON face_matches (matched_image_id);
CREATE INDEX IF NOT EXISTS idx_matches_is_match   ON face_matches (is_match);
CREATE INDEX IF NOT EXISTS idx_matches_confidence ON face_matches (confidence_score DESC);
