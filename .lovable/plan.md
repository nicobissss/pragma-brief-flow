

# Pulizia `/admin/data` e `/admin/settings`

Procedo con il piano già discusso (Opzione B — sistemi separati, rimuovo le sezioni morte/confondenti).

## 1. `/admin/data` → Email Monitoring + Diagnostica

**File:** `src/pages/admin/AdminDataDashboard.tsx` (riscritto)

Tab da rimuovere: **Prompts**, **Events**, **Briefing**, **Kickoff**.

Tab unico principale: **Email log** — riscritto da zero usando `email_send_log` con deduplica per `message_id`:
- Stat cards in alto: Total, Enviadas, Fallidas, Suprimidas (deduplicate)
- Filtri: range temporale (24h / 7g / 30g), template (dropdown da `template_name` distinct), status (Todos / Sent / Failed / Suppressed)
- Tabella: Template · Destinatario · Estado (badge colorato) · Fecha · Error (se fallita)
- Una sola riga per `message_id` (DISTINCT ON con latest `created_at`)
- Paginazione a 50 righe

Bonus diagnostica (sezione collassabile in fondo):
- Pulsante **"Generar review mensual"** con gestione errori reale: se la edge function fallisce, mostro l'errore in toast invece di restare in silenzio. Il risultato viene mostrato in un dialog markdown.
- Pulsante **"Ver últimos prompts generados"** dietro un toggle "Modo debug" (resta accessibile per troubleshooting ma non in primo piano).

Tutto in **spagnolo**.

## 2. `/admin/settings` → Knowledge Base ridotta

**File:** `src/pages/admin/AdminSettings.tsx`

Rimosse dalla `CATEGORIES`:
- ❌ `pricing` (i prezzi reali sono in Offerings Catalog)
- ❌ `suite_tools` (i tool reali sono in Flows & Reglas → Tools disponibles)

Rimossa la sezione **Documentos** (upload PDF/TXT/MD): nessuna edge function attiva la legge.

Restano in KB:
- ✅ `flows_processes` — Flows & Procesos (linee guida narrative)
- ✅ `pitch_guidelines` — Pitch Guidelines (tono kickoff + proposte)

Le tabelle DB (`documents`, `knowledge_base` con quei record) restano intoccate: solo nascoste dall'UI per sicurezza dati.

## 3. `/admin/settings` → Integraciones pulita

**File:** `src/components/admin/IntegrationsTab.tsx`

Rimossa la sezione **Email Templates** (tabella `email_templates` legacy non più letta da nessuna funzione — le email vere stanno in `_shared/transactional-email-templates/*.tsx`).

Restano:
- ✅ Make webhook config
- ✅ Webhook log
- ✅ Slotty integration

## Dettagli tecnici riassunti

| Area | File | DB |
|---|---|---|
| Dashboard data | `src/pages/admin/AdminDataDashboard.tsx` (riscritto) | nessuna |
| KB pulita | `src/pages/admin/AdminSettings.tsx` | nessuna |
| Integrazioni pulite | `src/components/admin/IntegrationsTab.tsx` | nessuna |

Nessuna migration. Nessuna tabella eliminata. Nessuna edge function modificata (la `generate-monthly-review` esiste già — sistemo solo la chiamata client-side).

## Cosa NON faccio

- Non collego Offerings Catalog alla KB (resta indipendente, come concordato).
- Non tocco Flows & Reglas (Tools + Reglas globales restano).
- Non elimino tabelle DB morte (solo le nascondo dall'UI).

