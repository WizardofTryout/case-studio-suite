import re
from typing import Dict, Any, List, Set


def extract_node_subgraph_context(mermaid_text: str, target_node: str) -> Dict[str, Any]:
    """
    Extrahiert deterministisch den Kontext eines Mermaid-Knotens:
    - Direkte Vor- und Nachgänger
    - Kantenbeschriftungen
    - Zugehörige Subgraphs / Cluster
    - Definitionen und Labels
    """
    if not mermaid_text or not target_node:
        return {
            "target_node": target_node,
            "found": False,
            "incoming": [],
            "outgoing": [],
            "subgraphs": [],
            "raw_context_lines": []
        }

    lines = [l.strip() for l in mermaid_text.splitlines() if l.strip()]
    target_clean = target_node.strip()
    target_lower = target_clean.lower()

    incoming: List[Dict[str, str]] = []
    outgoing: List[Dict[str, str]] = []
    subgraphs: List[str] = []
    matched_lines: List[str] = []

    current_subgraph: str = ""

    # Regex für Pfeilverbindungen wie: A -->|Label| B  oder  A --> B  oder  A -.-> B
    arrow_pattern = re.compile(
        r'([\w\-]+)(?:\[.*?\]|\(.*?\))?\s*'
        r'([=\-\.]{1,3}>|\-\->|\-\-\>|==>|--)\s*'
        r'(?:\|([^|]+)\|)?\s*'
        r'([\w\-]+)(?:\[.*?\]|\(.*?\))?'
    )

    for line in lines:
        # Subgraph-Erkennung
        if line.lower().startswith("subgraph"):
            sub_title = line[8:].strip().strip('"').strip("'")
            current_subgraph = sub_title
            continue
        elif line.lower() == "end":
            current_subgraph = ""
            continue

        # Prüfe, ob die Zeile den Knoten erwähnt
        if target_lower in line.lower():
            matched_lines.append(line)
            if current_subgraph and current_subgraph not in subgraphs:
                subgraphs.append(current_subgraph)

        # Kanten analysieren
        match = arrow_pattern.search(line)
        if match:
            source = match.group(1).strip()
            arrow = match.group(2).strip()
            edge_label = (match.group(3) or "").strip()
            target = match.group(4).strip()

            if source.lower() == target_lower or target_lower in source.lower():
                outgoing.append({
                    "to": target,
                    "relation": arrow,
                    "label": edge_label,
                    "raw": line
                })
            elif target.lower() == target_lower or target_lower in target.lower():
                incoming.append({
                    "from": source,
                    "relation": arrow,
                    "label": edge_label,
                    "raw": line
                })

    return {
        "target_node": target_clean,
        "found": len(matched_lines) > 0,
        "incoming": incoming,
        "outgoing": outgoing,
        "subgraphs": subgraphs,
        "raw_context_lines": matched_lines[:15]
    }
