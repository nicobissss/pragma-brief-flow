const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { file_url } = await req.json();
    if (!file_url) throw new Error("file_url is required");

    console.log("Fetching PDF from:", file_url);

    // Fetch the PDF file
    const pdfResponse = await fetch(file_url);
    if (!pdfResponse.ok) throw new Error(`Failed to fetch PDF: ${pdfResponse.status}`);

    const pdfBuffer = await pdfResponse.arrayBuffer();
    const bytes = new Uint8Array(pdfBuffer);

    // Basic PDF text extraction - extract text between stream markers
    // This handles most text-based PDFs
    let text = "";
    const decoder = new TextDecoder("utf-8", { fatal: false });
    const rawText = decoder.decode(bytes);

    // Extract text from PDF text objects (BT...ET blocks with Tj/TJ operators)
    const textMatches = rawText.matchAll(/\(([^)]*)\)\s*Tj/g);
    const texts: string[] = [];
    for (const match of textMatches) {
      const t = match[1]
        .replace(/\\n/g, "\n")
        .replace(/\\r/g, "")
        .replace(/\\t/g, " ")
        .replace(/\\\(/g, "(")
        .replace(/\\\)/g, ")")
        .replace(/\\\\/g, "\\");
      if (t.trim()) texts.push(t);
    }

    // Also try TJ arrays
    const tjMatches = rawText.matchAll(/\[((?:\([^)]*\)|[^[\]])*)\]\s*TJ/g);
    for (const match of tjMatches) {
      const inner = match[1];
      const innerTexts = inner.matchAll(/\(([^)]*)\)/g);
      for (const it of innerTexts) {
        const t = it[1]
          .replace(/\\n/g, "\n")
          .replace(/\\r/g, "")
          .replace(/\\\(/g, "(")
          .replace(/\\\)/g, ")")
          .replace(/\\\\/g, "\\");
        if (t.trim()) texts.push(t);
      }
    }

    text = texts.join(" ").replace(/\s+/g, " ").trim();

    // If no text found via PDF operators, try to extract readable ASCII sequences
    if (!text || text.length < 50) {
      const asciiChunks: string[] = [];
      let current = "";
      for (let i = 0; i < rawText.length; i++) {
        const code = rawText.charCodeAt(i);
        if (code >= 32 && code < 127) {
          current += rawText[i];
        } else {
          if (current.length > 20) asciiChunks.push(current);
          current = "";
        }
      }
      if (current.length > 20) asciiChunks.push(current);

      // Filter out PDF structure keywords
      const filtered = asciiChunks.filter(
        (c) => !c.match(/^(stream|endstream|endobj|obj|xref|trailer|startxref)/i) &&
               !c.match(/^\s*\/[A-Z]/) &&
               c.replace(/[^a-zA-Z]/g, "").length > c.length * 0.3
      );
      text = filtered.join("\n").slice(0, 10000);
    }

    if (!text || text.length < 10) {
      text = "Could not extract readable text from this PDF. It may be image-based or encrypted.";
    } else {
      text = text.slice(0, 10000);
    }

    console.log(`Extracted ${text.length} characters from PDF`);

    return new Response(
      JSON.stringify({ text }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("extract-pdf-text error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
