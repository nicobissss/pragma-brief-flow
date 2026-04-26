## Obiettivo

Strumenti per popolare velocemente prospect/cliente con dati realistici e testare il flusso end-to-end (incluse le email vere).

**Regola naming:**
- Bottoni che **iniettano dati finti** → label inizia con **"🧪 TEST –"**
- Bottoni che **eseguono azioni reali del flusso** (creano cliente vero, mandano email vere) → label normale, sono solo shortcut

---

## Cosa aggiungiamo

### 1. Dentro `CreateProspectDialog`
- **🧪 TEST – Riempi dati fake** → genera nome/azienda/email/vertical/sub_niche/ticket/descrizione/call date casuali (set di ~6 personaggi per ognuno dei 3 verticali approvati). L'email la puoi modificare a mano (consigliato usare `tuonome+test1@gmail.com`).

### 2. Dettaglio prospect (`/admin/prospects/:id`) — pannello "Test tools"

| Bottone | Cosa fa | Tipo |
|---|---|---|
| 🧪 TEST – Genera trascrizione fake | Inserisce ~800 parole di trascrizione realistica (discovery, pain, budget, obiettivi) coerente col vertical | Inietta dati |
| 🧪 TEST – Compila kickoff brief | Riempie `structured_info`, `voice_reference`, `client_rules`, `preferred_tone` con valori plausibili | Inietta dati |
| Genera proposta | Triggera la generazione proposta (azione reale) | Shortcut |
| Marca proposta come accepted | Update `proposals.shared_with_client=true` + status prospect | Shortcut |
| Accetta come cliente | Invoca `accept-prospect` (crea cliente + welcome email vera) | Shortcut |

### 3. Dettaglio cliente (`/admin/clients/:id`) — pannello "Test tools"

| Bottone | Cosa fa | Tipo |
|---|---|---|
| 🧪 TEST – Popola asset requests fake | Crea entry in `client_asset_requests` già "completed" con URL placeholder | Inietta dati |
| 🧪 TEST – Genera asset di review fake | Crea 2-3 record `assets` in `pending_review` con contenuto dummy | Inietta dati |
| 🧪 TEST – Compila campaign brief fake | Riempie obiettivo/audience/key message di una campagna | Inietta dati |
| Approva tutti gli asset pending | Bulk update status='approved' (azione reale) | Shortcut |
| Reset cliente test | Cancella asset/campagne/feedback (solo se `is_test=true`) | Cleanup |

### 4. Marcatura e cleanup

- Colonna `is_test boolean default false` in `prospects` e `clients`
- Tutti i record creati via "🧪 TEST – Riempi dati fake" sono `is_test=true`
- Badge **🧪 TEST** accanto al nome nelle liste
- Filtro "Solo TEST" nei filtri esistenti
- In `/admin/data`: card **"🧪 TEST – Cancella tutti i dati di test"** (cancella in cascata tutto ciò che è `is_test=true` + dipendenze)

---

## Gating visibilità

I pannelli "Test tools" sono visibili solo:
- Agli admin (già garantito da RLS)
- Su preview/staging: `import.meta.env.DEV || hostname.includes("lovable.app")`
- **Mai** sul dominio custom di produzione (`pragmarketers.com`)

---

## Dettagli tecnici

### Migrazione DB
```sql
ALTER TABLE prospects ADD COLUMN is_test boolean NOT NULL DEFAULT false;
ALTER TABLE clients   ADD COLUMN is_test boolean NOT NULL DEFAULT false;
CREATE INDEX idx_prospects_is_test ON prospects(is_test) WHERE is_test;
CREATE INDEX idx_clients_is_test   ON clients(is_test)   WHERE is_test;
```

### Nuovi file
- `src/lib/test-fixtures.ts` — fixtures personaggi/aziende/trascrizioni/briefs per i 3 verticali + helpers `generateFakeProspect()`, `generateFakeTranscript(vertical)`, `generateFakeBrief(vertical)`
- `src/components/admin/TestToolsPanel.tsx` — pannello collapsible riusabile (`mode: "prospect" | "client"`, `entityId`)
- `src/components/admin/TestModeBadge.tsx` — badge "🧪 TEST"
- `src/lib/test-mode.ts` — helper `isTestModeAvailable()` per il gating

### File modificati
- `CreateProspectDialog.tsx` — bottone "🧪 TEST – Riempi dati fake" in alto
- `AdminProspects.tsx` — badge + filtro test
- `AdminProspectDetail.tsx` — monta `TestToolsPanel` in cima
- `AdminClients.tsx` — badge + filtro test
- `AdminClientDetail.tsx` — monta `TestToolsPanel` in cima
- `AdminDataDashboard.tsx` — card cleanup massivo

### Cosa NON faccio
- Non bypass RLS o validazioni
- Non tocco gli AI agents (restano OFF)
- Non aggiungo "TEST" ai bottoni di azione reale (Approva proposta, Accetta cliente, ecc.) — sono solo shortcut, il dato che producono è vero

Pronto a implementare?