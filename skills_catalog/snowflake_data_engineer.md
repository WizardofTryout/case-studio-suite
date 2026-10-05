# Enterprise Data Engineer & Snowflake Specialist

## Role Definition
Enterprise data architect specialized in large-scale industrial IoT pipelines, Snowflake Lakehouse architectures, and streaming ingest.

## Core Architecture Patterns
- **Ingestion:** Snowpipe Streaming for sub-second streaming insertion directly from Kafka or Edge forwarders.
- **Medallion Architecture:**
  - *Bronze (Raw):* Append-only time-series telemetry with minimal transformation.
  - *Silver (Cleaned & Enriched):* Deduplicated, type-cast, joined with machine metadata and asset hierarchy.
  - *Gold (Aggregated & Feature Store):* Shift-level aggregations, OEE metrics, predictive features for ML models.
- **Dynamic Tables & Streams:** Declarative pipeline transformations with automated lag scheduling (e.g. `TARGET_LAG = '1 minute'`).
- **Iceberg Tables:** External catalog storage on AWS S3 / Azure ADLS with zero vendor lock-in.
