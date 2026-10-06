#!/bin/bash
set -euo pipefail

echo "=========================================================="
echo " [TEST] Smoke-Test: Archify Headless Sidecar"
echo "=========================================================="

echo "[1/3] Teste Health-Endpunkt auf http://archify-service:3001/health ..."
HEALTH_RES=$(docker compose exec -T case-studio-suite python -c "
import urllib.request, json
try:
    with urllib.request.urlopen('http://archify-service:3001/health', timeout=5) as r:
        data = json.loads(r.read().decode())
        print(data.get('status'))
except Exception as e:
    print('ERROR:', e)
")

if [ "$HEALTH_RES" != "ok" ]; then
    echo "❌ FEHLER: Healthcheck fehlgeschlagen. Ausgabe: $HEALTH_RES"
    exit 1
fi
echo "✅ Healthcheck OK (status: ok)"

echo "[2/3] Teste Render-Endpunkt mit valider Architektur-Spec ..."
RENDER_TEST=$(docker compose exec -T case-studio-suite python -c "
import urllib.request, json

payload = {
    'type': 'architecture',
    'quality': 'showcase',
    'spec': {
        'schema_version': 1,
        'diagram_type': 'architecture',
        'meta': {
            'title': 'Smoke Test Architecture',
            'output': 'smoke-test.html',
            'quality_profile': 'showcase'
        },
        'components': [
            { 'id': 'frontend', 'type': 'external', 'label': 'Web UI', 'pos': [40, 100], 'size': [120, 60] },
            { 'id': 'backend', 'type': 'backend', 'label': 'API Gateway', 'pos': [250, 100], 'size': [120, 60] }
        ],
        'connections': [
            { 'id': 'c1', 'from': 'frontend', 'to': 'backend', 'label': 'REST API' }
        ]
    }
}

req = urllib.request.Request(
    'http://archify-service:3001/api/render',
    data=json.dumps(payload).encode('utf-8'),
    headers={'Content-Type': 'application/json'},
    method='POST'
)

try:
    with urllib.request.urlopen(req, timeout=15) as r:
        res = json.loads(r.read().decode())
        success = res.get('success', False)
        html = res.get('html', '')
        has_svg = '<svg' in html
        has_doctype = '<!DOCTYPE html>' in html
        print(f'{success}|{has_doctype}|{has_svg}|{len(html)}')
except urllib.error.HTTPError as e:
    print('HTTP_ERROR:', e.code, e.read().decode())
except Exception as e:
    print('ERROR:', e)
")

echo "Render-Ergebnis: $RENDER_TEST"
if [[ "$RENDER_TEST" =~ ^True\|True\|True\|[0-9]+$ ]]; then
    echo "✅ Rendering erfolgreich! Standalone-HTML mit <svg> Block erhalten."
else
    echo "❌ FEHLER: Unerwartetes Render-Ergebnis: $RENDER_TEST"
    exit 1
fi

echo "[3/3] Teste Fehlerbehandlung (HTTP 422 bei fehlerhafter Spec) ..."
ERROR_TEST=$(docker compose exec -T case-studio-suite python -c "
import urllib.request, json

# Ungültige Spec (fehlende Pflichtfelder: schema_version, components etc.)
payload = {
    'type': 'architecture',
    'spec': {
        'invalid_key': 'test'
    }
}

req = urllib.request.Request(
    'http://archify-service:3001/api/render',
    data=json.dumps(payload).encode('utf-8'),
    headers={'Content-Type': 'application/json'},
    method='POST'
)

try:
    with urllib.request.urlopen(req, timeout=10) as r:
        print('UNEXPECTED_200')
except urllib.error.HTTPError as e:
    res = json.loads(e.read().decode())
    print(f'{e.code}|{res.get(\"stage\")}')
except Exception as e:
    print('ERROR:', e)
")

echo "Fehlerbehandlungs-Ergebnis: $ERROR_TEST"
if [[ "$ERROR_TEST" == "422|validate" ]]; then
    echo "✅ Validierungsfehler liefert erwartungsgemäß HTTP 422 mit Diagnostics für Repair-Loop."
else
    echo "❌ FEHLER: Erwartet 422|validate, erhalten: $ERROR_TEST"
    exit 1
fi

echo "=========================================================="
echo "🎉 ALLE TESTS IN SPRINT 1 ERFOLGREICH BESTANDEN (EXIT 0)"
echo "=========================================================="
exit 0
