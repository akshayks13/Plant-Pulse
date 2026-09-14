# PlantPulse API - quick reference

Start the database and the server:

```bash
make up            # postgres (docker)
make api           # uvicorn on http://127.0.0.1:8001  (needs the venv active)
```

Interactive docs: http://127.0.0.1:8001/docs

Configuration is read from the environment or a `.env` file (see `.env.example`):
`DATABASE_URL`, optional `ANTHROPIC_API_KEY` (LLM explanations), optional
`SERPER_API_KEY` (product search). Without the optional keys the API still
works: explanations come from a template and the product list is honestly empty.

## GET /health

```bash
curl -s localhost:8001/health
# {"status":"ok","database":true,"kb_chunks":123,"llm_configured":false,"product_search_configured":false}
```

## POST /diagnose

Input is the CNN's output, not an image.

```bash
# normal disease -> treatments + explanation + products + DIY + disclaimer
curl -s -X POST localhost:8001/diagnose -H 'content-type: application/json' \
  -d '{"class_label":"Tomato_Late_blight","confidence":0.91}' | jq

# incurable -> removal / containment, no product lookup
curl -s -X POST localhost:8001/diagnose -H 'content-type: application/json' \
  -d '{"class_label":"Tomato_Tomato_Yellow_Leaf_Curl_Virus","confidence":0.95}' | jq

# healthy -> care guidance only
curl -s -X POST localhost:8001/diagnose -H 'content-type: application/json' \
  -d '{"class_label":"Tomato_healthy","confidence":0.88}' | jq

# low confidence -> "unsure" with candidates + a distinguishing question
curl -s -X POST localhost:8001/diagnose -H 'content-type: application/json' \
  -d '{"class_label":"Tomato_Early_blight","confidence":0.42}' | jq

# optional fields: runner_up (look-alike check), is_leaf (OOD guard), question
curl -s -X POST localhost:8001/diagnose -H 'content-type: application/json' \
  -d '{"class_label":"Tomato_Early_blight","confidence":0.85,
       "runner_up":{"class_label":"Tomato_Septoria_leaf_spot","confidence":0.10},
       "question":"can I make something at home for this?"}' | jq
```

Response shape (fields not relevant to a result type are empty, not missing):

```jsonc
{
  "result_type": "normal | unsure | incurable | healthy",
  "class_label": "Tomato_Late_blight",
  "confidence": 0.91,
  "disease": { "disease_id", "common_name", "crop", "pathogen", "pathogen_type",
               "curability", "is_healthy_class", "symptoms" },
  "candidates": [ { "disease_id", "common_name", "crop", "symptoms", "confidence" } ], // unsure only
  "question": "Look closely at the leaf. Do you see ...?",                            // unsure only
  "unsure_reason": "low_confidence | look_alike_runner_up | out_of_distribution",   // unsure only
  "explanation": { "summary", "why_it_happened", "treatment_steps": [], "prevention": [],
                   "citations": [ { "chunk_id", "section", "title", "source_name", "source_url" } ],
                   "generated_by": "llm | template", "note" },                        // null for unsure/healthy
  "treatments": [ { "title", "control_class", "instructions", "priority",
                    "active_ingredient", "frac_code", "irac_code", "organic_approved", "hazard_notes",
                    "dose_value", "dose_unit", "dose_basis", "interval_days", "phi_days",
                    "source_tier": "label | research | none",   // ALWAYS present
                    "verified", "label_registered", "source_name", "source_url" } ],
  "diy": [ { "title", "efficacy", "feasibility_score", "ingredients", "steps",
             "safety_notes", "honesty_note", "source_url" } ],
  "products": [ { "name", "price", "currency", "price_text", "vendor", "url",
                  "concentration", "verified_by", "retrieved_at" } ],
  "product_note": "...", "product_ingredient": "Mancozeb", "products_searched_at": null,
  "care": { "care_notes", "watch_for" },          // healthy only
  "message": "...", "report_prompt": "...",       // incurable (report_prompt: HLB only)
  "retrieval": { "chunks_used": [...], "best_score": 0.84, "note": null },
  "disclaimer": "..."                             // always present
}
```

Rendering rule for a consumer: show `dose_value dose_unit` only together with
its `source_tier`. `label` = registered dose. `research` = show with a
"research-suggested, not a registered dose" badge. `none` = dose fields are
null; show the active ingredient and the instructions only.

## GET /disease/{disease_id}

Everything the knowledge base holds for one disease. Useful without the CNN.

```bash
curl -s localhost:8001/disease/D_TOMATO_LATE_BLIGHT | jq
curl -s localhost:8001/disease/H_TOMATO | jq          # a healthy class
```

## GET /retrieve  (debug)

Ranked chunks for one disease. If `section` is omitted the keyword router picks
one from the question; pass `section=all` to search every section.

```bash
curl -s "localhost:8001/retrieve?disease_id=D_TOMATO_LATE_BLIGHT&q=how%20do%20I%20treat%20late%20blight" | jq
curl -s "localhost:8001/retrieve?disease_id=D_TOMATO_LATE_BLIGHT&q=why%20did%20this%20happen&section=cause&k=3" | jq
curl -s "localhost:8001/retrieve?disease_id=D_TOMATO_LATE_BLIGHT&q=late%20blight&section=all&k=10" | jq
```

## Errors

- `404` unknown `class_label` or `disease_id`
- `400` bad `section` on `/retrieve`
- `422` request body fails validation (e.g. confidence outside 0-1)

## Tests

```bash
python test_pipeline.py     # runs the handoff verification checks against the live DB
```
