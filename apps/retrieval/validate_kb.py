"""
Validate the KB seed files before they ever touch Postgres.

Runs without a database. Wire this into CI so a bad curation edit fails the
build instead of surfacing as a wrong dosage on the website.

    python validate_kb.py
"""

from __future__ import annotations

import csv
import sys
from pathlib import Path

import yaml

DATA = Path(__file__).parent / "data"

VALID_PATHOGEN_TYPES = {
    "fungal", "oomycete", "bacterial", "viral", "phytoplasma",
    "arthropod_pest", "nutrient_deficiency", "abiotic", "none",
}
VALID_CONTROL_CLASSES = {"chemical", "biological", "cultural", "physical"}
VALID_CURABILITY = {"curable", "manageable", "incurable"}
VALID_EVIDENCE = {"extension_guideline", "peer_reviewed", "anecdotal"}
VALID_EFFICACY = {"preventive", "mild_curative", "not_recommended"}

# A fungicide cannot control a bacterium, a virus or a mite. This table is the
# guard against the single most damaging class of curation error.
ALLOWED_CHEMISTRY = {
    "fungal":         {"frac"},
    "oomycete":       {"frac"},
    "bacterial":      {"frac"},        # copper only; checked separately below
    "viral":          set(),           # nothing acts on the virus itself
    "arthropod_pest": {"irac"},
}
BACTERICIDES = {"AI_COPPER"}
VECTOR_CONTROL_OK = {"AI_IMIDACLOPRID", "AI_AZADIRACHTIN", "AI_HORT_OIL"}


class Report:
    def __init__(self) -> None:
        self.errors: list[str] = []
        self.warnings: list[str] = []

    def error(self, msg: str) -> None:
        self.errors.append(msg)

    def warn(self, msg: str) -> None:
        self.warnings.append(msg)


def load() -> tuple[dict, dict, list[dict]]:
    seed = yaml.safe_load((DATA / "kb_seed.yaml").read_text())
    diseases = yaml.safe_load((DATA / "diseases.yaml").read_text())
    with (DATA / "class_labels.csv").open(newline="") as fh:
        labels = list(csv.DictReader(fh))
    return seed, diseases, labels


