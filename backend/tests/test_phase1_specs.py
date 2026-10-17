import os
from pathlib import Path
import pytest

DOCS_DIR = Path(__file__).resolve().parent.parent.parent / "docs"

def test_architecture_documentation_exists():
    arch_file = DOCS_DIR / "ARCHITECTURE.md"
    assert arch_file.exists(), "ARCHITECTURE.md must exist in docs/"
    content = arch_file.read_text(encoding="utf-8")
    assert "PS 1.2" in content
    assert "Dakshina Kannada" in content
    assert "Udupi" in content
    assert "On-Chain" in content
    assert "Off-Chain" in content

def test_database_schema_completeness():
    schema_file = DOCS_DIR / "DATABASE_SCHEMA.sql"
    assert schema_file.exists(), "DATABASE_SCHEMA.sql must exist in docs/"
    sql = schema_file.read_text(encoding="utf-8")
    
    # Check all 16 critical tables specified in requirements
    expected_tables = [
        "users",
        "farms",
        "crop_investigations",
        "investigation_observations",
        "experiments",
        "experiment_observations",
        "produce_listings",
        "market_price_references",
        "group_offers",
        "offer_contributions",
        "orders",
        "order_items",
        "order_events",
        "reviews",
        "traceability_events",
        "blockchain_transaction_references"
    ]
    for table in expected_tables:
        assert f"CREATE TABLE IF NOT EXISTS {table}" in sql, f"Missing table: {table}"
        
    # Check regional and domain columns
    assert "district" in sql
    assert "taluk" in sql
    assert "voice_transcript_kannada" in sql
    assert "agreement_hash" in sql

def test_api_contracts_spec():
    api_file = DOCS_DIR / "API_CONTRACTS.md"
    assert api_file.exists(), "API_CONTRACTS.md must exist in docs/"
    api_doc = api_file.read_text(encoding="utf-8")
    
    expected_endpoints = [
        "/auth/register",
        "/auth/login",
        "/farms",
        "/forensics/analyze",
        "/lab/experiments",
        "/listings",
        "/group-offers/match",
        "/pricing/benchmark",
        "/voice/parse-transcription",
        "/orders",
        "/traceability",
        "/payments/escrow"
    ]
    for endpoint in expected_endpoints:
        assert endpoint in api_doc, f"Missing endpoint contract: {endpoint}"

def test_env_example_configured():
    env_file = Path(__file__).resolve().parent.parent.parent / ".env.example"
    assert env_file.exists(), ".env.example must exist at project root"
    content = env_file.read_text(encoding="utf-8")
    assert "DATABASE_URL" in content
    assert "ANTHROPIC_API_KEY" in content
    assert "BLOCKCHAIN_RPC_URL" in content
    assert "VITE_API_BASE_URL" in content
