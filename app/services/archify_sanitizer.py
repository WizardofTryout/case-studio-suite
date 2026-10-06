import re
import logging
from typing import Dict, Any, List, Optional

logger = logging.getLogger("case_studio.archify_sanitizer")

VALID_COMPONENT_TYPES = {"frontend", "backend", "database", "cloud", "security", "messagebus", "external"}

TYPE_MAPPINGS = {
    "db": "database", "sql": "database", "postgres": "database", "mysql": "database",
    "redis": "database", "mongodb": "database", "storage": "database", "s3": "database",
    "bucket": "database", "datalake": "database", "lake": "database", "datenspeicher": "database",
    "auth": "security", "iam": "security", "firewall": "security", "waf": "security",
    "tls": "security", "mtls": "security", "cert": "security", "vault": "security",
    "sicherheit": "security", "gateway_security": "security",
    "queue": "messagebus", "kafka": "messagebus", "rabbit": "messagebus", "rabbitmq": "messagebus",
    "mqtt": "messagebus", "nats": "messagebus", "pubsub": "messagebus", "stream": "messagebus",
    "broker": "messagebus", "event": "messagebus", "eventbus": "messagebus", "nachrichtenbus": "messagebus",
    "cloud": "cloud", "aws": "cloud", "azure": "cloud", "gcp": "cloud",
    "k8s": "cloud", "kubernetes": "cloud", "cluster": "cloud", "saas": "cloud", "infrastruktur": "cloud",
    "ui": "frontend", "web": "frontend", "client": "frontend", "app": "frontend",
    "portal": "frontend", "dashboard": "frontend", "browser": "frontend", "benutzeroberflaeche": "frontend",
    "partner": "external", "3rdparty": "external", "third_party": "external",
    "legacy": "external", "remote": "external", "api_extern": "external", "drittsystem": "external",
    "worker": "backend", "service": "backend", "pipeline": "backend", "ai_model": "backend",
    "inference": "backend", "model": "backend", "analytics": "backend", "agent": "backend",
    "mlops": "backend", "engine": "backend", "controller": "backend"
}

VALID_VARIANTS = {"default", "emphasis", "security", "dashed"}
VALID_SEQ_VARIANTS = {"default", "emphasis", "security", "dashed", "return"}


def clean_id(raw_id: Any) -> str:
    """Bereinigt eine ID auf das Archify Schema ^[a-zA-Z][a-zA-Z0-9_-]*$"""
    s = str(raw_id).strip()
    # Entferne alle Sonderzeichen außer a-zA-Z0-9_-
    cleaned = re.sub(r'[^a-zA-Z0-9_-]', '_', s)
    # Mehrfache Unterstriche reduzieren
    cleaned = re.sub(r'_+', '_', cleaned).strip('_')
    if not cleaned:
        cleaned = "node"
    # Muss mit Buchstabe beginnen
    if not re.match(r'^[a-zA-Z]', cleaned):
        cleaned = f"n_{cleaned}"
    return cleaned


def normalize_type(raw_type: Any) -> str:
    """Normalisiert beliebige Komponententypen auf die 7 Archify Kern-Typen."""
    t = str(raw_type or "").strip().lower()
    if t in VALID_COMPONENT_TYPES:
        return t
    return TYPE_MAPPINGS.get(t, "backend")


def sanitize_archify_spec(diagram_type: str, spec: Dict[str, Any]) -> Dict[str, Any]:
    """
    Normalisiert und repariert ein beliebiges LLM-generiertes JSON deterministisch,
    sodass es zu 100% dem Ajv-Schema von Archify entspricht.
    """
    if not isinstance(spec, dict):
        spec = {}

    d_type = diagram_type if diagram_type in ("architecture", "dataflow", "sequence") else "architecture"

    if d_type == "architecture":
        return _sanitize_architecture(spec)
    elif d_type == "dataflow":
        return _sanitize_dataflow(spec)
    elif d_type == "sequence":
        return _sanitize_sequence(spec)
    return spec


