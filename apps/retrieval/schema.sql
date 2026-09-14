-- PlantPulse disease knowledge base
-- Postgres 15+ with pgvector

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

DROP TABLE IF EXISTS kb_chunk, kb_document, diy_remedy, treatment,
                     class_label, disease, pathogen, crop, active_ingredient CASCADE;
DROP TYPE IF EXISTS pathogen_type, control_class, curability,
                    evidence_level, efficacy_class CASCADE;

CREATE TYPE pathogen_type AS ENUM (
    'fungal', 'oomycete', 'bacterial', 'viral', 'phytoplasma',
    'arthropod_pest', 'nutrient_deficiency', 'abiotic', 'none'
);

CREATE TYPE control_class AS ENUM ('chemical', 'biological', 'cultural', 'physical');

-- curable    : chemical control can arrest and reverse an active infection
-- manageable : cannot be cured, but progression can be slowed / new growth protected
-- incurable  : no chemical control exists; removal + vector control only
CREATE TYPE curability AS ENUM ('curable', 'manageable', 'incurable');

CREATE TYPE evidence_level AS ENUM ('extension_guideline', 'peer_reviewed', 'anecdotal');

CREATE TYPE efficacy_class AS ENUM ('preventive', 'mild_curative', 'not_recommended');


CREATE TABLE crop (
    crop_id          text PRIMARY KEY,
    common_name      text NOT NULL,
    scientific_name  text NOT NULL,
    indoor_suitable  boolean NOT NULL DEFAULT false,
    care_notes       text
);

CREATE TABLE pathogen (
    pathogen_id      text PRIMARY KEY,
    scientific_name  text NOT NULL,
    synonyms         text[] NOT NULL DEFAULT '{}',
    type             pathogen_type NOT NULL,
    vector_organism  text,               -- insect vector, if any
    survival         text,               -- where inoculum overwinters
    notes            text
);

CREATE TABLE disease (
    disease_id            text PRIMARY KEY,
    crop_id               text NOT NULL REFERENCES crop(crop_id),
    pathogen_id           text REFERENCES pathogen(pathogen_id),   -- NULL for healthy classes
    common_name           text NOT NULL,
    curability            curability NOT NULL,
    is_healthy_class      boolean NOT NULL DEFAULT false,
    severity_default      smallint CHECK (severity_default BETWEEN 1 AND 5),
    symptoms              text,
    favorable_conditions  text,
    spread_mechanism      text,
    look_alikes           text[] NOT NULL DEFAULT '{}',  -- other disease_ids confusable by eye
    UNIQUE (crop_id, pathogen_id)
);

-- The only place the CNN's vocabulary touches the KB.
CREATE TABLE class_label (
    label       text PRIMARY KEY,        -- exact dataset folder string
    disease_id  text NOT NULL REFERENCES disease(disease_id),
    dataset     text NOT NULL,
    class_index smallint                 -- fill after you fix the training label order
);

CREATE TABLE active_ingredient (
    ai_id             text PRIMARY KEY,
    name              text NOT NULL,
    chemical_group    text,
    frac_code         text,   -- fungicide resistance group
    irac_code         text,   -- insecticide/acaricide resistance group
    mode_of_action    text,
    is_multisite      boolean NOT NULL DEFAULT false,
    organic_approved  boolean NOT NULL DEFAULT false,
    hazard_notes      text
);

