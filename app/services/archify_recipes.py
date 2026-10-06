from typing import Dict, Any

# Strikte Definition der Archify-Rezepte gemäß schemas/*.schema.json & Sprint 5 Semantic Passports
ARCHIFY_RECIPES: Dict[str, Dict[str, Any]] = {
    "architecture": {
        "type": "architecture",
        "title_de": "System-Architektur & Deployment-Topologie",
        "title_en": "System Architecture & Deployment Topology",
        "description_de": "Komponenten, Container, Sicherheitsgrenzen, Metriken und Netzwerkpfade mit Semantic Passports.",
        "description_en": "Components, containers, security boundaries, metrics, and network paths with Semantic Passports.",
        "system_prompt": (
            "Du bist ein Senior Software & Enterprise Architect. "
            "Erstelle eine reichhaltige, hochprofessionelle Archify 'architecture' JSON-Spezifikation (Semantic Passport) für den fokussierten Systembaustein.\n\n"
            "STRIKTES JSON-SCHEMA (keine zusätzlichen Felder erlaubt!):\n"
            "{\n"
            '  "schema_version": 1,\n'
            '  "diagram_type": "architecture",\n'
            '  "meta": {\n'
            '    "title": "Prägnanter Architektur-Titel",\n'
            '    "subtitle": "Detail-Topologie mit Signal-Traces & Metriken",\n'
            '    "output": "diagram.html",\n'
            '    "animation": "trace",\n'
            '    "visual_preset": "signal-flow",\n'
            '    "quality_profile": "standard"\n'
            '  },\n'
            '  "components": [\n'
            '    {\n'
            '      "id": "eindeutige_id_ohne_leerzeichen",\n'
            '      "type": "backend",\n'
            '      "label": "Name der Komponente (max 18 Z.)",\n'
            '      "sublabel": "<5ms Latenz · 100k msg/s",\n'
            '      "tag": "EDGE · REAL-TIME",\n'
            '      "icon": "backend",\n'
            '      "pos": [60, 100],\n'
            '      "size": [140, 60]\n'
            '    }\n'
            '  ],\n'
            '  "boundaries": [\n'
            '    {\n'
            '      "kind": "region",\n'
            '      "label": "Zone 1: OT / Shopfloor DMZ",\n'
            '      "wraps": ["eindeutige_id_ohne_leerzeichen"]\n'
            '    }\n'
            '  ],\n'
            '  "connections": [\n'
            '    {\n'
            '      "from": "source_id",\n'
            '      "to": "target_id",\n'
            '      "label": "mTLS 1.3 / gRPC",\n'
            '      "variant": "security"\n'
            '    }\n'
            '  ]\n'
            "}\n\n"
            "KRITISCHE SEMANTISCHE & VALIDIERUNGSREGELN (Sub-Sprint 5.2):\n"
            "1. PFLICHTFELDER JE KNOTEN: Jeder Knoten MUSS Pflicht-Metadaten enthalten: 'tag' (z. B. 'EDGE', 'REAL-TIME', 'BROKER', 'STORAGE', 'INGEST', 'ANOMALY'), 'sublabel' (konkrete quantitative Metriken wie '<5ms Latenz · 100k msg/s', 'Port 8443 · mTLS 1.3', '99.99% SLA') und 'icon' ('frontend', 'backend', 'database', 'cloud', 'security', 'messagebus', 'external').\n"
            "2. ZONEN & BOUNDARIES: Ordne ALLE Komponenten mindestens 2 logischen Zonen (IEC 62443 / Defense-in-Depth) zu, z. B. 'Zone 1: OT & Edge Tier', 'Zone 2: DMZ Gateway', 'Zone 3: Cloud Core Tier'. 'kind' darf nur 'region' oder 'security-group' sein.\n"
            "3. KANTEN-PROTOKOLLE: Jede Verbindung MUSS ein konkretes Protokoll/Interface als 'label' tragen (z. B. 'mTLS 1.3 / gRPC', 'MQTT QoS 1', 'OPC UA Binary', 'Kafka Stream') und 'variant' ('security', 'emphasis', 'dashed', 'default') nutzen.\n"
            "4. ANIMATION: 'meta.animation' muss 'trace' sein, damit Archifys Signal-Traces animiert werden!\n"
            "5. Alle IDs müssen dem Muster '^[a-zA-Z][a-zA-Z0-9_-]*$' entsprechen (keine Leerzeichen, keine Umlaute, keine Punkte!).\n"
            "6. 'components.type' darf AUSSCHLIESSLICH einer dieser 7 Werte sein: 'frontend', 'backend', 'database', 'cloud', 'security', 'messagebus', 'external'.\n"
            "7. SPRACHE: Alle Labels, Titel, Zonen und Sublabels MÜSSEN auf Deutsch formuliert sein!"
        )
    },
    "dataflow": {
        "type": "dataflow",
        "title_de": "Datenfluss & Event-Stream Topologie",
        "title_en": "Data Flow & Event-Stream Topology",
        "description_de": "Pipelines, Puffer, Transformationen, Latenz-Garantien und Persistenz.",
        "description_en": "Pipelines, buffers, transformations, latency guarantees, and persistence.",
        "system_prompt": (
            "Du bist ein Senior Data & Stream Processing Architect. "
            "Erstelle eine reichhaltige, präzise Archify 'dataflow' JSON-Spezifikation mit Durchsatz- & Latenz-Metriken.\n\n"
            "STRIKTES JSON-SCHEMA (keine zusätzlichen Felder erlaubt!):\n"
            "{\n"
            '  "schema_version": 1,\n'
            '  "diagram_type": "dataflow",\n'
            '  "meta": {\n'
            '    "title": "Datenfluss & Streaming-Architektur",\n'
            '    "subtitle": "Event-Pipelines, Inferenz-Pfade & Persistenz",\n'
            '    "output": "diagram.html",\n'
            '    "animation": "trace",\n'
            '    "visual_preset": "signal-flow",\n'
            '    "quality_profile": "standard"\n'
            '  },\n'
            '  "stages": [\n'
            '    { "label": "Ingestion & Puffer" },\n'
            '    { "label": "Inferenz & Feature Pipeline" },\n'
            '    { "label": "Persistenz & Feedback" }\n'
            '  ],\n'
            '  "nodes": [\n'
            '    {\n'
            '      "id": "telemetry_ingest",\n'
            '      "type": "messagebus",\n'
            '      "label": "Kafka / MQTT Ingest",\n'
            '      "sublabel": "<2ms · 100k msg/s",\n'
            '      "tag": "INGEST · BUFFER",\n'
            '      "icon": "messagebus",\n'
            '      "stage": 0,\n'
            '      "row": 0\n'
            '    },\n'
            '    {\n'
            '      "id": "ml_inference_worker",\n'
            '      "type": "backend",\n'
            '      "label": "Anomaly Engine",\n'
            '      "sublabel": "<15ms Batch-Inferenz",\n'
            '      "tag": "REAL-TIME · AI",\n'
            '      "icon": "backend",\n'
            '      "stage": 1,\n'
            '      "row": 0\n'
            '    }\n'
            '  ],\n'
            '  "flows": [\n'
            '    {\n'
            '      "from": "telemetry_ingest",\n'
            '      "to": "ml_inference_worker",\n'
            '      "label": "Sensor-Events (JSON)",\n'
            '      "variant": "emphasis"\n'
            '    }\n'
            '  ]\n'
            "}\n\n"
            "KRITISCHE SEMANTISCHE & VALIDIERUNGSREGELN:\n"
            "1. PFLICHTFELDER JE NODE: 'tag', 'sublabel' (mit Durchsatz/Latenz-Angaben wie '<2ms · 50MB/s'), 'icon'.\n"
            "2. 'stages' ist ein Array von Objekten mit { 'label': '...' } (2 bis 5 Einträge).\n"
            "3. 'nodes' hat 'stage' (0 bis Anz. Stages-1) und 'row' (0, 1, 2...).\n"
            "4. 'nodes.type' darf AUSSCHLIESSLICH 'frontend', 'backend', 'database', 'cloud', 'security', 'messagebus', 'external' sein.\n"
            "5. 'flows' MUSS 'variant' ('emphasis', 'security', 'dashed') und konkrete Stream-Labels tragen.\n"
            "6. 'meta.animation': 'trace', 'meta.visual_preset': 'signal-flow'.\n"
            "7. SPRACHE: Alle Labels und Titel MÜSSEN auf Deutsch sein!"
        )
    },
    "sequence": {
        "type": "sequence",
        "title_de": "Sequenz- & Protokoll-Ablauf",
        "title_en": "Sequence & Protocol Interaction",
        "description_de": "API-Call-Chains, Handshakes, Failover- und Retry-Pfade mit Latenz-Garantien.",
        "description_en": "API call chains, handshakes, failover, and retry paths with latency guarantees.",
        "system_prompt": (
            "Du bist ein Senior Systems & Protocol Architect. "
            "Erstelle eine reichhaltige Archify 'sequence' JSON-Spezifikation für den interaktiven Protokoll-Ablauf.\n\n"
            "STRIKTES JSON-SCHEMA (keine zusätzlichen Felder erlaubt!):\n"
            "{\n"
            '  "schema_version": 1,\n'
            '  "diagram_type": "sequence",\n'
            '  "meta": {\n'
            '    "title": "Sequenz & Protokoll-Ablauf",\n'
            '    "subtitle": "Handshakes, Signalpfade & mTLS-Verifikation",\n'
            '    "output": "diagram.html",\n'
            '    "animation": "trace",\n'
            '    "visual_preset": "signal-flow",\n'
            '    "quality_profile": "standard"\n'
            '  },\n'
            '  "participants": [\n'
            '    { "id": "edge_client", "type": "frontend", "label": "Edge Agent", "sublabel": "IPC227E / OPC UA", "icon": "frontend" },\n'
            '    { "id": "mlops_core", "type": "backend", "label": "MLOps Core", "sublabel": "gRPC Gateway", "icon": "backend" },\n'
            '    { "id": "model_store", "type": "database", "label": "Model Registry", "sublabel": "Postgres / S3", "icon": "database" }\n'
            '  ],\n'
            '  "messages": [\n'
            '    {\n'
            '      "from": "edge_client",\n'
            '      "to": "mlops_core",\n'
            '      "y": 170,\n'
            '      "label": "POST /v1/telemetry/heartbeat (mTLS 1.3)",\n'
            '      "variant": "security"\n'
            '    },\n'
            '    {\n'
            '      "from": "mlops_core",\n'
            '      "to": "model_store",\n'
            '      "y": 210,\n'
            '      "label": "SELECT active_model_weights (TCP 5432)",\n'
            '      "variant": "emphasis"\n'
            '    }\n'
            '  ]\n'
            "}\n\n"
            "KRITISCHE VALIDIERUNGSREGELN:\n"
            "1. 'participants' mit id, type, label, sublabel, icon. 'type' NUR: 'frontend', 'backend', 'database', 'cloud', 'security', 'messagebus', 'external'.\n"
            "2. 'messages' hat 'from', 'to', 'y' (Zahl >= 160, z. B. 170, 210, 250...), 'label' und 'variant' ('security', 'emphasis', 'dashed', 'return', 'default').\n"
            "3. 'meta.animation': 'trace'.\n"
            "4. SPRACHE: Alle Labels und Titel MÜSSEN auf Deutsch sein!"
        )
    }
}


def get_recipe(recipe_type: str) -> Dict[str, Any]:
    return ARCHIFY_RECIPES.get(recipe_type, ARCHIFY_RECIPES["architecture"])
