# Pivot v4: Flow visuale = espressione visiva di un'offerta del catalogo

## Insight chiave (tuo)
Il "flow" che mostriamo al cliente NON è arbitrario: è la rappresentazione visuale di **una offerta concreta del catalogo** (`offering_templates`). Esempi: "Recuperación", "No-Show", "Reseñas", "Webinar Booster", "Pack Crecimiento", "Campaña Estacional"…

Quindi una campagna è **legata a una `client_offering`** (cioè a un'offerta proposta/accettata per quel cliente), e il flow è la sequenza di touchpoint che concretizza i `deliverables` di quell'offerta.

## Modello dati (correzione vs v3)

- `offering_templates` (esistente, NON tocchiamo lo schema): aggiungiamo solo nel `deliverables` jsonb un eventuale campo `flow_template` opzionale per i flow più strutturati. Ma il fallback è semplice: i `deliverables` esistenti (es. "5 email + 1 LP") generano automaticamente i nodi del flow.
- `campaigns`: aggiungiamo `client_offering_id uuid` (FK logica a `client_offerings.id`). Una campagna nasce sempre da un'offerta proposta/accettata al cliente.
- `campaign_master_assets` (N per campagna): come v3 (multi-master, `is_primary`, brand_kit + visual_layout).
- `campaign_flows`: come v3, ma quando si crea il flow di una campagna, i nodi iniziali sono **generati dai deliverables dell'offerta** (es. offering "Webinar Booster" con 5 deliverables → 5 nodi precompilati: invito IG, email reminder, LP webinar, email follow-up, retargeting).
- `campaign_touchpoints` e `sub_tool_registry`: come v3.

## Cosa cambia nella UX

1. **Crea campagna** (in CampaignManager): primo step = scegli quale `client_offering` la campagna serve (dropdown delle offerte proposed/accepted per quel cliente). Senza questo step, niente campagna.
2. **Master Assets**: come v3, multi-master, generazione AI da contesto cliente, editor in-app.
3. **Flow**: si apre già **precompilato dai deliverables dell'offerta scelta**. L'admin (o l'AI con `generate-campaign-flow`) può aggiungere/togliere/riordinare nodi, ma la base è il template dell'offerta. Niente flow "da zero" nel 90% dei casi.
4. **Catalogo offerings come "libreria flow"**: è lui la fonte di verità. Se vuoi un nuovo "tipo di flow disponibile", lo crei come nuovo offering in `/admin/settings → Catálogo` (UI già esistente). Niente nuova tabella `flow_templates` separata.

## Cosa NON facciamo
- Niente nuova tabella `flow_templates`. Sarebbe duplicazione: il catalogo offerte fa già quel ruolo.
- Niente "flow custom da zero senza offerta". Se l'admin lo vuole davvero, crea prima una micro-offerta nel catalogo (anche senza prezzo) e la collega.

## Aggiornamento offerings esistenti
Per i 9 offerings attuali, aggiungo un campo opzionale `deliverables[].flow_node_hint` con: `channel` (es. `email`, `landing_page`, `paid_ig`, `social_post`), `week`, `depends_on` (per le frecce). Migration di backfill che lo deduce dai `deliverables` attuali (es. deliverable type `email` → channel `email`). Editabile in `OfferingsCatalogTab.tsx`.

## Edge functions (delta vs v3)

- `generate-campaign-flow` cambia input/logica: input `campaign_id`. Legge `client_offering` collegata, espande i `deliverables` in nodi base usando `flow_node_hint`, poi l'AI **arricchisce** (aggiunge dipendenze realistiche, sequenza temporale, eventuali nodi mancanti standard come "retargeting" o "thank-you page"). NON parte da zero, parte dal template dell'offerta.
- `generate-master-asset`, `dispatch-touchpoint`, `enrich-master-asset-brief`, `webhook-receiver`: identici a v3.

## Aggiornamento agenti (riassunto)
- **Da rifocalizzare**: `enrich-campaign-brief` → `enrich-master-asset-brief`. `proposal-critique` invariato.
- **Da spostare il trigger**: `feedback-loop-extract` (su touchpoint completed). `qa-asset-review` (auto solo se sub-tool restituisce un asset, manuale altrove).
- **Riconvertito**: `generate-asset-variations` → varianti del Master Asset.
- **Deprecati (resta in repo)**: `trigger-forge-generation`, `generate-asset-internal`, `select-campaign-materials`. Bundle contesto estratto in `_shared/build-client-context.ts`.
- **Nuovi**: `generate-master-asset`, `generate-campaign-flow`, `dispatch-touchpoint`, `enrich-master-asset-brief`.
- **Pannello AI Agents**: rinomina chiave brief enrichment, aggiungi `master_asset_generator`, `campaign_flow_generator`, `master_asset_variations`. Tutti off di default.

## Regola "no AI silenziosa sui dati vivi"
- Generazione draft (master, flow, varianti, suggerimenti brief) = OK automatico.
- Approvazione master, pubblicazione flow, dispatch touchpoint = sempre click umano.
- Scritture su report/memoria interna (qa_reports, critique_reports, winning_patterns) = OK automatico (sono memoria AI, non dati cliente).

## Frontend (delta vs v3)
- `CampaignManager`: nuovo step iniziale "Scegli offerta" che popola `client_offering_id`.
- `OfferingsCatalogTab`: nuova sezione per editare il `flow_node_hint` su ogni deliverable.
- Resto come v3 (MasterAssetsTab, MasterAssetEditor, CampaignFlowEditor, CampaignFlowShareView, TouchpointsTab, SubToolRegistry).

## Fasi
1. **Schema + binding offerta + contesto condiviso** — migrazioni (`campaigns.client_offering_id`, 4 nuove tabelle pivot, agent registry update), backfill `flow_node_hint` sui 9 offerings esistenti, estrazione `_shared/build-client-context.ts`, `dispatch-touchpoint` stub.
2. **Master Assets** — `generate-master-asset` + `enrich-master-asset-brief` + UI multi-master + variations riscritte.
3. **Flow** — `generate-campaign-flow` (espande i deliverables dell'offerta + arricchisce con AI) + editor Journey/Timeline + share pubblica.
4. **Touchpoints + cleanup** — `dispatch-touchpoint` reale, `SubToolRegistry`, sposta trigger `feedback-loop-extract` su touchpoint, disattiva auto QA su asset di campagna, rimuove i 4 AssetCard fissi dalla campagna.

Confermi e parto dalla Fase 1.