def _sanitize_meta(raw_meta: Any, default_title: str) -> Dict[str, Any]:
    meta = raw_meta if isinstance(raw_meta, dict) else {}
    title = str(meta.get("title") or default_title).strip()
    if not title:
        title = default_title

    clean_meta: Dict[str, Any] = {
        "title": title,
        "output": "diagram.html",
        "quality_profile": "showcase"
    }
    if meta.get("subtitle") and isinstance(meta["subtitle"], str):
        clean_meta["subtitle"] = meta["subtitle"].strip()
    if meta.get("animation") in ("trace", "none"):
        clean_meta["animation"] = meta["animation"]
    if meta.get("visual_preset") in ("classic", "signal-flow", "blueprint", "editorial"):
        clean_meta["visual_preset"] = meta["visual_preset"]

    return clean_meta


def _sanitize_architecture(spec: Dict[str, Any]) -> Dict[str, Any]:
    id_map: Dict[str, str] = {}
    components_raw = spec.get("components", [])
    if not isinstance(components_raw, list) or len(components_raw) == 0:
        # Fallback falls leer
        components_raw = [
            {"id": "core_service", "type": "backend", "label": "Kernkomponente", "pos": [100, 100], "size": [140, 60]}
        ]

    sanitized_components = []
    seen_ids = set()

    for idx, c in enumerate(components_raw):
        if not isinstance(c, dict):
            continue
        orig_id = c.get("id") or f"comp_{idx+1}"
        cid = clean_id(orig_id)
        if cid in seen_ids:
            cid = f"{cid}_{idx+1}"
        seen_ids.add(cid)
        id_map[str(orig_id)] = cid

        # Pos & Size berechnen
        col = idx % 3
        row = idx // 3
        default_pos = [60 + col * 220, 100 + row * 140]

        pos_raw = c.get("pos")
        pos = default_pos
        if isinstance(pos_raw, list) and len(pos_raw) >= 2:
            try:
                pos = [max(10, float(pos_raw[0])), max(10, float(pos_raw[1]))]
            except (ValueError, TypeError):
                pos = default_pos

        size_raw = c.get("size")
        size = [140, 60]
        if isinstance(size_raw, list) and len(size_raw) >= 2:
            try:
                size = [max(40, float(size_raw[0])), max(30, float(size_raw[1]))]
            except (ValueError, TypeError):
                size = [140, 60]

        comp_dict: Dict[str, Any] = {
            "id": cid,
            "type": normalize_type(c.get("type")),
            "label": str(c.get("label") or cid).strip() or cid,
            "pos": pos,
            "size": size
        }

        if c.get("sublabel") and isinstance(c["sublabel"], str):
            comp_dict["sublabel"] = c["sublabel"].strip()
        if c.get("tag") and isinstance(c["tag"], str):
            comp_dict["tag"] = c["tag"].strip()

        sanitized_components.append(comp_dict)

    if not sanitized_components:
        sanitized_components.append({
            "id": "app_node",
            "type": "backend",
            "label": "System-Knoten",
            "pos": [100, 100],
            "size": [140, 60]
        })
        seen_ids.add("app_node")

    # Boundaries
    sanitized_boundaries = []
    boundaries_raw = spec.get("boundaries", [])
    if isinstance(boundaries_raw, list):
        for b in boundaries_raw:
            if not isinstance(b, dict):
                continue
            wraps_raw = b.get("wraps", [])
            if not isinstance(wraps_raw, list):
                continue
            # Mappe IDs und filtere nur gültige
            mapped_wraps = []
            for w in wraps_raw:
                mapped_id = id_map.get(str(w), clean_id(w))
                if mapped_id in seen_ids and mapped_id not in mapped_wraps:
                    mapped_wraps.append(mapped_id)

            if not mapped_wraps:
                continue

            raw_kind = str(b.get("kind") or "").lower()
            kind = "security-group" if "sec" in raw_kind else "region"

            sanitized_boundaries.append({
                "kind": kind,
                "label": str(b.get("label") or "Zone").strip() or "Zone",
                "wraps": mapped_wraps
            })

    # Connections
    sanitized_connections = []
    connections_raw = spec.get("connections", [])
    if isinstance(connections_raw, list):
        for idx, conn in enumerate(connections_raw):
            if not isinstance(conn, dict):
                continue
            from_raw = str(conn.get("from") or "")
            to_raw = str(conn.get("to") or "")
            from_id = id_map.get(from_raw, clean_id(from_raw))
            to_id = id_map.get(to_raw, clean_id(to_raw))

            if from_id not in seen_ids or to_id not in seen_ids or from_id == to_id:
                continue

            conn_dict: Dict[str, Any] = {
                "id": clean_id(conn.get("id") or f"conn_{idx+1}"),
                "from": from_id,
                "to": to_id,
                "label": str(conn.get("label") or "Trace / Link").strip()
            }
            if conn.get("variant") in VALID_VARIANTS:
                conn_dict["variant"] = conn["variant"]
            if conn.get("route") in ("auto", "straight", "orthogonal-h", "orthogonal-v"):
                conn_dict["route"] = conn["route"]

            sanitized_connections.append(conn_dict)

    result: Dict[str, Any] = {
        "schema_version": 1,
        "diagram_type": "architecture",
        "meta": _sanitize_meta(spec.get("meta"), "System-Architektur Deep-Dive"),
        "components": sanitized_components
    }
    if sanitized_boundaries:
        result["boundaries"] = sanitized_boundaries
    if sanitized_connections:
        result["connections"] = sanitized_connections

    return result


