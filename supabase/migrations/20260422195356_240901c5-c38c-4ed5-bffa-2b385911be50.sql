-- Sprint 4: Cleanup legacy flows + Spanish knowledge base

-- 1. Delete all legacy pragma_flows (15 rows obsolete)
DELETE FROM public.pragma_flows;

-- 2. Rewrite knowledge_base in Spanish, aligned with Tier 1/2/3 catalog
DELETE FROM public.knowledge_base WHERE category IN ('flows_processes', 'pricing', 'suite_tools', 'pitch_guidelines');

INSERT INTO public.knowledge_base (category, content) VALUES
('flows_processes', '## Catálogo PRAGMA — Tier 1/2/3

### TIER 1 — Quick Wins (entry, baja inversión)

**TIER1_RECUPERACION — Recuperación Pacientes Dormidos**
Campaña de 14 días para reactivar contactos inactivos +6 meses.
Secuencia: 3 emails + landing dedicada + SMS opcional.
Mejor para: clientes con base de datos no explotada.

**TIER1_NOSHOW — No-Show Killer**
Secuencia automática pre/post cita para reducir ausencias.
Secuencia: 2 emails + 2 SMS + landing de confirmación.
Mejor para: clientes con tasa de no-show > 10%.

**TIER1_RESENAS — Reseñas Google Booster**
Sistema post-visita: redirige clientes satisfechos a Google Reviews,
captura feedback negativo internamente.
Mejor para: clientes con < 50 reseñas o rating < 4.5.

### TIER 2 — Retainer (crecimiento continuo)

**TIER2_PACK_CRECIMIENTO — Pack Crecimiento**
Retainer mensual: ejecuta los 3 flows Tier 1 en paralelo + revisiones mensuales.
Mejor para: clientes con base > 500 contactos listos para inversión recurrente.

### TIER 3 — One-shot (campañas estacionales)

**TIER3_CAMPANA_ESTACIONAL — Campaña Estacional Completa**
Campaña puntual para evento/promoción (Black Friday, vuelta al cole, etc.).
Incluye: 3 emails + 1 landing + 2 posts sociales + 1 SMS.
Mejor para: clientes con eventos estacionales o promociones puntuales.

### Reglas de recomendación

- Cliente nuevo sin histórico → 1 oferta Tier 1 según el dolor principal
- Cliente con base > 500 y dolores múltiples → Tier 2 (Pack Crecimiento)
- Cliente con evento próximo → añadir Tier 3 (Campaña Estacional)
- NO proponer Tier 2 sin base de datos ni tracking de conversiones'),

('pricing', '## Pricing PRAGMA (USO INTERNO — NUNCA COMPARTIR EN BRUTO CON CLIENTE)

Estos rangos son referencia interna para preparar la propuesta.
El precio final al cliente se presenta como cifra cerrada o paquete, NUNCA como desglose de horas o márgenes.

### Tarifas referencia

- **TIER1_RECUPERACION**: 350-500€ one-shot
- **TIER1_NOSHOW**: 400-600€ setup + opcional retainer mantenimiento
- **TIER1_RESENAS**: 300-450€ setup
- **TIER2_PACK_CRECIMIENTO**: 650€/mes (incluye los 3 Tier 1 + optimización)
- **TIER3_CAMPANA_ESTACIONAL**: 800-1.200€ por campaña

### Mercados

- **ES / IT**: precios en EUR
- **AR**: convertir a USD aplicando tipo de cambio del mes (aprox 1€ = 1.05 USD para presupuesto)

### Reglas

- Setup fee se factura al inicio del proyecto.
- Retainer (Tier 2) se factura mensualmente, contrato mínimo 3 meses.
- Tier 3 se factura 50% al kickoff, 50% al lanzamiento.
- NUNCA mencionar comisiones por conversión, márgenes, ni horas estimadas al cliente.
- NUNCA enviar al cliente las cifras setup_hours_estimate ni monthly_hours_estimate.'),

('suite_tools', '## Suite Tools PRAGMA

Son las únicas herramientas que PRAGMA usa internamente. NO recomendar otras.

- **Pragma Calendar** — Sistema de citas y recordatorios automatizados.
- **Landing Pragma** — Generador de landing pages optimizadas para conversión.
- **Pragma Visual Email** — Constructor de emails con plantillas verticales.
- **Social Engine Pragma** — Programación y generación de contenido social.
- **Pragma SEO & GEO** — Optimización SEO local y posicionamiento geográfico.
- **Pragma Learn** — Plataforma e-learning para verticales formativos.
- **Voice Bot** — Asistente de voz para atención telefónica.

Cada oferta del catálogo activa un subset específico de estas tools.'),

('pitch_guidelines', '## Pitch Guidelines — cómo presentar al cliente

### Principio clave
El cliente compra **resultado** (más citas, menos no-show, más reseñas), no **deliverables** (3 emails, 1 landing). Todo el lenguaje debe ser orientado al outcome.

### Estructura del pitch (15 minutos)

1. **Apertura (1 min)** — referencia algo concreto del briefing del prospect (ej: "me dijiste que el 20% de tus pacientes no aparecen…")
2. **Diagnóstico (3 min)** — confirma el dolor con preguntas
3. **Solución (5 min)** — presenta la oferta Tier recomendada como respuesta directa al dolor
4. **Resultado esperado (3 min)** — métricas concretas ("recuperarás entre 15 y 30 citas/mes")
5. **Precio (2 min)** — cifra cerrada, sin desglose
6. **Próximo paso (1 min)** — propón fecha de kickoff

### Lo que NO se dice nunca al cliente

- Horas estimadas (setup_hours_estimate, monthly_hours_estimate)
- Margen interno o coste por hora
- Nombres internos de las offerings (TIER1_RECUPERACION) — usa siempre el nombre comercial
- Detalles técnicos de las tools backend (webhooks, edge functions, etc.)

### Lenguaje por vertical

- **Salud & Estética**: tono cercano, foco en pacientes y reputación
- **E-Learning**: tono profesional, foco en alumnos y completion rate
- **Deporte Offline**: tono enérgico, foco en alumnos activos y retención');
