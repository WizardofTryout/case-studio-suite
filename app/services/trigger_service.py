import json
import logging
import re
from typing import List, Dict, Any, Optional

from app.config import settings
from app.core.gemini_pool import key_pool
from app.db import repositories

logger = logging.getLogger("case_studio.trigger_service")

# ============================================================================
# 7 ENTERPRISE DOMAIN PRESETS
# ============================================================================

DOMAIN_PRESETS: Dict[str, Dict[int, List[Dict[str, str]]]] = {
    "industrial_ot": {
        1: [
            {"label": "🎯 Ziel: OPEX vs. Qualität", "prompt": "Kläre das Hauptziel des Kunden: Geht es primär um OPEX-Senkung durch weniger Werkzeugbruch oder um kompromisslose Fertigungsqualität?"},
            {"label": "📊 Datenlage: Silos vs. DWH", "prompt": "Prüfe die vorhandene Datenlage: Liegen die Sensordaten aktuell in proprietären Maschinensilos oder existiert bereits ein angebundenes DWH (Data Warehouse)?"},
            {"label": "⏱️ Latenzvorgaben (<20ms)", "prompt": "Kläre die maximal tolerierbare Latenz an der Linie (<20ms) und Not-Aus-Szenarien für die Frässpindeln."},
            {"label": "👥 Budget & Stakeholder", "prompt": "Erfasse das freigegebene Budget (CAPEX/OPEX) sowie die relevanten Entscheidungsträger (Werkleitung, IT-Leitung, Betriebsrat)."}
        ],
        2: [
            {"label": "⚙️ SPS/OPC UA & Edge Ingest", "prompt": "Detailliere die OT- und Edge-Schicht: Anbindung der SIMATIC SPS über PROFINET und OPC UA an ein Industrial Edge Device (IED)."},
            {"label": "⚡ Kafka Telemetrie Pipeline", "prompt": "Modelliere die hochverfügbare Event-Streaming-Pipeline mit Apache Kafka und Kafka Connect für 10.000 Telemetrie-Events/Sekunde."},
            {"label": "❄️ Snowflake / dbt Lakehouse", "prompt": "Entwirf die analytische Speicherschicht in Snowflake unter Verwendung von Apache Iceberg und dbt für Medallion-Tabellen (Bronze/Silver/Gold)."},
            {"label": "🤖 MCP Instandhaltungs-Agent", "prompt": "Integriere autonome KI-Agenten über MCP (Model Context Protocol) zur Kopplung von Schwingungs-Telemetrie mit dem SAP PM Instandhaltungssystem."}
        ],
        3: [
            {"label": "⚖️ Edge vs. Cloud Trade-Off", "prompt": "Analysiere den Trade-Off zwischen Edge-Inferenz (<10ms Latenz, keine Cloud-Kosten) und zentralem Cloud-Training mit globalem Modell-Abgleich."},
            {"label": "🛡️ 48h Offline-Puffer bei Netzausfall", "prompt": "Spezifiziere das Failover-Konzept bei vollständigem Hallennetzwerk-Ausfall: Lokaler NVMe/SQLite 48h-Ringpuffer auf dem Edge Device mit Re-Sync."},
            {"label": "🔒 IEC 62443 Security-Zonen", "prompt": "Härte die Architektur nach IEC 62443: Zonentrennung (Purdue Level 2 vs. Level 3), Dual-Homed Network Adapter, mTLS und TPM 2.0 Chip."},
            {"label": "⚡ Deterministik vs. LLM Not-Aus", "prompt": "Beweise, warum sicherheitskritische Not-Abschaltungen deterministisch im Millisekundenbereich laufen müssen und niemals von probabilistischen LLMs abhängen dürfen."}
        ],
        4: [
            {"label": "📈 OEE +3.4% & ROI in 8.5 Mon.", "prompt": "Kalkuliere den konkreten Business Case: OEE-Steigerung um 3.4%, Reduktion des Ausschusses um 65% und ROI in 8.5 Monaten bei €450k Investition."},
            {"label": "🗓️ 3-Phasen-Roadmap (PoC->Pilot->Scale)", "prompt": "Definiere den zeitlichen Phasenplan: 6 Wochen PoC an 2 Maschinen, 3 Monate Pilotlinie (24 Maschinen), Rollout auf alle 120 Anlagen in 9 Monaten."},
            {"label": "👔 Senior Workstream-Ownership", "prompt": "Strukturiere die Verantwortlichkeiten in 3 Workstreams (OT-Integration, Cloud-Data-Plattform, Shopfloor-Enablement) mit klaren Deliverables."},
            {"label": "🔄 Change Management Werker", "prompt": "Entwickle das Change Management Konzept: Schulung der Maschinenbediener, Betriebsrat-Freigabe für Werker-Assistenz und kontinuierliche Modellvalidierung."}
        ]
    },

    "energy_grid": {
        1: [
            {"label": "🎯 Ziel: Lastspitzen & Stabilität", "prompt": "Kläre das Hauptziel des Netzbetreibers: Geht es um Lastspitzen-Glättung (Peak Shaving), Redispatch 2.0-Konformität oder Vermeidung von Netzentgelten?"},
            {"label": "📊 Smart Meter & SCADA Silos", "prompt": "Erfasse die Datenlage: Welche Daten liegen in der SCADA-Leitwarte vor und wie ist der Rollout-Status intelligenter Messsysteme (Smart Meter Gateway)?"},
            {"label": "⏱️ EnWG- & Netzvorgaben", "prompt": "Kläre die regulatorischen Fristen gemäß EnWG und BNetzA sowie Reaktionszeiten für Regelleistung (<30s)."},
            {"label": "👥 Netzbetreiber & Stadtwerke", "prompt": "Identifiziere die Schlüssel-Stakeholder: Übertragungsnetzbetreiber (ÜNB), Verteilnetzbetreiber (VNB), Regulierungsbehörde und C-Level der Stadtwerke."}
        ],
        2: [
            {"label": "⚙️ IEC 61850 & SCADA Ingest", "prompt": "Architekturiere die Vor-Ort-Anbindung von Umspannwerken und Transformatorstationen über IEC 60870-5-104 und IEC 61850 an Edge-Gateways."},
            {"label": "⚡ Kafka Time-Series Streaming", "prompt": "Modelliere die verteilte Event-Streaming-Pipeline für hochfrequente Lastgang- und Phasoren-Telemetrie mit Apache Kafka."},
            {"label": "❄️ Utility Lakehouse Prognosen", "prompt": "Konzipiere das Zeitreihen-Lakehouse für Netzlastprognosen, Einspeise-Vorhersagen und historische Lastgang-Analysen."},
            {"label": "🤖 MCP Lastfluss-Steuerungs-Agent", "prompt": "Integriere autonome KI-Agenten über MCP zur vorausschauenden Einspeisesteuerung via SCADA und automatisierten Netzentlastungs-Schaltungen."}
        ],
        3: [
            {"label": "⚖️ Substation Edge vs. Leitwarte", "prompt": "Analysiere den Trade-off: Autonome Schaltung am Umspannwerk-Edge vs. zentrale Lastflussoptimierung in der Cloud-Leitwarte."},
            {"label": "🛡️ 72h Inselbetrieb & Resilienz", "prompt": "Spezifiziere das Notfall-Konzept bei Blackout und Kommunikationsabbruch: 72 Stunden autonomer Inselbetrieb und USV-Pufferung."},
            {"label": "🔒 BSI-Kritis & ISO 27019", "prompt": "Härte die Leitstellen-Architektur nach BSI IT-Sicherheitskatalog, Kritis-Verordnung und ISO/IEC 27019 mit strenger Netztrennung."},
            {"label": "⚡ Deterministische Lastabwürfe", "prompt": "Sichere ab, dass netzkritische Schutzabschaltungen und Frequenzhaltungs-Lastabwürfe hard-deterministisch ohne KI-Latenzen erfolgen."}
        ],
        4: [
            {"label": "📈 Peak-Shaving ROI & Entgelte", "prompt": "Quantifiziere den Business Case: Einsparung vermiedener Netzentgelte nach §19 StromNEV, Rendite durch Flexibilitätsvermarktung und Amortisation in 11 Monaten."},
            {"label": "🗓️ 3-Phasen-Rollout (Pilot->Netz)", "prompt": "Strukturiere den Rollout: Phase A (3 Pilot-Umspannwerke, 8 Wochen), Phase B (Mittelspannungsring, 4 Monate), Phase C (Gesamtnetz-Skalierung, 10 Monate)."},
            {"label": "👔 Workstreams Netz & IT", "prompt": "Definiere 3 Kern-Workstreams: Schutztechnik & Fernwirktechnik, Cloud-Data-Plattform & ML-Prognose, Regulatorik & Netzwirtschaft."},
            {"label": "🔄 Leitwarten-Enablement", "prompt": "Gestalte den Change-Prozess für Netzleittechniker: Übergang von starren Schaltplänen zu KI-assistierten Dispatch-Empfehlungen mit Freigabe-Gates."}
        ]
    },

    "logistics": {
        1: [
            {"label": "🎯 Ziel: Durchlaufzeit vs. Flotte", "prompt": "Kläre das Hauptziel des Logistik-Hubs: Steigerung des Paket-/Frachtdurchsatzes, Minimierung von Standzeiten (Yard) oder Senkung der Flotten-TCO?"},
            {"label": "📊 Telematik & Altsystem-Silos", "prompt": "Prüfe vorhandene Silos: Proprietäre Telematik-Boxen, veraltetes Warehouse Management System (WMS) und fragmentierte TMS-Schnittstellen."},
            {"label": "⏱️ SLA & Tracking-Latenzen", "prompt": "Kläre SLA-Vorgaben: Maximale Paket-Umlaufzeit im Hub (<15min) und Tracking-Aktualisierungsraten (<5s bei kritischen Gütern)."},
            {"label": "👥 Stakeholder Hub & Verlader", "prompt": "Erfasse Stakeholder: Hub-Leitung, Disponenten, Verlader, Transportdienstleister und Zoll-/Luftsicherheitsbehörden."}
        ],
        2: [
            {"label": "⚙️ Telematik- & IoT-Sensor Ingest", "prompt": "Modelliere die Erfassung von CAN-Bus-, OBD-II-, RFID- und Bluetooth-Low-Energy-Sensordaten an Hub-Toren und Förderbändern."},
            {"label": "⚡ Real-Time Tracking Pipeline", "prompt": "Entwirf die Apache Kafka Streaming-Architektur für Millionen GPS-Pings, Barcode-Scans und AGV-Telemetrie-Events pro Stunde."},
            {"label": "❄️ Logistics Graph & Lakehouse", "prompt": "Konzipiere die Datenhaltung: Graph-Datenbank für Routen- und Hub-Netzwerke kombiniert mit Lakehouse für Flotten-Analytik."},
            {"label": "🤖 MCP ETA- & Dispositions-Agent", "prompt": "Integriere autonome KI-Agenten über MCP zur dynamischen Fracht-/Gepäck-Umleitung bei Bandstillständen und automatisierter Techniker-Alarmierung."}
        ],
        3: [
            {"label": "⚖️ Hub Edge vs. Zentrale Cloud", "prompt": "Bewerte den Trade-Off: Lokale Sortierlogik an Weichen (<50ms) vs. netzwerkweite Routenoptimierung in der Cloud."},
            {"label": "🛡️ Funkloch-Puffer & Offline-Gate", "prompt": "Definiere das Ausfallkonzept: Lokale Pufferung auf LKW-Bordcomputern und Hub-Gates bei Verlust von LTE/WLAN mit automatischem Burst-Sync."},
            {"label": "🔒 TISAX & DSGVO Fahrer-Tracking", "prompt": "Sichere die Architektur ab: DSGVO-konforme Anonymisierung von Fahrdaten, TISAX-Auditierung und Schutz vor Frachtdaten-Manipulation."},
            {"label": "⚡ Deterministische Weichensteuerung", "prompt": "Beweise, warum physische Gepäck- und Paket-Ausschleuser deterministisch über SPS gesteuert werden und KI nur Richtungs-Entscheidungen liefert."}
        ],
        4: [
            {"label": "📈 Touren-Optimierung -14% & TCO", "prompt": "Berechne den Business Value: 14% reduzierte Leerfahrten, 80% weniger verspätete Gepäckstücke/Pakete, Amortisation des Hub-Upgrades in 7 Monaten."},
            {"label": "🗓️ 3-Phasen Hub-Rollout", "prompt": "Entwickle die Roadmap: Phase A (Gate 1 & Pilot-Linie, 6 Wochen), Phase B (Gesamtes Hub-Terminal, 3 Monate), Phase C (Multihub-Netzwerk, 8 Monate)."},
            {"label": "👔 Workstream-Zuschnitt", "prompt": "Strukturiere 3 Workstreams: Fördertechnik & Hardware-Sensorik, Streaming-Plattform & Dispositions-KI, Flotten- & Hub-Betrieb."},
            {"label": "🔄 Disponenten-Schulung", "prompt": "Plane das Change Management: Schulung von Disponenten und Bodenpersonal für Vertrauen in KI-gestützte dynamische Slot-Vergabe."}
        ]
    },

    "cloud_enterprise": {
        1: [
            {"label": "🎯 Ziel: TCO vs. Modernisierung", "prompt": "Kläre das Hauptziel: Ablösung teurer Legacy-Monolithen, Beschleunigung der Time-to-Market oder Reduktion von Lizenz- und Infrastrukturkosten (TCO)?"},
            {"label": "📊 Mainframe- & Datenbanksilos", "prompt": "Analysiere den Ist-Zustand: Relationale Monolithen (Oracle/DB2), Mainframe-Transaktionen und fehlende API-Schnittstellen."},
            {"label": "⏱️ RTO/RPO & Verfügbarkeits-SLAs", "prompt": "Kläre die Verfügbarkeitsanforderungen: RTO < 5 Minuten, RPO = 0 (kein Datenverlust) und 99.99% Uptime im Enterprise-Betrieb."},
            {"label": "👥 Enterprise Architects & C-Level", "prompt": "Erfasse Entscheidungsträger: Enterprise Architecture Board, Chief Information Officer (CIO), Chief Security Officer (CISO) und Fachbereichsleiter."}
        ],
        2: [
            {"label": "⚙️ CDC Ingest aus Legacy-DBs", "prompt": "Konzipiere die Change-Data-Capture-Schicht (Debezium / Kafka Connect) zum unterbrechungsfreien Abzug transaktionaler Daten aus Legacy-Systemen."},
            {"label": "⚡ Event-Driven Microservices", "prompt": "Entwirf das Event-Driven Architecture (EDA) Backbone mit Kafka/EventHub, API Gateways und containerisierten Microservices (K8s)."},
            {"label": "❄️ Cloud Data Lakehouse & dbt", "prompt": "Architekturiere das moderne Enterprise Lakehouse mit getrennter Compute/Storage-Skalierung, Iceberg-Tabellen und dbt Transformations-Pipelines."},
            {"label": "🤖 MCP API- & Vorfall-Triage-Agent", "prompt": "Integriere autonome KI-Agenten über MCP zur automatisierten Vorfall-Triage, Log-Analyse und Jira/ServiceNow Ticketerstellung."}
        ],
        3: [
            {"label": "⚖️ Strangler Fig vs. Big Bang", "prompt": "Analysiere die Migrationsstrategie: Schrittweises Strangler Fig Pattern mit Routing am API Gateway vs. riskante Big-Bang-Ablösung."},
            {"label": "🛡️ Multi-Region Failover & DR", "prompt": "Definiere das Disaster-Recovery-Konzept: Multi-Region Active-Passive vs. Active-Active Failover mit automatischer DNS-Umschaltung."},
            {"label": "🔒 Zero-Trust & IAM Governance", "prompt": "Härte die Cloud-Architektur nach Zero-Trust: mTLS zwischen Microservices, OIDC/OAuth2 Token-Exchange und Least-Privilege IAM-Rollen."},
            {"label": "⚡ FinOps & Cloud-Kostenkontrolle", "prompt": "Stelle Strategien gegen Kostenexplosion auf: Auto-Scaling, Spot Instances, Reserved Capacity und kontinuierliches FinOps-Monitoring."}
        ],
        4: [
            {"label": "📈 TCO -40% & Lizenz-Einsparung", "prompt": "Berechne den quantitativen Business Case: 40% geringere Betriebskosten durch Cloud-Migration, Wegfall teurer RDBMS-Lizenzen, Break-Even in 10 Monaten."},
            {"label": "🗓️ 3-Phasen Migrations-Roadmap", "prompt": "Plane die Migrationswellen: Wave 1 (Core Data Platform & Non-Critical Services, 3 Mon.), Wave 2 (Hauptgeschäftsprozesse, 6 Mon.), Wave 3 (Legacy Decommissioning, 9 Mon.)."},
            {"label": "👔 Enterprise Workstream-Lead", "prompt": "Lege 3 Workstreams fest: Cloud Infrastructure & Landing Zone, Application Modernization & APIs, Enterprise Data & AI."},
            {"label": "🔄 CCoE & DevOps Kulturwandel", "prompt": "Konzipiere das Cloud Center of Excellence (CCoE): Enablement der Entwicklerteams, CI/CD-Standards und Kulturwandel hin zu Product Teams."}
        ]
    },

    "medtech": {
        1: [
            {"label": "🎯 Ziel: Patientenschutz & Durchsatz", "prompt": "Kläre das Hauptziel: Erhöhung der Diagnosegenauigkeit, Reduktion von Patientenwartezeiten oder regulatorische Konformität (MDR/FDA)?"},
            {"label": "📊 DICOM-, PACS- & FHIR-Silos", "prompt": "Prüfe die klinische Datenlage: Proprietäre Sensoren an Dialyse-/Beatmungsgeräten, PACS-Bilddatenbanken und isolierte KIS-Systeme."},
            {"label": "⏱️ Echtzeit-Vitaldaten (<50ms)", "prompt": "Kläre Latenzgrenzen für vitale Alarmierungen (<50ms) und Notfall-Abschaltungen vernetzter Medizingeräte."},
            {"label": "👥 Klinikleiter & Regulatory Affairs", "prompt": "Erfasse Entscheidungsträger: Ärztliche Direktion, Medizintechnik-Leitung, Datenschutzbeauftragte (DSGVO/HIPAA) und Benannte Stellen."}
        ],
        2: [
            {"label": "⚙️ HL7 / FHIR & Geräteschnittstellen", "prompt": "Modelliere die interoperable Ingestion von Medizingerätedaten über HL7 v2, FHIR REST APIs und DICOM an zertifizierte Medical Gateways."},
            {"label": "⚡ Sicheres Telemetrie-Streaming", "prompt": "Architekturiere die Event-Streaming-Pipeline für hochfrequente EKG-, Blutdruck- und Beatmungsparameter mit Ende-zu-Ende-Verschlüsselung."},
            {"label": "❄️ Validiertes Medical Lakehouse", "prompt": "Konzipiere das GxP- und HIPAA-konforme Lakehouse mit unveränderbarem Audit Trail für klinische Studien und Qualitätsmonitoring."},
            {"label": "🤖 MCP Diagnose-Assistenz-Agent", "prompt": "Integriere autonome KI-Agenten über MCP zur regulatorisch konformen Auswertung von Telemetriedaten mit Freigabe-Gate für Klinikpersonal."}
        ],
        3: [
            {"label": "⚖️ Bedside Edge vs. Klinik-Cloud", "prompt": "Analysiere den Trade-Off: Lokale Alarmierung am Patientenbett (Ausfallsicher) vs. stationsübergreifende Trendanalysen im Klinik-Rechenzentrum."},
            {"label": "🛡️ 100% Ausfallsicherheit bei Netzausfall", "prompt": "Spezifiziere das Failover-Konzept bei Kliniknetzwerk-Ausfall: Lokale Sensorik und lebensrettende Aktionen bleiben vollständig autonom aktiv."},
            {"label": "🔒 MDR Klasse IIb/III & ISO 13485", "prompt": "Härte die Software nach ISO 13485, IEC 62304 und MDR Software-as-a-Medical-Device (SaMD) mit kryptografischer Signatur."},
            {"label": "⚡ Human-in-the-Loop Freigabe", "prompt": "Verankere verbindliche Sicherheits-Schranken: KI empfiehlt Dosierungen oder Diagnosen ausschließlich als Zweitmeinung; Freigabe obliegt dem Arzt."}
        ],
        4: [
            {"label": "📈 Behandlungszeit -25% & Sicherheit", "prompt": "Kalkuliere den Nutzen: 25% schnellere klinische Durchlaufzeit, 60% weniger Fehldosierungen, Reduktion von Haftungsrisiken und ROI in 9 Monaten."},
            {"label": "🗓️ 3-Phasen Zulassungs-Roadmap", "prompt": "Strukturiere die Roadmap: Phase A (Klinische Machbarkeit & Labortest, 3 Mon.), Phase B (Validierungsstudie & CE/FDA-Einreichung, 6 Mon.), Phase C (Klinikweiter Rollout, 9 Mon.)."},
            {"label": "👔 Workstreams Klinik & Regulierung", "prompt": "Definiere 3 Workstreams: MedTech-Hardware & Sensorik, Zulassung & Regulatory Affairs, Klinische Integration & Anwender-Training."},
            {"label": "🔄 Klinikpersonal-Enablement", "prompt": "Plane Schulungsprogramme für Pflegepersonal und Ärzte zur nahtlosen Übernahme der digitalen Assistenz ohne bürokratische Mehrbelastung."}
        ]
    },

    "smart_buildings": {
        1: [
            {"label": "🎯 Ziel: ESG & Energiekosten", "prompt": "Kläre das Hauptziel: Reduktion der Energiekosten (Heizung/Klima/Lüftung), Erreichen von ESG-Reporting-Zielen oder Steigerung des Nutzerkomforts?"},
            {"label": "📊 Heterogene GLT- & Zählersilos", "prompt": "Erfasse den Gebäudezustand: Heterogene Gebäudeleittechnik (GLT), proprietäre Zähler und fehlende Schnittstellen zwischen Gewerken."},
            {"label": "⏱️ Regelzykluszeiten (<30s)", "prompt": "Kläre Latenzvorgaben für die Raumklima-Regelung (<30s) und Brand-/Rauchschutz-Abschaltungen im Sekundenbereich."},
            {"label": "👥 Facility Manager & ESG-Board", "prompt": "Identifiziere Entscheidungsträger: Facility Management, Corporate Real Estate Director, ESG-Verantwortliche und Mietervertreter."}
        ],
        2: [
            {"label": "⚙️ BACnet, Modbus & LoRaWAN Ingest", "prompt": "Modelliere die Erfassung von Temperatur-, CO2-, Präsenz- und Energiezählern über BACnet IP, Modbus RTU und LoRaWAN an Gebäude-Edge-Controller."},
            {"label": "⚡ Smart Building Event Streaming", "prompt": "Entwirf die Streaming-Pipeline zur Aggregation tausender Sensorwerte aus verschiedenen Gebäudeflügeln mit MQTT und Kafka."},
            {"label": "❄️ Digital Twin & ESG Lakehouse", "prompt": "Konzipiere den semantischen Digitalen Zwilling (z. B. Brick Schema / RealEstateCore) kombiniert mit Lakehouse für automatisierte ESG-Bilanzen."},
            {"label": "🤖 MCP HVAC-Optimierungs-Agent", "prompt": "Integriere autonome KI-Agenten über MCP zur vorausschauenden HVAC- und Heizungsoptimierung basierend auf Wetterprognosen und Belegungsdaten."}
        ],
        3: [
            {"label": "⚖️ Gebäude-Edge vs. Portfolio-Cloud", "prompt": "Analysiere den Trade-Off: Autonome Regelung vor Ort im Gebäude bei Netzausfall vs. globales Portfolio-Energiemonitoring in der Cloud."},
            {"label": "🛡️ Resilienz bei Sensor-Ausfall", "prompt": "Spezifiziere Fallback-Strategien: Automatischer Wechsel auf Mittelwerte und konservative Standardkennlinien bei Ausfall einzelner Raum-Sensoren."},
            {"label": "🔒 IT/OT-Zonentrennung im Gebäude", "prompt": "Sichere das Gebäudenetz ab: Strikte Trennung von Gebäudeautomation (OT), Mieternetzwerken und Internetzugang nach BSI-Vorgaben."},
            {"label": "⚡ Physischer Überhitzungsschutz", "prompt": "Gewährleiste, dass Stellventile und Heizkessel immer über fest verdrahtete Thermostate abgesichert sind und KI-Befehle niemals Gefahren erzeugen."}
        ],
        4: [
            {"label": "📈 22% Heizkosten - & ESG-ROI", "prompt": "Kalkuliere den Business Case: 22% Einsparung bei thermischer Energie, Vermeidung von CO2-Strafabgaben, Amortisation der Sensorik in 8 Monaten."},
            {"label": "🗓️ 3-Phasen Campus-Rollout", "prompt": "Plane die Roadmap: Phase A (Leuchtturm-Gebäude PoC, 6 Wochen), Phase B (Gesamter Büro-Campus, 4 Monate), Phase C (Weltweites Liegenschafts-Portfolio, 9 Monate)."},
            {"label": "👔 Workstreams Automation & ESG", "prompt": "Strukturiere 3 Workstreams: Gebäudeautomation & Sensorik-Installation, Datenplattform & Digital Twin, Facility Operations & ESG-Zertifizierung."},
            {"label": "🔄 Haustechniker-Schulung", "prompt": "Entwickle das Schulungskonzept: Begleitung der Haustechniker vom manuellen Schrauben am Stellventil zum KI-assistierten Gebäudeleitstand."}
        ]
    },

    "cross_domain": {
        1: [
            {"label": "🎯 Ziel: Kern-Pain-Points & Hebel", "prompt": "Kläre die Kern-Problemstellung des Kunden: Welche spezifischen Schmerzpunkte, wirtschaftlichen Hebel und Qualitätsanforderungen stehen im Mittelpunkt?"},
            {"label": "📊 Datenlandschaft & Altsysteme", "prompt": "Prüfe die vorhandene Datenlage: Welche Systeme (Silos, DWH, ERP, Sensorik) existieren und wo liegen Medienbrüche vor?"},
            {"label": "⏱️ Latenzen, SLAs & Durchsatz", "prompt": "Kläre technische Randbedingungen: Maximale tolerierbare Latenzen, erforderlicher Durchsatz und Verfügbarkeits-SLAs."},
            {"label": "👥 Stakeholder, Budget & Scope", "prompt": "Erfasse Entscheidungsträger, Budgetrahmen (CAPEX/OPEX) sowie den genauen Projekt-Scope und Erfolgsmetriken."}
        ],
        2: [
            {"label": "⚙️ Datenaufnahme & Edge/OT Ingest", "prompt": "Entwirf die Ingestion-Schicht: Anbindung der Datenquellen über moderne Schnittstellen, Protokolladapter und lokale Vorverarbeitung."},
            {"label": "⚡ Event-Streaming Pipeline", "prompt": "Modelliere die hochverfügbare Event-Streaming-Pipeline für kontinuierliche Datenflüsse, Entkopplung und Schema-Validierung."},
            {"label": "❄️ Analytisches Lakehouse & DWH", "prompt": "Konzipiere die skalierbare Speicherschicht (Lakehouse / DWH) mit strukturierter Datenmodellierung und Historisierung."},
            {"label": "🤖 MCP System-Agenten-Orchestrierung", "prompt": "Integriere autonome KI-Agenten über das MCP (Model Context Protocol) zur domänenspezifischen Prozessautomatisierung und Vorfallsteuerung."}
        ],
        3: [
            {"label": "⚖️ Dezentral vs. Zentral Trade-off", "prompt": "Analysiere fundamentale Architektur-Trade-Offs: Vor-Ort-Verarbeitung (Latenz, Autonomie) vs. zentrale Cloud-Plattform (Skalierung, globale Sicht)."},
            {"label": "🛡️ Resilienz & 48h Ausfallpuffer", "prompt": "Spezifiziere das Notfall- und Failover-Konzept: Lokale Pufferung bei Netzwerkausfall, Datenkonsistenz und automatischer Re-Sync."},
            {"label": "🔒 End-to-End Sicherheit & Audit", "prompt": "Härte die Lösung: Zero-Trust Prinzipien, Zonentrennung, Verschlüsselung (in-transit/at-rest) und lückenloser Audit Trail."},
            {"label": "⚡ Deterministik vs. KI-Schranken", "prompt": "Definiere klare Schutzschranken: Kritische Entscheidungen laufen deterministisch oder erfordern explizite Human-in-the-Loop Freigaben."}
        ],
        4: [
            {"label": "📈 Business Case & ROI-Kalkulation", "prompt": "Kalkuliere den konkreten wirtschaftlichen Nutzen: Kostenreduktion, Effizienzsteigerung, Amortisationszeitraum (ROI) und messbare KPIs."},
            {"label": "🗓️ 3-Phasen-Roadmap (PoC->Scale)", "prompt": "Erstelle die Implementierungs-Roadmap: Phase 1 (PoC & Machbarkeit, 6 Wo.), Phase 2 (Pilot-Einführung, 3 Mon.), Phase 3 (Unternehmensweiter Rollout, 9 Mon.)."},
            {"label": "👔 Senior Workstream-Ownership", "prompt": "Strukturiere das Projektteam in drei klare Workstreams (Infrastruktur/Ingest, Datenplattform/KI, Fachbereich/Operations) mit Deliverables."},
            {"label": "🔄 Change Management & Enablement", "prompt": "Entwickle das Begleitkonzept: Schulungsmaßnahmen, Governance-Strukturen und Stakeholder-Kommunikation zur nachhaltigen Verankerung."}
        ]
    }
}