CREATE TABLE treatment (
    treatment_id      bigserial PRIMARY KEY,
    disease_id        text NOT NULL REFERENCES disease(disease_id),
    ai_id             text REFERENCES active_ingredient(ai_id),  -- NULL for cultural controls
    control_class     control_class NOT NULL,
    title             text NOT NULL,
    instructions      text NOT NULL,
    priority          smallint NOT NULL DEFAULT 5,  -- 1 = show first

    -- Dose fields are deliberately nullable. Nothing renders until verified = true.
    dose_value        numeric,
    dose_unit         text,          -- 'g/L', 'ml/L', '%'
    dose_basis        text,          -- 'foliar spray', 'soil drench'
    interval_days     smallint,
    max_applications  smallint,
    phi_days          smallint,      -- pre-harvest interval

    efficacy_note     text,
    evidence          evidence_level,
    region            text NOT NULL DEFAULT 'IN',
    label_registered  boolean,       -- registered for THIS crop in `region`
    verified          boolean NOT NULL DEFAULT false,
    source_tier       text NOT NULL DEFAULT 'none',  -- label | research | none
    source_name       text,
    source_url        text,
    retrieved_on      date,

    CONSTRAINT dose_needs_source
        CHECK (verified = false OR source_url IS NOT NULL),
    CONSTRAINT chemical_needs_ai
        CHECK (control_class <> 'chemical' OR ai_id IS NOT NULL),
    CONSTRAINT source_tier_valid
        CHECK (source_tier IN ('label', 'research', 'none')),
    -- only a registered label may carry the verified certification
    CONSTRAINT verified_is_label
        CHECK (verified = false OR source_tier = 'label')
);

CREATE TABLE diy_remedy (
    diy_id            text PRIMARY KEY,
    disease_id        text NOT NULL REFERENCES disease(disease_id),
    title             text NOT NULL,
    ingredients       jsonb NOT NULL,   -- [{item, quantity, unit, home_available}]
    steps             text NOT NULL,
    prep_time_hours   numeric,
    efficacy          efficacy_class NOT NULL,
    feasibility_score smallint CHECK (feasibility_score BETWEEN 1 AND 5),
    safety_notes      text,
    evidence          evidence_level,
    verified          boolean NOT NULL DEFAULT false,
    source_url        text
);

-- Source documents scraped/collected from extension literature.
CREATE TABLE kb_document (
    doc_id        bigserial PRIMARY KEY,
    disease_id    text NOT NULL REFERENCES disease(disease_id),
    section       text NOT NULL,   -- symptoms | cause | treatment | prevention | diy
    title         text,
    content       text NOT NULL,
    source_name   text,
    source_url    text,
    retrieved_on  date NOT NULL DEFAULT CURRENT_DATE
);

CREATE TABLE kb_chunk (
    chunk_id    bigserial PRIMARY KEY,
    doc_id      bigint NOT NULL REFERENCES kb_document(doc_id) ON DELETE CASCADE,
    disease_id  text NOT NULL REFERENCES disease(disease_id),
    section     text NOT NULL,
    content     text NOT NULL,
    token_count int,
    embedding   vector(384)      -- bge-small-en-v1.5 / all-MiniLM-L6-v2
);

-- Metadata filter comes FIRST in retrieval, so index it.
CREATE INDEX kb_chunk_disease_idx ON kb_chunk (disease_id, section);
CREATE INDEX kb_chunk_embed_idx   ON kb_chunk USING hnsw (embedding vector_cosine_ops);
CREATE INDEX kb_chunk_trgm_idx    ON kb_chunk USING gin (content gin_trgm_ops);  -- hybrid BM25-ish
CREATE INDEX treatment_disease_idx ON treatment (disease_id, verified, priority);


-- What the API should actually read. Unverified doses are stripped here,
-- so a bug in application code cannot leak an unverified dosage.
CREATE VIEW treatment_safe AS
SELECT t.treatment_id, t.disease_id, t.control_class, t.title, t.instructions,
       t.priority, ai.name AS active_ingredient, ai.frac_code, ai.irac_code,
       ai.organic_approved, ai.hazard_notes,
       -- reveal the dose for label (verified) and research tiers; hide it for 'none'.
       -- source_tier travels with it so the UI shows a "research-suggested" badge
       -- on anything that is not verified.
       CASE WHEN t.source_tier IN ('label','research') THEN t.dose_value END    AS dose_value,
       CASE WHEN t.source_tier IN ('label','research') THEN t.dose_unit  END    AS dose_unit,
       CASE WHEN t.source_tier IN ('label','research') THEN t.dose_basis END    AS dose_basis,
       CASE WHEN t.source_tier IN ('label','research') THEN t.interval_days END AS interval_days,
       CASE WHEN t.source_tier IN ('label','research') THEN t.phi_days END      AS phi_days,
       t.verified, t.source_tier, t.label_registered, t.source_name, t.source_url
FROM treatment t
LEFT JOIN active_ingredient ai ON ai.ai_id = t.ai_id;
