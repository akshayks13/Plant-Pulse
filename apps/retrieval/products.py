"""
TASK E - product / price lookup for an active ingredient.

Contract:
    find_products(ingredient, kind="fungicide", max_results=5) -> dict
        {"products": [{name, price, currency, price_text, vendor, url,
                       retrieved_at, verified_by, note}],
         "note": str, "searched_at": iso-string or None, "affiliate_links": False}

Search provider: Serper.dev Google Shopping (set SERPER_API_KEY). If no key is
set, or the search fails, the result is an honest empty list with a note -
never a guessed product.

Verification: agrochemical listings are noisy, so every hit must pass
check_product(): Claude confirms the listing really contains the ingredient
(if ANTHROPIC_API_KEY is set), otherwise a strict keyword check on the title.

Cache: cache/products.json, 36 hours. Each product carries retrieved_at so the
caller can show a price timestamp. Prices are NOT stored in the vector store.
No affiliate links are used.
"""

import json
import os
import re
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import quote_plus

import httpx
import yaml
from dotenv import load_dotenv

load_dotenv()

SERPER_URL = "https://google.serper.dev/shopping"
CACHE_FILE = Path(__file__).parent / "cache" / "products.json"
CACHE_HOURS = 36
COUNTRY = os.environ.get("SHOP_COUNTRY", "in")     # Google country code for results

CURRENCY_SYMBOLS = {"₹": "INR", "Rs": "INR", "$": "USD", "€": "EUR", "£": "GBP"}


def search_available():
    return bool(os.environ.get("SERPER_API_KEY"))


def now_iso():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


# ------------------------------------------------------------------ cache

def load_cache():
    try:
        return json.loads(CACHE_FILE.read_text())
    except (FileNotFoundError, json.JSONDecodeError):
        return {}


def save_cache(cache):
    CACHE_FILE.parent.mkdir(exist_ok=True)
    CACHE_FILE.write_text(json.dumps(cache, indent=2))


# ----------------------------------------------------------------- search

def build_query(ingredient, kind):
    """e.g. 'mancozeb fungicide buy India'."""
    short = re.split(r"[/(]", ingredient)[0].strip()
    return f"{short} {kind} buy India"


def search_serper(query, max_results):
    headers = {"X-API-KEY": os.environ["SERPER_API_KEY"], "Content-Type": "application/json"}
    body = {"q": query, "gl": COUNTRY, "hl": "en", "num": max_results * 2}
    response = httpx.post(SERPER_URL, headers=headers, json=body, timeout=15)
    response.raise_for_status()
    return response.json().get("shopping", [])


def parse_price(text):
    """'₹250.00' -> (250.0, 'INR'). Unknown format -> (None, None)."""
    if not text:
        return None, None
    currency = None
    for symbol, code in CURRENCY_SYMBOLS.items():
        if symbol in text:
            currency = code
    match = re.search(r"\d[\d,]*(?:\.\d+)?", text)
    if not match:
        return None, currency
    return float(match.group().replace(",", "")), currency


# ----------------------------------------------------------- verification

def check_product(title, ingredient):
    """Does this listing really contain the ingredient?  -> (bool, how, concentration)"""
    parts = [p.strip().lower() for p in re.split(r"[/(]", ingredient) if len(p.strip()) > 3]
    title_low = title.lower()

    if os.environ.get("ANTHROPIC_API_KEY"):
        try:
            from compose import ask_llm, parse_json
            raw = ask_llm(
                "You check agrochemical shop listings. Answer JSON only: "
                '{"contains_ingredient": true|false, "concentration": "e.g. 75% WP or null"}',
                f"Active ingredient wanted: {ingredient}\nListing title: {title}\n"
                "Does this product's main active ingredient match, at a plausible concentration?",
                max_tokens=200,
            )
            data = parse_json(raw)
            if data is not None:
                return bool(data.get("contains_ingredient")), "llm", data.get("concentration")
        except Exception as err:
            print("products: LLM check failed, using keyword check:", err)

    ok = any(p in title_low for p in parts)
    conc = re.search(r"\d+(?:\.\d+)?\s*%\s*[A-Z]{1,3}", title)
    return ok, "keyword", conc.group() if conc else None