def validate(seed: dict, dis: dict, labels: list[dict]) -> Report:
    r = Report()

    crops = {c["crop_id"] for c in seed["crops"]}
    pathogens = {p["pathogen_id"]: p for p in seed["pathogens"]}
    ais = {a["ai_id"]: a for a in seed["active_ingredients"]}

    disease_ids: set[str] = set()

    # --- pathogens -------------------------------------------------------
    for p in seed["pathogens"]:
        if p["type"] not in VALID_PATHOGEN_TYPES:
            r.error(f"{p['pathogen_id']}: bad pathogen type {p['type']!r}")

    # --- diseases --------------------------------------------------------
    for d in dis["diseases"]:
        did = d["disease_id"]
        disease_ids.add(did)

        if d["crop_id"] not in crops:
            r.error(f"{did}: unknown crop_id {d['crop_id']!r}")
        if d["pathogen_id"] not in pathogens:
            r.error(f"{did}: unknown pathogen_id {d['pathogen_id']!r}")
            continue
        if d["curability"] not in VALID_CURABILITY:
            r.error(f"{did}: bad curability {d['curability']!r}")

        ptype = pathogens[d["pathogen_id"]]["type"]

        for field in ("symptoms", "favorable_conditions", "spread_mechanism"):
            if not d.get(field):
                r.warn(f"{did}: empty {field}")

        for la in d.get("look_alikes", []):
            if la not in {x["disease_id"] for x in dis["diseases"]}:
                r.error(f"{did}: look_alike {la!r} is not a known disease_id")

        # --- treatments --------------------------------------------------
        seen_chem = False
        for t in d.get("treatments", []):
            cc = t["control_class"]
            if cc not in VALID_CONTROL_CLASSES:
                r.error(f"{did}: bad control_class {cc!r}")
            if t.get("evidence") and t["evidence"] not in VALID_EVIDENCE:
                r.error(f"{did}: bad evidence {t['evidence']!r}")

            if cc in ("chemical", "biological"):
                ai_id = t.get("ai_id")
                if not ai_id:
                    r.error(f"{did}: {cc} treatment {t['title']!r} has no ai_id")
                    continue
                if ai_id not in ais:
                    r.error(f"{did}: unknown ai_id {ai_id!r}")
                    continue
                if cc == "chemical":
                    seen_chem = True
                    _check_chemistry(r, did, ptype, ai_id, ais[ai_id])

            # The core safety invariant.
            if t.get("verified") and not t.get("source_url"):
                r.error(f"{did}: treatment {t['title']!r} verified without source_url")
            if t.get("verified") and t.get("source_tier") not in (None, "label"):
                r.error(f"{did}: treatment {t['title']!r} verified but source_tier "
                        f"is {t.get('source_tier')!r} (only 'label' may be verified)")
            has_dose = any(t.get(k) is not None for k in
                           ("dose_value", "interval_days", "phi_days"))
            # A dose on an unverified row is allowed ONLY as an explicit Tier-2
            # research fallback (source_tier: research + a source_url). Any other
            # unverified dose is the old error.
            if has_dose and not t.get("verified"):
                if t.get("source_tier") == "research" and t.get("source_url"):
                    if t.get("evidence") != "peer_reviewed":
                        r.warn(f"{did}: research-tier dose on {t['title']!r} "
                               f"should use evidence: peer_reviewed")
                else:
                    r.error(f"{did}: treatment {t['title']!r} carries a dose but is "
                            f"unverified and not a valid research fallback "
                            f"(need source_tier: research + source_url)")

        if d["curability"] == "incurable" and seen_chem:
            chem = [t for t in d["treatments"]
                    if t["control_class"] == "chemical"
                    and t.get("ai_id") not in VECTOR_CONTROL_OK]
            if chem:
                r.error(
                    f"{did}: marked incurable but lists a curative chemical "
                    f"{[c['title'] for c in chem]}"
                )

        # --- DIY ---------------------------------------------------------
        for diy in d.get("diy") or []:
            if diy["efficacy"] not in VALID_EFFICACY:
                r.error(f"{did}: bad DIY efficacy {diy['efficacy']!r}")
            if not diy.get("safety_notes"):
                r.warn(f"{did}: DIY {diy['diy_id']} has no safety_notes")
            if ptype in ("viral", "bacterial") and diy["efficacy"] == "mild_curative":
                r.error(
                    f"{did}: DIY {diy['diy_id']} claims curative effect on a "
                    f"{ptype} agent"
                )

    for h in dis["healthy_classes"]:
        disease_ids.add(h["disease_id"])
        if h["crop_id"] not in crops:
            r.error(f"{h['disease_id']}: unknown crop_id {h['crop_id']!r}")

    # --- class labels ----------------------------------------------------
    seen_labels = set()
    for row in labels:
        if row["label"] in seen_labels:
            r.error(f"duplicate class label {row['label']!r}")
        seen_labels.add(row["label"])
        if row["disease_id"] not in disease_ids:
            r.error(f"label {row['label']!r} maps to unknown {row['disease_id']!r}")

    unmapped = disease_ids - {row["disease_id"] for row in labels}
    for u in sorted(unmapped):
        r.warn(f"{u} has no CNN class label mapped to it")

    # --- healthy care ----------------------------------------------------
    care_path = DATA / "healthy_care.yaml"
    if care_path.exists():
        care = yaml.safe_load(care_path.read_text())["healthy_care"]
        care_crops = {c["crop_id"] for c in care}
        healthy_crops = {h["crop_id"] for h in dis["healthy_classes"]}
        for missing in sorted(healthy_crops - care_crops):
            r.error(f"healthy_care.yaml missing care notes for crop {missing!r}")
        for c in care:
            if c["crop_id"] not in crops:
                r.error(f"healthy_care.yaml: unknown crop_id {c['crop_id']!r}")
            wf = c.get("watch_for")
            if wf and wf not in disease_ids:
                r.error(f"healthy_care.yaml: watch_for {wf!r} is not a known disease_id")
            if not (c.get("care") or "").strip():
                r.warn(f"healthy_care.yaml: empty care text for {c['crop_id']}")
    else:
        r.warn("healthy_care.yaml not found - healthy classes will have no content")

    return r


def _check_chemistry(r: Report, did: str, ptype: str, ai_id: str, ai: dict) -> None:
    """Reject chemistry that cannot act on the pathogen type."""
    if ptype == "viral":
        if ai_id not in VECTOR_CONTROL_OK:
            r.error(f"{did}: {ai['name']} recommended against a virus")
        return

    if ptype == "bacterial":
        if ai_id not in BACTERICIDES | VECTOR_CONTROL_OK:
            r.error(
                f"{did}: {ai['name']} is not a bactericide but is recommended "
                f"against a bacterial pathogen"
            )
        return

    if ptype == "arthropod_pest":
        if not ai.get("irac_code"):
            r.error(f"{did}: {ai['name']} has no IRAC code but targets a mite")
        return

    if ptype in ("fungal", "oomycete"):
        if not ai.get("frac_code"):
            r.error(f"{did}: {ai['name']} has no FRAC code but targets a fungus")

    if ptype == "oomycete":
        # Oomycetes are not true fungi. DMIs and most QoIs are ineffective.
        if ai.get("frac_code") in {"3", "11"}:
            r.error(
                f"{did}: {ai['name']} (FRAC {ai['frac_code']}) has poor activity "
                f"on oomycetes - use FRAC 4/27/40 or a multi-site"
            )


def main() -> int:
    seed, dis, labels = load()
    r = validate(seed, dis, labels)

    n_dis = len(dis["diseases"])
    n_healthy = len(dis["healthy_classes"])
    n_treat = sum(len(d.get("treatments", [])) for d in dis["diseases"])
    n_diy = sum(len(d.get("diy") or []) for d in dis["diseases"])
    print(f"{n_dis} diseases, {n_healthy} healthy classes, "
          f"{len(labels)} class labels, {n_treat} treatments, {n_diy} DIY remedies")

    for w in r.warnings:
        print(f"  WARN  {w}")
    for e in r.errors:
        print(f"  ERROR {e}")

    print(f"\n{len(r.errors)} errors, {len(r.warnings)} warnings")
    return 1 if r.errors else 0


if __name__ == "__main__":
    sys.exit(main())
