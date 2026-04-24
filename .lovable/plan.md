
# Settings — chiarezza e rinaming

Modifiche solo a 4 file. Nessuna migration, nessun cambiamento di logica IA. Tutto in spagnolo (segue la convenzione UI).

## 1. `src/pages/admin/AdminSettings.tsx`

Rinomino i tab e aggiorno il sottotitolo della pagina:

- "Knowledge Base" → **"Guías para la IA"**
- "Flows & Reglas" → **"Tools & Reglas"**
- "Offerings Catalog" → **"Catálogo de ofertas"**
- "Integraciones" → invariato

Sotto-titolo aggiornato:
> Configura las guías que la IA usa para generar contenidos, los tools disponibles, el catálogo de ofertas y las integraciones externas.

Aggiungo un microtesto sotto ogni tab per spiegare a cosa serve (1 riga, `text-xs text-muted-foreground`).

## 2. `src/components/admin/FlowsRulesTab.tsx`

- **Rimuovo** il banner grigio "Los flows ya no se gestionan aquí…" (ridondante, ormai è chiaro).
- Aggiungo un blocco introduttivo in cima che spiega in 2 righe:
  - **Tools disponibles** = lista de automatizaciones que la IA puede proponer en contenidos y prompts. Si desactivas uno, la IA dejará de mencionarlo.
  - **Reglas globales** = restricciones que la IA debe respetar en cada generación (ej. tono, claims prohibidos).
- Sezione "Tools disponibles" con sottotitolo: *"La IA elige entre estos tools cuando recomienda automatizaciones al cliente."*
- Sezione "Reglas globales" con sottotitolo: *"Reglas siempre activas que filtran las generaciones por vertical."*
- Bottone "Probar configuración actual" → tooltip o subtitle: *"Simula los prompts que la IA generaría con la configuración actual, sin crear un cliente."*

## 3. `src/components/admin/OfferingsCatalogTab.tsx`

Aggiungo in cima un blocco esplicativo (`bg-secondary/30 rounded-xl p-4`):

> **Catálogo de ofertas** — Estos son los paquetes comerciales que PRAGMA vende. La IA usa este catálogo para **recomendar ofertas** a cada cliente y para **generar el plan de tareas**. Es independiente de las "Guías para la IA" (que solo son contexto narrativo).

Etichette tier già chiare, non tocco le card.

## 4. `src/components/admin/IntegrationsTab.tsx`

Aggiungo blocco intro:

> **Integraciones externas** — Conexiones con servicios fuera de PRAGMA. Si no usas Make ni Slotty, puedes ignorar esta sección — el Webhook Log seguirá registrando los eventos del sistema Forge para debug.

Per ogni sottosezione aggiungo 1 riga descrittiva:

- **Make.com Webhook** — *"Envía eventos de PRAGMA (cliente creado, asset aprobado…) a un escenario de Make para automatizaciones externas."*
- **Webhook Log** — *"Últimos 20 webhooks enviados o recibidos. Útil para debug."*
- **Slotty Integration** — *"Estado de creación de workspaces Slotty (sistema de booking) para cada cliente."*

Riordino: metto **Webhook Log** in fondo (è l'ultimo perché è un log, non una configurazione). Ordine finale: Make → Slotty → Webhook Log.

## Cosa NON faccio

- Non rimuovo niente dalla DB (`pragma_rules`, `knowledge_base` restano com'è).
- Non tocco le edge functions (la logica di iniezione nei prompt è già corretta).
- Non collego KB e Offerings Catalog (restano sistemi separati, come deciso).
- Non rimuovo Integraciones anche se non la usi attivamente — il Webhook Log serve per debug del sistema Forge.

