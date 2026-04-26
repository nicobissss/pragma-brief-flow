// deno-lint-ignore-file no-explicit-any
/**
 * Costruisce il bundle completo di contesto cliente, riusato da:
 *  - dispatch-touchpoint  (payload ai sub-tool esterni)
 *  - generate-master-asset
 *  - generate-campaign-flow
 *  - (legacy) trigger-forge-generation
 *
 * Una sola fonte di verità: se cambia il contesto, cambia qui.
 */

export type ClientContextBundle = {
  client: any;
  kickoff_brief: any | null;
  voice_reference: string | null;
  preferred_tone: string | null;
  client_rules: any[];
  client_materials: Record<string, any>;
  transcript_text: string | null;
  campaigns: any[];
  target_campaign: any | null;
  target_offering: any | null;
  client_offerings: any[];
  client_platforms: any[];
  winning_patterns: any[];
  pragma_rules: any[];
  knowledge_base: any[];
};

export async function buildClientContext(
  supabase: any,
  opts: { client_id: string; campaign_id?: string | null; client_offering_id?: string | null },
): Promise<ClientContextBundle> {
  const { client_id, campaign_id, client_offering_id } = opts;

  const [
    clientRes,
    kickoffRes,
    campaignsRes,
    offeringsRes,
    platformsRes,
    patternsRes,
    pragmaRulesRes,
    knowledgeRes,
    targetCampaignRes,
    targetOfferingRes,
  ] = await Promise.all([
    supabase.from("clients").select("*").eq("id", client_id).maybeSingle(),
    supabase.from("kickoff_briefs").select("*").eq("client_id", client_id).maybeSingle(),
    supabase.from("campaigns").select("*").eq("client_id", client_id),
    supabase
      .from("client_offerings")
      .select("*, offering_template:offering_templates(*)")
      .eq("client_id", client_id),
    supabase
      .from("client_platforms")
      .select("*, platform:supported_platforms(*)")
      .eq("client_id", client_id),
    supabase.from("client_winning_patterns").select("*").eq("client_id", client_id),
    supabase.from("pragma_rules").select("*").eq("is_active", true),
    supabase.from("knowledge_base").select("*"),
    campaign_id
      ? supabase.from("campaigns").select("*").eq("id", campaign_id).maybeSingle()
      : Promise.resolve({ data: null }),
    client_offering_id
      ? supabase
          .from("client_offerings")
          .select("*, offering_template:offering_templates(*)")
          .eq("id", client_offering_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const client = clientRes.data;
  if (!client) throw new Error(`client_id ${client_id} not found`);

  const kickoff = kickoffRes.data;
  const targetCampaign = targetCampaignRes.data;

  // Se la campagna ha un client_offering_id e non ne è stato passato uno esplicito,
  // proviamo a risolverlo dal record campagna per avere l'offerta in contesto.
  let targetOffering = targetOfferingRes.data;
  if (!targetOffering && targetCampaign?.client_offering_id) {
    const { data } = await supabase
      .from("client_offerings")
      .select("*, offering_template:offering_templates(*)")
      .eq("id", targetCampaign.client_offering_id)
      .maybeSingle();
    targetOffering = data;
  }

  const pragmaRules = (pragmaRulesRes.data || []).filter(
    (r: any) => !r.applies_to_vertical || r.applies_to_vertical === client.vertical,
  );

  return {
    client,
    kickoff_brief: kickoff || null,
    voice_reference: kickoff?.voice_reference || null,
    preferred_tone: kickoff?.preferred_tone || null,
    client_rules: kickoff?.client_rules || [],
    client_materials: kickoff?.client_materials || {},
    transcript_text: kickoff?.transcript_text || null,
    campaigns: campaignsRes.data || [],
    target_campaign: targetCampaign,
    target_offering: targetOffering,
    client_offerings: offeringsRes.data || [],
    client_platforms: platformsRes.data || [],
    winning_patterns: patternsRes.data || [],
    pragma_rules: pragmaRules,
    knowledge_base: knowledgeRes.data || [],
  };
}
