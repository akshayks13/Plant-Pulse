# PlantPulse - user guide

PlantPulse is the "treatment brain" behind a plant-disease app for home, indoor
and balcony growers. This guide has two parts. Part 1 explains what the system
does and how to read its answers. Part 2 explains how it is built, for a
reviewer or developer. The system is API-only today; there is no screen yet.

---

## Part 1 - What it does

### In three sentences

PlantPulse takes a leaf-disease diagnosis (the name of the disease and how sure
the image model is) and returns how to treat it. The answer covers what causes
the disease, the treatment with its dosage where a trustworthy dosage exists,
products you could buy, and a home-made option where one is sensible. It is
built to say "I don't know" rather than guess, because a wrong dose on a food
plant is a real harm.

### Who it is for, and the flow

It is for someone growing a few plants at home, not a commercial farm. The
intended flow is:

1. You photograph **one affected leaf**, filling the frame, in daylight.
2. A separate image model (a CNN trained on the PlantVillage dataset, 38
   classes across 14 crops) names the disease and gives a confidence score.
3. PlantPulse takes that name and score and returns the treatment answer.

The image model and any future app screen are separate pieces. PlantPulse is
reached over an API (see `README_API.md`); a screen will sit on top of it later.

### How to read a result

Every answer has a `result_type`. There are four:

**normal** - a disease was recognised with enough confidence. You get:

- an explanation (what it is, why it happened, treatment steps, prevention),
  with citations to the passages it was written from;
- a list of treatments in priority order (cultural steps first where they
  matter most, then chemical and biological options);
- home-made (DIY) remedies, if any are recorded;
- purchasable products for the registered active ingredient, if product search
  is configured and a verified match was found;
- the standing safety disclaimer.

**unsure** - the model was not confident, or its second guess is a known
look-alike of its first guess, or the picture does not look like a leaf. No
treatment is given yet. Instead you get the candidate diseases, their
symptoms, and one question to answer by looking at the leaf, for example
"do you see concentric rings (early blight) or many tiny spots with black dots
(Septoria)?". Confirm the disease, then ask again with the confirmed label.

**incurable** - the disease has no cure (tomato yellow leaf curl virus, tomato
mosaic virus, citrus greening / HLB, grape esca). You get a removal-and-
containment plan: remove and bag the plant, protect the plants around it, and
do not buy anything hoping to cure it. Products are never suggested. For citrus
greening (HLB) the answer also asks you to **report it to your local
agriculture department**, because it is a regulated disease.

**healthy** - no disease was detected. You get care tips for that crop and a
note on the first warning sign to watch for. No treatments, no products.

### Reading a dose: "Registered" vs "Research-suggested"

Every treatment carries a `source_tier`. It tells you how much to trust a
number:

| source_tier | Meaning | What you see |
|---|---|---|
| `label` | A registered, per-litre rate for this exact crop from an official label or extension bulletin. `verified` is true. | The dose, shown as authoritative ("Registered"). |
| `research` | A rate from a study or a neighbouring crop. Not registered for this crop. | The dose, but it **must** be badged "research-suggested, not a registered dose". |
| `none` | No reliable rate on file. | No number at all. Only the active ingredient and qualitative instructions. |

A dose without its tier should never be shown. The API always sends the tier
with the dose so a screen can badge it.

DIY remedies also carry an honesty label (`efficacy`): `preventive` means it
helps stop a problem starting and will **not** cure an established infection;
`mild_curative` means it can help on an early, light infection. Safety notes
are always included.

### Safety notes

- This is guidance, not a prescription. A local agricultural extension officer
  or Krishi Vigyan Kendra outranks this system for anything serious.
- Always follow the product label for dose, timing and pre-harvest interval.
- Wear gloves, a mask and eye protection when mixing or spraying.
- Prices and product links are live snapshots and can be out of date. Check the
  vendor page before buying.

---

## Part 2 - How it works

### The pipeline, in order

