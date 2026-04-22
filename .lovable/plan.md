
Modifico `trigger-forge-generation` (questo progetto) per:
1. Leggere TUTTO il contesto del client (clients, kickoff_briefs, campaigns, client_offerings, client_rules, voice_reference, ecc.) prima di chiamare Forge
2. Includere il bundle completo nel payload inviato a Forge
3. Forge userà solo quel payload — non dovrà più chiamare il Briefer

Così risolvi `Invalid API key` cancellando il problema alla radice: Forge non ha più bisogno della service_role.