def resolve_domain_key(industry: Optional[str]) -> str:
    """Resolves arbitrary industry strings to one of the 7 supported domain keys."""
    if not industry:
        return "cross_domain"
    
    ind = industry.lower().strip()

    # Energy / Smart Grid
    if any(k in ind for k in ["energy", "energie", "grid", "netz", "strom", "utility", "utilities", "kraftwerk"]):
        return "energy_grid"

    # Logistics / Fleet / Supply Chain
    if any(k in ind for k in ["logist", "fleet", "flotte", "supply", "transport", "airport", "flughafen", "cargo", "fracht", "yard"]):
        return "logistics"

    # Cloud Enterprise / Modernization
    if any(k in ind for k in ["cloud", "enterprise", "moderniz", "transform", "software", "it-", "it ", "saas", "mainframe"]):
        return "cloud_enterprise"

    # MedTech / Healthcare / Life Sciences
    if any(k in ind for k in ["med", "health", "pharma", "klinik", "hospital", "patient", "life science", "biotech"]):
        return "medtech"

    # Smart Buildings / Infrastructure / City
    if any(k in ind for k in ["building", "gebäude", "infrastruct", "smart city", "facility", "immobilie", "hvac", "glt"]):
        return "smart_buildings"

    # Industrial OT / Smart Factory / Manufacturing
    if any(k in ind for k in ["industr", "factory", "fertigung", "ot", "produktion", "maschinen", "automotive", "automation", "werk"]):
        return "industrial_ot"

    return "cross_domain"