```
 leaf photo -> CNN (external, Colab) -> (class_label, confidence)
                                              |
                       class_label -> disease_id   (class_label table)
                                              |
        +---------------------+---------------+-----------------------+
        v                     v                                       v
  confidence gate      structured lookup                       retrieval layer
  (unsure / OOD)       treatment_safe, diy_remedy,             pgvector: filter by
        |              disease, crop                           disease_id + section,
        |                     |                                then rank by similarity
        |                     v                                       |
        +------------> ANSWER ASSEMBLER  <---- LLM composer writes from the
                       (pipeline.py)          retrieved chunks + rows only
                              |
              +---------------+---------------+
              v               v               v
       product lookup    DIY remedies    disclaimer + citations
       (live, cached)                    + source_tier on each dose
              |
              v
        FastAPI  (app.py)  ->  JSON
```

Files, in the order they run:

| File | Role |
|---|---|
| `app.py` | FastAPI: `POST /diagnose`, `GET /disease/{id}`, `GET /retrieve`, `GET /health` |
| `pipeline.py` | Resolves the label, applies the confidence gate, branches on healthy / incurable / normal, assembles the JSON |
| `retrieval.py` | Filter-then-rank vector search over `kb_chunk`; keyword router from question to section |
| `compose.py` | Writes the explanation from the retrieved chunks and rows (Claude if configured, template otherwise) and runs the safety pass |
| `products.py` | Product / price search for a registered active ingredient, verified and cached |
| `embedding.py` | The one embedding model (`BAAI/bge-small-en-v1.5`, 384-dim, normalised) used for both corpus and queries |
| `db.py` | Database connection from `DATABASE_URL` |
| `build_documents.py` | Renders KB rows into curated documents and embeds them (`make docs`) |
| `ingest_documents.py` | Adds real extension passages from `data/external_docs.yaml` (`make ingest`) |
| `test_pipeline.py` | The handoff verification checks, runnable against the live DB |

### The API surface

Full examples with responses are in `README_API.md`. In short:

```bash
# main endpoint: CNN output in, assembled answer out
curl -s -X POST localhost:8001/diagnose -H 'content-type: application/json' \
  -d '{"class_label":"Tomato_Late_blight","confidence":0.91}' | jq
```

Returns `result_type: "normal"`, the disease block, an `explanation` with
citations, `treatments` (each with `source_tier`), `diy`, `products`, and the
`disclaimer`. Optional request fields: `runner_up` (the CNN's second class,
for the look-alike check), `is_leaf` (an external "is this a leaf" result), and
`question` (steers retrieval).

```bash
curl -s localhost:8001/disease/D_TOMATO_LATE_BLIGHT | jq      # full KB entry
curl -s "localhost:8001/retrieve?disease_id=D_TOMATO_LATE_BLIGHT&q=how%20do%20I%20treat%20it" | jq
curl -s localhost:8001/health
```

### The three-tier evidence model, and why doses are gated

A dose is the most dangerous thing this system can output, so it is controlled
in three layers:

1. **Database constraint.** `verified = true` is only allowed when
   `source_tier = 'label'` (`CONSTRAINT verified_is_label`), and a verified dose
   must have a `source_url`.
2. **The `treatment_safe` view.** The application never reads the `treatment`
   table directly. The view nulls out every dose field when the tier is `none`
   and always exposes `source_tier` next to the dose.
3. **The API contract.** `pipeline.py` passes the view's rows through unchanged,
   so every treatment object in the JSON carries `source_tier`. Because there
   is no frontend yet, the API is the last place this guarantee can be made. A
   `research` dose shown without its badge would read as a certified dose, the
   worst failure the system can produce.

The LLM never produces a number. Doses are rendered from the database row, and
any per-litre rate that appears in the model's prose is replaced with a
placeholder that points to the treatment card.

### Retrieval: filtered, then ranked

The CNN already tells us the disease, so retrieval is not a global search. The
query first restricts to that disease's chunks (and, if the question maps to
one, a single section: `identification`, `cause`, `treatment`, `prevention`,
`diy`, `healthy`), and only then orders the survivors by cosine similarity to
the question. Both corpus and query use the same embedding model; mixing models
would silently return garbage rankings, which is why the model lives in one
file (`embedding.py`).

Question-to-section routing is a keyword table (`retrieval.py`), not an LLM:
"how do I treat it" goes to `treatment`, "stop it coming back" to
`prevention`, "make something at home" to `diy`, "why" to `cause`, and so on.

The corpus has two kinds of document:

