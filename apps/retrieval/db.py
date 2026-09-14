"""
One place to open a database connection.

Contract:
    get_conn() -> psycopg connection that returns rows as dicts.

Reads DATABASE_URL from the environment (a .env file in the project root is
loaded first if it exists). The default matches the dev docker-compose setup.
"""

import os

import psycopg
import psycopg.rows
from dotenv import load_dotenv

load_dotenv()   # loads .env if present, does nothing otherwise

# Same dev default the Makefile / docker-compose use. Override with DATABASE_URL.
DSN = os.environ.get(
    "DATABASE_URL",
    "postgresql://plantpulse:devonly@127.0.0.1:5432/plantpulse",
)


def get_conn():
    """Open a connection. Use it as:  with get_conn() as conn: ..."""
    return psycopg.connect(DSN, row_factory=psycopg.rows.dict_row)
