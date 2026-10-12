"""
Quick end-to-end checks for the pipeline (no server needed).

    python test_pipeline.py

Each check mirrors one of the verification points in the handoff document.
Prints PASS/FAIL per check and exits non-zero on any failure.
"""

import sys

import pipeline

failures = []


def check(name, condition):
    print(("PASS " if condition else "FAIL ") + name)
    if not condition:
        failures.append(name)


def every_treatment_has_tier(result):
    return all("source_tier" in t and t["source_tier"] in ("label", "research", "none")
               for t in result["treatments"])


# 1. normal disease
lb = pipeline.diagnose("Tomato_Late_blight", 0.91)
check("late blight -> normal", lb["result_type"] == "normal")
check("late blight: every treatment carries source_tier", every_treatment_has_tier(lb))
mancozeb = [t for t in lb["treatments"] if t["active_ingredient"] == "Mancozeb"][0]
check("late blight: mancozeb dose is 2.5 g/L from the DB, label tier",
      mancozeb["dose_value"] == 2.5 and mancozeb["dose_unit"] == "g/L" and mancozeb["source_tier"] == "label")
check("late blight: no FRAC 3 / 11 chemistry offered",
      all(t["frac_code"] not in ("3", "11") for t in lb["treatments"]))
check("late blight: 'none' tier rows have null dose",
      all(t["dose_value"] is None for t in lb["treatments"] if t["source_tier"] == "none"))
check("late blight: explanation present with citations",
      lb["explanation"] and len(lb["explanation"]["citations"]) > 0)
check("late blight: no per-litre dose in free text",
      "g/L" not in lb["explanation"]["summary"] + " ".join(lb["explanation"]["treatment_steps"]))
check("late blight: disclaimer present", "Krishi Vigyan Kendra" in lb["disclaimer"])
check("late blight: retrieval includes an external source",
      any(c["source_name"] != "curated_kb" for c in lb["retrieval"]["chunks_used"]))

# 2. incurable
ty = pipeline.diagnose("Tomato_Tomato_Yellow_Leaf_Curl_Virus", 0.95)
check("TYLCV -> incurable", ty["result_type"] == "incurable")
check("TYLCV: no products", ty["products"] == [] and "skipped" in ty["product_note"])
check("TYLCV: removal message", "no cure" in ty["message"].lower())
hlb = pipeline.diagnose("Orange_Haunglongbing_(Citrus_greening)", 0.9)
check("HLB: report prompt present", "report" in hlb.get("report_prompt", "").lower())

# 3. healthy
h = pipeline.diagnose("Tomato_healthy", 0.88)
check("healthy -> healthy with care notes and no treatments",
      h["result_type"] == "healthy" and h["care"]["care_notes"] and h["treatments"] == [] and h["products"] == [])

# 4. unsure / OOD
u = pipeline.diagnose("Tomato_Early_blight", 0.42)
check("low confidence -> unsure with candidates + question",
      u["result_type"] == "unsure" and len(u["candidates"]) >= 2 and "?" in u["question"])
la = pipeline.diagnose("Tomato_Early_blight", 0.85,
                       runner_up={"class_label": "Tomato_Septoria_leaf_spot", "confidence": 0.1})
check("look-alike runner-up -> unsure", la["result_type"] == "unsure" and la["unsure_reason"] == "look_alike_runner_up")
ood = pipeline.diagnose("Tomato_Early_blight", 0.9, is_leaf=False)
check("is_leaf=false -> out of distribution", ood.get("unsure_reason") == "out_of_distribution")
check("unknown label -> None (404)", pipeline.diagnose("Not_a_label", 0.9) is None)

# 5. DIY honesty
eb = pipeline.diagnose("Tomato_Early_blight", 0.9)
check("early blight: DIY remedies carry efficacy + safety + honesty note",
      eb["diy"] and all(d["efficacy"] and "honesty_note" in d and "safety_notes" in d for d in eb["diy"]))

print()
if failures:
    print(f"{len(failures)} check(s) failed")
    sys.exit(1)
print("all checks passed")
