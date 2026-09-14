"""
Load the validated seed files into Postgres.

    pip install psycopg[binary] pyyaml
    psql "$DATABASE_URL" -f schema.sql
    python load_kb.py

Idempotent: safe to re-run after editing the YAML.
"""

from __future__ import annotations

import csv
import json
import os
import sys
from pathlib import Path

import psycopg
import yaml

from validate_kb import load as load_seed, validate

DATA = Path(__file__).parent / "data"
DSN = os.environ.get("DATABASE_URL", "postgresql:///plantpulse")


def upsert(cur, table: str, row: dict, key: str) -> None:
    cols = list(row)
    updates = [c for c in cols if c != key]
    sql = (
        f"INSERT INTO {table} ({', '.join(cols)}) "
        f"VALUES ({', '.join('%s' for _ in cols)}) "
        f"ON CONFLICT ({key}) DO UPDATE SET "
        + ", ".join(f"{c} = EXCLUDED.{c}" for c in updates)
    )
    cur.execute(sql, [row[c] for c in cols])


def main() -> int:
    seed, dis, labels = load_seed()

    care_raw = yaml.safe_load((DATA / "healthy_care.yaml").read_text())
    care_by_crop = {c["crop_id"]: c for c in care_raw["healthy_care"]}

    report = validate(seed, dis, labels)
    if report.errors:
        print("refusing to load: validation failed", file=sys.stderr)
        for e in report.errors:
            print(f"  {e}", file=sys.stderr)
        return 1

    with psycopg.connect(DSN) as conn, conn.cursor() as cur:
        for c in seed["crops"]:
            upsert(cur, "crop", {
                "crop_id": c["crop_id"],
                "common_name": c["common_name"],
                "scientific_name": c["scientific_name"],
                "indoor_suitable": c.get("indoor_suitable", False),
                "care_notes": (care_by_crop.get(c["crop_id"], {}).get("care") or "").strip() or None,
            }, "crop_id")

        for p in seed["pathogens"]:
            upsert(cur, "pathogen", {
                "pathogen_id": p["pathogen_id"],
                "scientific_name": p["scientific_name"],
                "synonyms": p.get("synonyms", []),
                "type": p["type"],
                "vector_organism": p.get("vector_organism"),
                "survival": p.get("survival"),
                "notes": p.get("notes"),
            }, "pathogen_id")

        for a in seed["active_ingredients"]:
            upsert(cur, "active_ingredient", {
                "ai_id": a["ai_id"],
                "name": a["name"],
                "chemical_group": a.get("chemical_group"),
                "frac_code": a.get("frac_code"),
                "irac_code": a.get("irac_code"),
                "mode_of_action": a.get("mode_of_action"),
                "is_multisite": a.get("is_multisite", False),
                "organic_approved": a.get("organic_approved", False),
                "hazard_notes": a.get("hazard_notes"),
            }, "ai_id")

        for d in dis["diseases"]:
            upsert(cur, "disease", {
                "disease_id": d["disease_id"],
                "crop_id": d["crop_id"],
                "pathogen_id": d["pathogen_id"],
                "common_name": d["common_name"],
                "curability": d["curability"],
                "is_healthy_class": False,
                "severity_default": d.get("severity_default"),
                "symptoms": (d.get("symptoms") or "").strip(),
                "favorable_conditions": (d.get("favorable_conditions") or "").strip(),
                "spread_mechanism": (d.get("spread_mechanism") or "").strip(),
                "look_alikes": d.get("look_alikes", []),
            }, "disease_id")

        for h in dis["healthy_classes"]:
            upsert(cur, "disease", {
                "disease_id": h["disease_id"],
                "crop_id": h["crop_id"],
                "pathogen_id": None,
                "common_name": h["common_name"],
                "curability": "curable",
                "is_healthy_class": True,
                "severity_default": 1,
            }, "disease_id")

        # Treatments have no natural key, so replace them wholesale per disease.
        cur.execute("DELETE FROM treatment")
        for d in dis["diseases"]:
            for t in d.get("treatments", []):
                cur.execute(
                    """INSERT INTO treatment
                       (disease_id, ai_id, control_class, title, instructions,
                        priority, dose_value, dose_unit, dose_basis, interval_days,
                        max_applications, phi_days, efficacy_note, evidence, region,
                        label_registered, verified, source_tier, source_name, source_url, retrieved_on)
                       VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
                    (d["disease_id"], t.get("ai_id"), t["control_class"], t["title"],
                     t["instructions"], t.get("priority", 5),
                     t.get("dose_value"), t.get("dose_unit"), t.get("dose_basis"),
                     t.get("interval_days"), t.get("max_applications"), t.get("phi_days"),
                     t.get("efficacy_note"), t.get("evidence"), t.get("region", "IN"),
                     t.get("label_registered"), t.get("verified", False),
                     t.get("source_tier", "none"),
                     t.get("source_name"), t.get("source_url"), t.get("retrieved_on")),
                )

        cur.execute("DELETE FROM diy_remedy")
        for d in dis["diseases"]:
            for r in d.get("diy") or []:
                cur.execute(
                    """INSERT INTO diy_remedy
                       (diy_id, disease_id, title, ingredients, steps, prep_time_hours,
                        efficacy, feasibility_score, safety_notes, evidence, verified, source_url)
                       VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
                    (r["diy_id"], d["disease_id"], r["title"],
                     json.dumps(r["ingredients"]), r["steps"], r.get("prep_time_hours"),
                     r["efficacy"], r.get("feasibility_score"), r.get("safety_notes"),
                     r.get("evidence"), r.get("verified", False), r.get("source_url")),
                )

        with (DATA / "class_labels.csv").open(newline="") as fh:
            for i, row in enumerate(csv.DictReader(fh)):
                upsert(cur, "class_label", {
                    "label": row["label"],
                    "disease_id": row["disease_id"],
                    "dataset": row["dataset"],
                    "class_index": None,   # set from your training label order
                }, "label")

        conn.commit()

    print("loaded")
    return 0


if __name__ == "__main__":
    sys.exit(main())
