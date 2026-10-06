from typing import Dict, Any

# Strikte Definition der Archify-Rezepte gemäß schemas/*.schema.json
ARCHIFY_RECIPES: Dict[str, Dict[str, Any]] = {
    "architecture": {
        "type": "architecture",
        "title_de": "System-Architektur & Deployment-Topologie",
        "title_en": "System Architecture & Deployment Topology",
        "description_de": "Komponenten, Container, Sicherheitsgrenzen und Netzwerkpfade.",
        "description_en": "Components, containers, security boundaries, and network paths.",
        "system_prompt": (
            "Du bist ein Senior Software & Enterprise Architect. "
            "Erstelle eine präzise Archify 'architecture' JSON-Spezifikation für den fokussierten Systembaustein.\n\n"
            "STRIKTES JSON-SCHEMA:\n"
            "{\n"
            '  "schema_version": 1,\n'
            '  "diagram_type": "architecture",\n'
            '  "meta": {\n'
            '    "title": "Prägnanter Titel",\n'
            '    "output": "diagram.html",\n'
            '    "quality_profile": "showcase"\n'
            '  },\n'
            '  "components": [\n'
            '    {\n'
            '      "id": "eindeutige_id_ohne_leerzeichen",\n'
            '      "type": "backend", // NUR ERLAUBT: "frontend", "backend", "database", "cloud", "security", "messagebus", "external"\n'
            '      "label": "Name der Komponente",\n'
            '      "sublabel": "Zusatzinfo (z.B. Port/Protokoll)",\n'
            '      "pos": [40, 100], // [x, y] Koordinaten als positive Zahlen\n'
            '      "size": [130, 60] // [width, height]\n'
            '    }\n'
            '  ],\n'
            '  "boundaries": [\n'
            '    {\n'
            '      "kind": "region", // NUR ERLAUBT: "region" ODER "security-group"\n'
            '      "label": "Name der Gruppe",\n'
            '      "wraps": ["id1", "id2"] // Array von component ids\n'
            '    }\n'
            '  ],\n'
            '  "connections": [\n'
            '    {\n'
            '      "id": "conn-1",\n'
            '      "from": "source_id",\n'
            '      "to": "target_id",\n'
            '      "label": "Protokoll / Daten"\n'
            '    }\n'
            '  ]\n'
            "}\n\n"
            "REGELN:\n"
            "1. Antworte AUSSCHLIESSLICH mit gültigem JSON (kein Markdown, keine Backticks).\n"
            "2. Keine erfundenen Felder! (additionalProperties: false im Schema).\n"
            "3. 'boundaries.kind' darf AUSSCHLIESSLICH 'region' oder 'security-group' sein.\n"
            "4. 'components.type' darf AUSSCHLIESSLICH 'frontend', 'backend', 'database', 'cloud', 'security', 'messagebus' oder 'external' sein.\n"
            "5. Platziere Komponenten mit sauberen Abständen (z. B. pos x: 40, 240, 440, 640; pos y: 100, 240, 380).\n"
            "6. SPRACHE: Alle Labels, Titel und Sublabels MÜSSEN in der geforderten Zielsprache formuliert sein!"
        )
    },
    "dataflow": {
        "type": "dataflow",
        "title_de": "Datenfluss & Event-Stream Topologie",
        "title_en": "Data Flow & Event-Stream Topology",
        "description_de": "Pipelines, Puffer, Transformationen und Persistenz.",
        "description_en": "Pipelines, buffers, transformations, and persistence.",
        "system_prompt": (
            "Du bist ein Senior Data & Stream Processing Architect. "
            "Erstelle eine präzise Archify 'dataflow' JSON-Spezifikation.\n\n"
            "STRIKTES JSON-SCHEMA:\n"
            "{\n"
            '  "schema_version": 1,\n'
            '  "diagram_type": "dataflow",\n'
            '  "meta": {\n'
            '    "title": "Prägnanter Titel",\n'
            '    "output": "diagram.html",\n'
            '    "quality_profile": "showcase"\n'
            '  },\n'
            '  "stages": [\n'
            '    {\n'
            '      "id": "stage1",\n'
            '      "label": "Ingestion",\n'
            '      "type": "source", // "source", "process", "sink"\n'
            '      "pos": [40, 100],\n'
            '      "size": [130, 60]\n'
            '    }\n'
            '  ],\n'
            '  "streams": [\n'
            '    {\n'
            '      "from": "stage1",\n'
            '      "to": "stage2",\n'
            '      "label": "Events / sec"\n'
            '    }\n'
            '  ]\n'
            "}\n\n"
            "REGELN:\n"
            "1. Antworte AUSSCHLIESSLICH mit gültigem JSON (kein Markdown, keine Backticks).\n"
            "2. Keine erfundenen Felder.\n"
            "3. SPRACHE: Alle Labels in der geforderten Zielsprache!"
        )
    },
    "sequence": {
        "type": "sequence",
        "title_de": "Sequenz- & Protokoll-Ablauf",
        "title_en": "Sequence & Protocol Interaction",
        "description_de": "API-Call-Chains, Handshakes, Failover- und Retry-Pfade.",
        "description_en": "API call chains, handshakes, failover, and retry paths.",
        "system_prompt": (
            "Du bist ein Senior Systems & Protocol Architect. "
            "Erstelle eine präzise Archify 'sequence' JSON-Spezifikation.\n\n"
            "STRIKTES JSON-SCHEMA:\n"
            "{\n"
            '  "schema_version": 1,\n'
            '  "diagram_type": "sequence",\n'
            '  "meta": {\n'
            '    "title": "Prägnanter Titel",\n'
            '    "output": "diagram.html",\n'
            '    "quality_profile": "showcase"\n'
            '  },\n'
            '  "actors": [\n'
            '    { "id": "client", "label": "Client / Browser" },\n'
            '    { "id": "api", "label": "API Gateway" },\n'
            '    { "id": "db", "label": "Datenbank" }\n'
            '  ],\n'
            '  "messages": [\n'
            '    {\n'
            '      "from": "client",\n'
            '      "to": "api",\n'
            '      "label": "POST /request"\n'
            '    }\n'
            '  ]\n'
            "}\n\n"
            "REGELN:\n"
            "1. Antworte AUSSCHLIESSLICH mit gültigem JSON (kein Markdown, keine Backticks).\n"
            "2. Keine erfundenen Felder.\n"
            "3. SPRACHE: Alle Labels in der geforderten Zielsprache!"
        )
    }
}


def get_recipe(recipe_type: str) -> Dict[str, Any]:
    return ARCHIFY_RECIPES.get(recipe_type, ARCHIFY_RECIPES["architecture"])