def _sanitize_dataflow(spec: Dict[str, Any]) -> Dict[str, Any]:
    id_map: Dict[str, str] = {}

    # Stages (2 bis 5 erforderlich)
    stages_raw = spec.get("stages", [])
    clean_stages = []
    if isinstance(stages_raw, list):
        for s in stages_raw:
            if isinstance(s, dict) and s.get("label"):
                clean_stages.append({"label": str(s["label"]).strip()})
            elif isinstance(s, str) and s.strip():
                clean_stages.append({"label": s.strip()})

    if len(clean_stages) < 2:
        clean_stages = [
            {"label": "Datenerfassung & Ingestion"},
            {"label": "Inferenz & Feature Engineering"},
            {"label": "Persistenz & Feedback-Schleife"}
        ]
    elif len(clean_stages) > 5:
        clean_stages = clean_stages[:5]

    # Nodes (mindestens 2 erforderlich)
    nodes_raw = spec.get("nodes", [])
    # Falls das LLM fälschlicherweise "components" oder "stages" mit Nodes generiert hat:
    if not isinstance(nodes_raw, list) or len(nodes_raw) == 0:
        if isinstance(spec.get("components"), list) and len(spec["components"]) > 0:
            nodes_raw = spec["components"]

    sanitized_nodes = []
    seen_ids = set()

    stage_row_counts: Dict[int, int] = {}

    for idx, n in enumerate(nodes_raw):
        if not isinstance(n, dict):
            continue
        orig_id = n.get("id") or f"node_{idx+1}"
        nid = clean_id(orig_id)
        if nid in seen_ids:
            nid = f"{nid}_{idx+1}"
        seen_ids.add(nid)
        id_map[str(orig_id)] = nid

        # Stage zuweisen
        stage_idx = 0
        if "stage" in n:
            try:
                stage_idx = max(0, min(len(clean_stages) - 1, int(n["stage"])))
            except (ValueError, TypeError):
                stage_idx = idx % len(clean_stages)
        else:
            stage_idx = idx % len(clean_stages)

        row_idx = stage_row_counts.get(stage_idx, 0)
        stage_row_counts[stage_idx] = row_idx + 1

        node_dict: Dict[str, Any] = {
            "id": nid,
            "type": normalize_type(n.get("type")),
            "label": str(n.get("label") or nid).strip() or nid,
            "stage": stage_idx,
            "row": row_idx
        }
        if n.get("sublabel") and isinstance(n["sublabel"], str):
            node_dict["sublabel"] = n["sublabel"].strip()

        sanitized_nodes.append(node_dict)

    if len(sanitized_nodes) < 2:
        # Erzeuge 2 Dummy-Nodes damit Dataflow valide ist
        n1 = {"id": "source_node", "type": "backend", "label": "Sensor Ingest", "stage": 0, "row": 0}
        n2 = {"id": "process_node", "type": "backend", "label": "Model Engine", "stage": 1, "row": 0}
        sanitized_nodes = [n1, n2]
        seen_ids = {"source_node", "process_node"}

    # Flows
    flows_raw = spec.get("flows", []) or spec.get("streams", []) or spec.get("connections", [])
    sanitized_flows = []
    if isinstance(flows_raw, list):
        for idx, fl in enumerate(flows_raw):
            if not isinstance(fl, dict):
                continue
            from_raw = str(fl.get("from") or "")
            to_raw = str(fl.get("to") or "")
            from_id = id_map.get(from_raw, clean_id(from_raw))
            to_id = id_map.get(to_raw, clean_id(to_raw))

            if from_id not in seen_ids or to_id not in seen_ids or from_id == to_id:
                continue

            flow_dict: Dict[str, Any] = {
                "id": clean_id(fl.get("id") or f"flow_{idx+1}"),
                "from": from_id,
                "to": to_id,
                "label": str(fl.get("label") or "Event-Stream").strip() or "Event-Stream"
            }
            if fl.get("variant") in VALID_VARIANTS:
                flow_dict["variant"] = fl["variant"]

            sanitized_flows.append(flow_dict)

    if not sanitized_flows and len(sanitized_nodes) >= 2:
        sanitized_flows.append({
            "id": "flow_1",
            "from": sanitized_nodes[0]["id"],
            "to": sanitized_nodes[1]["id"],
            "label": "Event Stream"
        })

    return {
        "schema_version": 1,
        "diagram_type": "dataflow",
        "meta": _sanitize_meta(spec.get("meta"), "Datenfluss-Topologie Deep-Dive"),
        "stages": clean_stages,
        "nodes": sanitized_nodes,
        "flows": sanitized_flows
    }