def get_preset_triggers(industry: Optional[str]) -> List[Dict[str, Any]]:
    """Returns a flat list of 16 trigger dicts for the given domain."""
    domain_key = resolve_domain_key(industry)
    preset = DOMAIN_PRESETS.get(domain_key, DOMAIN_PRESETS["cross_domain"])

    result = []
    for phase in (1, 2, 3, 4):
        items = preset.get(phase, [])
        for idx, item in enumerate(items):
            result.append({
                "phase": phase,
                "trigger_index": idx,
                "label": item["label"],
                "prompt": item["prompt"],
                "is_custom": 0
            })
    return result


async def get_or_init_project_triggers(project_id: str) -> List[Dict[str, Any]]:
    """
    Retrieves existing triggers for the project.
    If none exist, initializes them from the project's domain preset.
    """
    existing = await repositories.get_project_triggers(project_id)
    if existing and len(existing) >= 16:
        return existing

    project = await repositories.get_project(project_id)
    industry = project.get("industry") if project else "cross_domain"
    
    preset_triggers = get_preset_triggers(industry)
    saved = await repositories.save_project_triggers(project_id, preset_triggers)
    return saved


# ============================================================================
# LIVE CASE-ADAPTATION ENGINE (GEMINI FLASH)
# ============================================================================