# ------------------------------------------------------------------ entry

def find_products(ingredient, kind="fungicide", max_results=5):
    key = f"{ingredient.lower()}|{kind}|{COUNTRY}"
    cache = load_cache()
    entry = cache.get(key)
    if entry and time.time() - entry["saved_at"] < CACHE_HOURS * 3600:
        return entry["result"]

    result = {"products": [], "note": "", "searched_at": None, "affiliate_links": False}

    if not search_available():
        result["note"] = ("No products found: product search is not configured "
                          "(set SERPER_API_KEY). Ask a local agro-input dealer for "
                          f"a registered {kind} containing {ingredient}.")
        return result

    query = build_query(ingredient, kind)
    try:
        hits = search_serper(query, max_results)
    except Exception as err:
        result["note"] = f"No products found: search failed ({type(err).__name__})."
        return result

    result["searched_at"] = now_iso()
    for hit in hits:
        title = hit.get("title") or ""
        ok, how, conc = check_product(title, ingredient)
        if not ok:
            continue
        price, currency = parse_price(hit.get("price"))
        result["products"].append({
            "name": title,
            "price": price,
            "currency": currency,
            "price_text": hit.get("price"),
            "vendor": hit.get("source"),
            "url": hit.get("link"),
            "concentration": conc,
            "verified_by": how,
            "retrieved_at": result["searched_at"],
        })
        if len(result["products"]) >= max_results:
            break

    if result["products"]:
        result["note"] = (f"{len(result['products'])} listing(s) matched '{query}'. Prices are "
                          "live snapshots and may be stale; always confirm on the vendor page.")
    else:
        result["note"] = f"No products found: no listing could be verified to contain {ingredient}."

    cache[key] = {"saved_at": time.time(), "result": result}
    save_cache(cache)
    return result


# ------------------------------------------------------- product catalog
#
# data/product_catalog.yaml lists real products for each active ingredient,
# found by web search. It works without any API key. Prices are left out on
# purpose (they change every day); each product links to a live shop search
# instead, so the user always sees today's price.

CATALOG_FILE = Path(__file__).parent / "data" / "product_catalog.yaml"
_catalog = None


def load_catalog():
    """Read the catalog file once and keep it in memory."""
    global _catalog
    if _catalog is None:
        _catalog = yaml.safe_load(CATALOG_FILE.read_text())
    return _catalog


def shop_search_url(text):
    """A Google Shopping search link, e.g. for 'Blitox 50 WP'."""
    return "https://www.google.com/search?tbm=shop&q=" + quote_plus(text + " buy India")


def catalog_products(ingredient):
    """All catalog products that contain this active ingredient."""
    found = []
    for product in load_catalog()["products"]:
        if product["ingredient"] == ingredient:
            item = dict(product)
            item["shop_url"] = shop_search_url(product["name"])
            found.append(item)
    return found


def product_groups(treatments):
    """
    One group per active ingredient in the treatment plan, in priority order:
        {"ingredient", "used_for", "control_class", "frac_code", "organic_approved",
         "products": [...], "search_url"}
    Cultural and physical steps have no ingredient, so they are skipped.
    """
    groups = []
    seen = set()
    for t in treatments:
        name = t.get("active_ingredient")
        if not name or name in seen:
            continue
        if t["control_class"] not in ("chemical", "biological"):
            continue
        seen.add(name)
        groups.append({
            "ingredient": name,
            "used_for": t["title"],
            "control_class": t["control_class"],
            "frac_code": t.get("frac_code"),
            "organic_approved": t.get("organic_approved"),
            "products": catalog_products(name),
            "search_url": shop_search_url(name),
        })
    return groups


if __name__ == "__main__":
    print(json.dumps(find_products("Mancozeb"), indent=2))