- **Curated text** (`source_name = 'curated_kb'`), generated from the
  structured rows by `build_documents.py`. It deliberately excludes doses.
- **External extension passages** (any other `source_name`), added from
  `data/external_docs.yaml` by `ingest_documents.py`. These are short, cited
  passages with a real `source_url`, not whole articles. `make docs` only
  rebuilds the curated documents, so external documents survive rebuilds. The
  current corpus has 123 chunks, of which 4 are external (all for tomato late
  blight, from Cornell and UC IPM); `make build` recreates the schema and then
  re-ingests them.

### The safety design

- **Schema constraints** (`schema.sql`) tie `verified` to the label tier and
  require a source for any verified dose.
- **`treatment_safe` view** strips doses from `none`-tier rows and carries the
  tier with every dose.
- **Chemistry rules** (`validate_kb.py`, run before every load): fungi and
  oomycetes get FRAC-coded actives; late blight (an oomycete) gets no FRAC 3 or
  11; bacteria get copper only; spider mites get an IRAC-coded acaricide and
  never a fungicide. The composer cannot add chemistry: any sentence that names
  an active ingredient not in that disease's own treatment rows is removed
  before the answer is returned, even if a retrieved passage mentioned it in a
  warning.
- **Curability branching** (`pipeline.py`): `incurable` always returns a
  removal-and-containment result and skips product lookup (HLB also carries a
  report prompt); a healthy class returns care notes only.
- **Confidence / out-of-distribution gate**: confidence below `UNSURE_THRESHOLD`
  (default 0.6) or a runner-up that is a recorded look-alike returns `unsure`
  with candidates and a distinguishing question built from their symptoms.
  Confidence below `OOD_FLOOR` (default 0.35) or `is_leaf: false` returns an
  out-of-distribution `unsure` asking for a better photo.
- **Products only for registered doses**: the shop search runs only for the top
  `label`-tier, verified active ingredient. Each hit must pass a verification
  step (Claude if configured, else a strict keyword check on the title); results
  are cached for 36 hours and carry a `retrieved_at` timestamp. No affiliate
  links. If search is not configured or nothing verifies, the answer says "no
  products found" rather than guessing.
- **Fail honest**: no LLM key means a template explanation (marked
  `generated_by: "template"`), weak retrieval adds a note, no dose means the
  ingredient is shown without a number.

### Known limitations

- **Photo accuracy.** The CNN was trained on single leaves on plain
  backgrounds. Real phone photos are harder, and users will photograph things
  that are not leaves. The gate helps, but the system is only as good as the
  label it is given.
- **Dose coverage is thin by design.** Of 82 treatments, 9 have registered
  (`label`) doses, 3 have `research` doses, and the rest are qualitative.
  Registered doses exist for: apple scab, corn northern leaf blight, corn
  common rust, potato early and late blight, tomato bacterial spot, tomato
  early and late blight, and tomato two-spotted spider mite. Research-tier
  doses: bell pepper bacterial spot, squash powdery mildew, tomato Septoria
  leaf spot. Everything else (apple black rot, cedar apple rust, cherry powdery
  mildew, corn gray leaf spot, grape black rot / esca / leaf blight, citrus
  greening, peach bacterial spot, strawberry leaf scorch, tomato leaf mold,
  target spot, and the two tomato viruses) names ingredients without a number.
- **External literature is sparse.** Only tomato late blight has ingested
  extension passages so far; other diseases rely on the curated text.
- **LLM and product search are optional and currently unconfigured.** Without
  `ANTHROPIC_API_KEY` the explanation is assembled by a template; without
  `SERPER_API_KEY` the product list is empty with an explanatory note. The
  Claude path is implemented and its failure handling is tested, but its output
  quality has not been reviewed on real keys.
- **Prices go stale.** Product prices are live snapshots, cached for 36 hours,
  and can be wrong by the time you look.
- **DIY remedies are mostly preventive.** Only 5 are recorded, for 3 diseases,
  and most will not cure an established infection. The `efficacy` label says
  which.
- **No frontend yet.** Everything above is delivered as JSON; the badges and
  disclaimers described in Part 1 must be rendered by whatever consumes the API.
- **India-first.** Doses come from Indian extension sources (TNAU) and the
  product search targets Indian retailers. Registration status differs by
  country; check locally.
