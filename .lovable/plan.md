# Pacchetto Switch Contestuali Agenti IA + Fase 2

Stato: **Fase 1 completa**, **Fase 2 completa** (Briefer Enrichment campagna, Feedback Loop, Asset Variations).

## Fase 1 — Switch Contestuali (fatta)
- Override per-cliente in `clients.ai_agent_overrides`, RPC `is_ai_agent_enabled_for_client`.
- UI override + badge nei punti d'uso.

## Fase 2 — Cablaggio agenti (fatta)
- **Briefer Enrichment** (`enrich-campaign-brief` + `BriefEnrichmentPanel`): l'admin clicca "Analizar brief" nel form di edit della campagna, riceve completeness score + suggerimenti per campo (objective/audience/key_message/timeline) con bottone "Aplicar" che riempie il form. Niente mutazione automatica.
- **Feedback Loop** (`feedback-loop-extract` + trigger DB `trg_invoke_feedback_loop_on_asset_status`): quando un asset passa a `approved` o `change_requested`, in background l'IA estrae pattern (verdict, hook, tone, frasi vincenti/perdenti, formula replicabile) e li inserisce in `client_winning_patterns`. Rispetta master switch + override per-cliente.
- **Asset Variations** (`generate-asset-variations` + bottone in `AssetCard` dropdown): visibile solo su asset `approved`. Genera 3 nuovi asset draft (variante hook / variante CTA / variante tono) preservando lo schema JSON originale, creati come `pending_review` con `context_used.variation_of` per tracciabilità.

## Fuori scope (non implementato)
- Cron settimanale per Feedback Loop semanal aggregato (oggi è event-triggered per asset).
- Suggerimenti di varianti durante la review (oggi solo post-approval).
- UI dedicata per ispezionare i `client_winning_patterns` accumulati dal Feedback Loop (visibili solo nella discovery panel esistente).
