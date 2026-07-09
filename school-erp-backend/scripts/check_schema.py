"""
Schema drift check.

Compares every SQLAlchemy model against the actual database and prints:
  - tables the code expects but the DB is missing
  - columns the code expects but the DB is missing (with ready-to-run ALTER TABLE)

Run from the school-erp-backend folder (venv active, Docker up):

    python -m scripts.check_schema

This is read-only — it does NOT change anything. It just tells you what's out
of sync so you can fix it before a demo.
"""
import asyncio

# Importing app.main registers every model on Base.metadata (main includes all routers,
# which import all models). No server is started by importing it.
import app.main  # noqa: F401  (side effect: populate metadata)

from sqlalchemy import inspect
from app.core.database import Base, engine


def _table_names(sync_conn):
    return set(inspect(sync_conn).get_table_names())


def _columns(sync_conn, table_name):
    return {col["name"] for col in inspect(sync_conn).get_columns(table_name)}


async def main():
    dialect = engine.dialect
    missing_tables = []
    missing_columns = {}  # table -> list[(name, ddl_type)]

    async with engine.connect() as conn:
        db_tables = await conn.run_sync(_table_names)

        for table in Base.metadata.sorted_tables:
            if table.name not in db_tables:
                missing_tables.append(table.name)
                continue
            db_cols = await conn.run_sync(_columns, table.name)
            for col in table.columns:
                if col.name not in db_cols:
                    try:
                        ddl_type = col.type.compile(dialect)
                    except Exception:
                        ddl_type = str(col.type)
                    missing_columns.setdefault(table.name, []).append((col.name, ddl_type))

    print("=" * 68)
    print("SCHEMA DRIFT REPORT")
    print("=" * 68)

    if not missing_tables and not missing_columns:
        print("\nAll good — every model table and column exists in the database.\n")
        return

    if missing_tables:
        print("\nMISSING TABLES (exist in code, not in DB):")
        for t in missing_tables:
            print(f"  - {t}")
        print("\n  -> These need their migrations applied, or the table created.")
        print("     Tell your assistant which tables these are for the exact fix.\n")

    if missing_columns:
        print("\nMISSING COLUMNS (exist in code, not in DB):")
        for table, cols in missing_columns.items():
            print(f"\n  {table}:")
            for name, ddl_type in cols:
                print(f"      - {name}  ({ddl_type})")
        print("\n  -> Copy-paste ALTER statements to add them (all nullable, safe):\n")
        for table, cols in missing_columns.items():
            adds = ", ".join(f"ADD COLUMN IF NOT EXISTS {name} {ddl_type}" for name, ddl_type in cols)
            print(f"  ALTER TABLE {table} {adds};")
        print()

    print("=" * 68)


if __name__ == "__main__":
    asyncio.run(main())