SYSTEM_INSTRUCTION_ADAPTIVE_TRIGGERS = """
Du bist ein weltweit führender Chief Solution Architect & Senior Engagement Manager für technische C-Level-Fallstudien und Enterprise-Workshops.
Analysiere die gegebene Problemstellung / den Kunden-Case und generiere exakt 16 situative, hochspezifische Quick-Trigger für den Case Copilot:
- Genau 4 Trigger für Phase 1 (Clarify & Scoping)
- Genau 4 Trigger für Phase 2 (Architect & Blueprint)
- Genau 4 Trigger für Phase 3 (Deep Dive & Trade-offs)
- Genau 4 Trigger für Phase 4 (Value & Implementation Roadmap)

STRIKTE QUALITÄTSVORGABEN:
1. NULL HARDCODING: Keine allgemeinen Plattheiten! Die Trigger müssen exakt die spezifischen Fachbegriffe, Maschinentypen, Schnittstellen, Protokolle und Schmerzpunkte des übergebenen Kundenfalls aufgreifen.
2. UNIVERSAL MCP-PARADIGMA: In Phase 2 MUSS der 4. Trigger (phase: 2, trigger_index: 3) zwingend ein maßgeschneiderter MCP-Agenten-Trigger sein (z.B. '🤖 MCP Gepäckrouting- & Dispatch-Agent' oder '🤖 MCP Lastfluss-Steuerungs-Agent' oder '🤖 MCP Instandhaltungs-Agent').
3. STRUKTURIERTE LABELS: Jedes Label MUSS mit einem passenden Emoji beginnen und maximal 35 Zeichen lang sein (z.B. '🎯 Ziel: ...', '⚙️ ... Ingest', '⚡ ... Pipeline', '❄️ ... Lakehouse', '⚖️ ... Trade-Off', '🛡️ ... Resilienz', '📈 ... ROI', '🗓️ ... Roadmap').
4. ACTIONABLE PROMPTS: Jeder Prompt ist eine präzise formulierte deutsche Anweisung (1-2 Sätze) an den Master-Consultant zur Ausarbeitung der jeweiligen Fragestellung.

ANTWORTFORMAT:
Gib AUSSCHLIESSLICH ein valides JSON-Array zurück, das exakt 16 Objekte enthält (ohne Begleittext, ohne Markdown-Umschweife außer optional ```json ... ```):
[
  {
    "phase": 1,
    "trigger_index": 0,
    "label": "🎯 Ziel: ...",
    "prompt": "Kläre das Hauptziel des Kunden: ..."
  },
  ...
]
""".strip()