def _sanitize_sequence(spec: Dict[str, Any]) -> Dict[str, Any]:
    id_map: Dict[str, str] = {}

    participants_raw = spec.get("participants", []) or spec.get("actors", [])
    if not isinstance(participants_raw, list) or len(participants_raw) == 0:
        participants_raw = [
            {"id": "client", "type": "frontend", "label": "Client / Edge"},
            {"id": "service", "type": "backend", "label": "MLOps Engine"}
        ]

    sanitized_participants = []
    seen_ids = set()

    for idx, p in enumerate(participants_raw):
        if not isinstance(p, dict):
            continue
        orig_id = p.get("id") or f"p_{idx+1}"
        pid = clean_id(orig_id)
        if pid in seen_ids:
            pid = f"{pid}_{idx+1}"
        seen_ids.add(pid)
        id_map[str(orig_id)] = pid

        part_dict: Dict[str, Any] = {
            "id": pid,
            "type": normalize_type(p.get("type")),
            "label": str(p.get("label") or pid).strip() or pid
        }
        if p.get("sublabel") and isinstance(p["sublabel"], str):
            part_dict["sublabel"] = p["sublabel"].strip()

        sanitized_participants.append(part_dict)

    if len(sanitized_participants) < 2:
        sanitized_participants.append({
            "id": "backend_node",
            "type": "backend",
            "label": "Backend Cluster"
        })
        seen_ids.add("backend_node")

    # Messages
    messages_raw = spec.get("messages", [])
    sanitized_messages = []
    if isinstance(messages_raw, list):
        for idx, m in enumerate(messages_raw):
            if not isinstance(m, dict):
                continue
            from_raw = str(m.get("from") or "")
            to_raw = str(m.get("to") or "")
            from_id = id_map.get(from_raw, clean_id(from_raw))
            to_id = id_map.get(to_raw, clean_id(to_raw))

            if from_id not in seen_ids or to_id not in seen_ids or from_id == to_id:
                continue

            y_val = 170.0 + idx * 40.0
            if "y" in m:
                try:
                    y_parsed = float(m["y"])
                    if y_parsed >= 160:
                        y_val = y_parsed
                except (ValueError, TypeError):
                    pass

            msg_dict: Dict[str, Any] = {
                "id": clean_id(m.get("id") or f"msg_{idx+1}"),
                "from": from_id,
                "to": to_id,
                "y": y_val,
                "label": str(m.get("label") or "Aufruf").strip() or "Aufruf"
            }
            if m.get("variant") in VALID_SEQ_VARIANTS:
                msg_dict["variant"] = m["variant"]

            sanitized_messages.append(msg_dict)

    if not sanitized_messages and len(sanitized_participants) >= 2:
        sanitized_messages.append({
            "id": "msg_1",
            "from": sanitized_participants[0]["id"],
            "to": sanitized_participants[1]["id"],
            "y": 170.0,
            "label": "gRPC Request / Sync"
        })

    meta = _sanitize_meta(spec.get("meta"), "Sequenz-Ablauf Deep-Dive")
    meta["column_fit"] = "spread"

    return {
        "schema_version": 1,
        "diagram_type": "sequence",
        "meta": meta,
        "participants": sanitized_participants,
        "messages": sanitized_messages
    }