def _clean_json_response(raw_text: str) -> str:
    """Extracts raw JSON content from markdown code fences or surrounding text."""
    text = raw_text.strip()
    if text.startswith("```"):
        # Match ```json ... ``` or ``` ... ```
        match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text, re.IGNORECASE)
        if match:
            return match.group(1).strip()
    return text


async def generate_adaptive_triggers(project_id: str, case_text: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Analyzes project profile and user input/case notes, generates 16 tailored triggers
    via Gemini Flash, saves them to SQLite WAL, and returns them.
    """
    project = await repositories.get_project(project_id)
    if not project:
        raise ValueError(f"Project with id {project_id} not found.")

    proj_name = project.get("name", "Neues Projekt")
    proj_industry = project.get("industry", "cross_domain")
    proj_persona = project.get("persona_profile", "Lead Evaluator & Technical Director")

    # Gather additional document context if available
    doc_context = ""
    try:
        docs = await repositories.list_documents(project_id)
        if docs:
            snippets = []
            for d in docs[:3]:
                txt = (d.get("extracted_text") or "")[:1500]
                if txt:
                    snippets.append(f"Dokument '{d.get('filename')}':\n{txt}")
            if snippets:
                doc_context = "\n\nZusätzlicher Kontext aus hochgeladenen Dokumenten:\n" + "\n---\n".join(snippets)
    except Exception as exc:
        logger.warning(f"Error reading documents context for project {project_id}: {exc}")

    input_text = (case_text or "").strip()
    if not input_text and not doc_context:
        # Fall back to project name and industry
        input_text = f"Projekt: {proj_name}. Branche: {proj_industry}. Persona: {proj_persona}."

    user_query = f"""
Fallstudien-Profil:
- Name des Projekts: {proj_name}
- Branche / Domäne: {proj_industry}
- Zielperson / Evaluator: {proj_persona}

Konkrete Problemstellung / Eingabe des Kunden:
{input_text}
{doc_context}

Erstelle nun die 16 hochspezifischen Quick-Trigger (4 pro Phase) als valides JSON-Array.
""".strip()

    contents = [{"role": "user", "parts": [{"text": user_query}]}]

    generated_triggers: List[Dict[str, Any]] = []

    try:
        logger.info(f"Generating adaptive triggers for project '{proj_name}' ({project_id}) via Gemini Flash...")
        response_text = await key_pool.generate(
            contents=contents,
            system_instruction=SYSTEM_INSTRUCTION_ADAPTIVE_TRIGGERS,
            model=settings.fallback_model, # gemini-2.5-flash
            temperature=0.3,
            max_output_tokens=3000
        )

        cleaned_json = _clean_json_response(response_text)
        parsed = json.loads(cleaned_json)

        if isinstance(parsed, list) and len(parsed) >= 12:
            # Validate and normalize parsed triggers
            validated = []
            for item in parsed:
                phase = int(item.get("phase", 1))
                idx = int(item.get("trigger_index", 0))
                lbl = str(item.get("label", "")).strip()
                prompt = str(item.get("prompt", "")).strip()

                if 1 <= phase <= 4 and 0 <= idx <= 3 and lbl and prompt:
                    validated.append({
                        "phase": phase,
                        "trigger_index": idx,
                        "label": lbl,
                        "prompt": prompt,
                        "is_custom": 1
                    })

            # Check that we have coverage for all 4 phases
            if len(validated) >= 16:
                generated_triggers = validated[:16]
            elif len(validated) >= 12:
                generated_triggers = validated
                logger.info(f"Generated {len(validated)} validated triggers.")
    except Exception as exc:
        logger.error(f"Failed to generate adaptive triggers via Gemini Flash: {exc}. Using domain preset adaptation.", exc_info=True)

    # Fallback to customized domain preset if generation didn't succeed
    if not generated_triggers or len(generated_triggers) < 16:
        logger.info(f"Applying intelligent domain preset fallback for project {project_id}...")
        preset = get_preset_triggers(proj_industry)
        
        # Enrich preset labels/prompts slightly with project name if relevant
        adapted = []
        for t in preset:
            lbl = t["label"]
            prm = t["prompt"]
            if input_text and len(input_text) > 15:
                # Add contextual flag
                adapted.append({
                    "phase": t["phase"],
                    "trigger_index": t["trigger_index"],
                    "label": lbl,
                    "prompt": prm,
                    "is_custom": 1
                })
            else:
                adapted.append(t)
        generated_triggers = adapted

    # Save to SQLite WAL
    saved = await repositories.save_project_triggers(project_id, generated_triggers)
    logger.info(f"Successfully saved {len(saved)} adaptive triggers for project {project_id}.")
    return saved
