import { useState } from "react";
import { Monitor, Smartphone, Heart, MessageCircle, Send, Bookmark, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Visual mockup renderer for AI-generated asset JSON.
 * Builds realistic browser/email/social/blog previews instead of plain text sections.
 */

interface Props {
  assetType: string;
  content: any;
  fileUrl?: string | null;
  brandName?: string;
}

// ─── Browser frame ──────────────────────────────────────
function BrowserFrame({ children, mobile }: { children: React.ReactNode; mobile?: boolean }) {
  return (
    <div
      className={`mx-auto bg-card rounded-xl shadow-lg border border-border overflow-hidden ${
        mobile ? "max-w-[380px]" : "max-w-full"
      }`}
    >
      <div className="flex items-center gap-1.5 px-4 py-2.5 bg-muted/40 border-b border-border">
        <div className="w-3 h-3 rounded-full bg-destructive/50" />
        <div className="w-3 h-3 rounded-full bg-[hsl(45,93%,47%)]/60" />
        <div className="w-3 h-3 rounded-full bg-[hsl(var(--status-approved))]/60" />
        <div className="flex-1 mx-3 h-6 rounded-md bg-background border border-border flex items-center px-2.5">
          <span className="text-[11px] text-muted-foreground truncate">https://landing.pragma.com</span>
        </div>
      </div>
      <div className="bg-background max-h-[70vh] overflow-y-auto">{children}</div>
    </div>
  );
}

// ─── Phone frame (for social/mobile email) ──────────────
function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-[400px] bg-foreground/90 rounded-[2.5rem] p-3 shadow-xl">
      <div className="bg-background rounded-[2rem] overflow-hidden max-h-[70vh] overflow-y-auto">
        {children}
      </div>
    </div>
  );
}

// ─── Landing Page Visual ────────────────────────────────
function LandingVisual({ content, mobile }: { content: any; mobile: boolean }) {
  const padX = mobile ? "px-5" : "px-10";
  return (
    <BrowserFrame mobile={mobile}>
      <div className="bg-[hsl(var(--background))] text-foreground">
        {/* Hero */}
        {content.hero && (
          <section className={`${padX} py-12 bg-gradient-to-br from-primary/10 via-background to-secondary/30 text-center`}>
            {content.hero.eyebrow && (
              <p className="text-xs uppercase tracking-widest text-primary font-semibold mb-3">{content.hero.eyebrow}</p>
            )}
            {content.hero.headline && (
              <h1 className={`font-bold text-foreground leading-tight ${mobile ? "text-3xl" : "text-5xl"} max-w-3xl mx-auto`}>
                {content.hero.headline}
              </h1>
            )}
            {content.hero.subheadline && (
              <p className={`mt-4 text-muted-foreground max-w-2xl mx-auto ${mobile ? "text-sm" : "text-lg"}`}>
                {content.hero.subheadline}
              </p>
            )}
            {content.hero.cta_primary && (
              <button className="mt-6 inline-flex items-center px-7 py-3 rounded-full bg-primary text-primary-foreground font-semibold shadow-md hover:shadow-lg transition-shadow">
                {content.hero.cta_primary}
              </button>
            )}
            {Array.isArray(content.hero.trust_badges) && content.hero.trust_badges.length > 0 && (
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                {content.hero.trust_badges.map((b: string, i: number) => (
                  <span key={i} className="text-[11px] px-2.5 py-1 rounded-full bg-card border border-border text-muted-foreground">
                    ✓ {b}
                  </span>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Problem */}
        {content.problem_section && (
          <section className={`${padX} py-10 bg-secondary/20`}>
            <h2 className={`font-bold text-foreground text-center ${mobile ? "text-xl" : "text-3xl"} mb-6`}>
              {content.problem_section.title || "El problema"}
            </h2>
            <div className={`grid gap-3 max-w-3xl mx-auto ${mobile ? "" : "md:grid-cols-2"}`}>
              {(content.problem_section.pain_points || []).map((p: string, i: number) => (
                <div key={i} className="p-4 rounded-lg bg-card border border-border flex gap-3">
                  <span className="text-destructive text-xl leading-none">✗</span>
                  <span className="text-sm text-foreground">{p}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Solution */}
        {content.solution_section && (
          <section className={`${padX} py-12`}>
            <h2 className={`font-bold text-foreground text-center ${mobile ? "text-xl" : "text-3xl"} mb-3`}>
              {content.solution_section.title || "La solución"}
            </h2>
            {content.solution_section.description && (
              <p className="text-center text-muted-foreground max-w-2xl mx-auto mb-8">
                {content.solution_section.description}
              </p>
            )}
            <div className={`grid gap-4 max-w-4xl mx-auto ${mobile ? "" : "md:grid-cols-3"}`}>
              {(content.solution_section.benefits || []).map((b: any, i: number) => (
                <div key={i} className="p-5 rounded-xl bg-card border border-border hover:shadow-md transition-shadow">
                  <div className="w-10 h-10 rounded-lg bg-primary/15 text-primary flex items-center justify-center font-bold mb-3">
                    {i + 1}
                  </div>
                  <h3 className="font-semibold text-foreground mb-1.5">{b.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{b.description}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Social proof */}
        {content.social_proof && (
          <section className={`${padX} py-12 bg-secondary/20`}>
            <h2 className={`font-bold text-foreground text-center ${mobile ? "text-xl" : "text-3xl"} mb-8`}>
              {content.social_proof.title || "Lo que dicen"}
            </h2>
            <div className={`grid gap-4 max-w-4xl mx-auto ${mobile ? "" : "md:grid-cols-2"}`}>
              {(content.social_proof.testimonials || []).map((t: any, i: number) => (
                <blockquote key={i} className="p-5 rounded-xl bg-card border border-border">
                  <p className="text-foreground italic leading-relaxed">"{t.quote}"</p>
                  <footer className="mt-3 flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold text-sm">
                      {(t.author || "?").charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{t.author}</p>
                      {t.detail && <p className="text-xs text-muted-foreground">{t.detail}</p>}
                    </div>
                  </footer>
                </blockquote>
              ))}
            </div>
          </section>
        )}

        {/* Offer */}
        {content.offer_section && (
          <section className={`${padX} py-12`}>
            <div className="max-w-2xl mx-auto p-8 rounded-2xl bg-gradient-to-br from-primary/10 to-secondary/30 border-2 border-primary/30 text-center">
              <h2 className={`font-bold text-foreground ${mobile ? "text-xl" : "text-3xl"} mb-3`}>
                {content.offer_section.title || "La oferta"}
              </h2>
              {content.offer_section.description && (
                <p className="text-muted-foreground mb-5">{content.offer_section.description}</p>
              )}
              <ul className="text-left space-y-2 mb-6 max-w-md mx-auto">
                {(content.offer_section.bullets || []).map((b: string, i: number) => (
                  <li key={i} className="flex gap-2 text-sm text-foreground">
                    <span className="text-primary">✓</span>
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
              {content.offer_section.cta && (
                <button className="px-8 py-3 rounded-full bg-primary text-primary-foreground font-semibold shadow-md">
                  {content.offer_section.cta}
                </button>
              )}
              {content.offer_section.urgency && (
                <p className="text-xs text-muted-foreground mt-3 italic">⏰ {content.offer_section.urgency}</p>
              )}
            </div>
          </section>
        )}

        {/* FAQ */}
        {Array.isArray(content.faq) && content.faq.length > 0 && (
          <section className={`${padX} py-12 bg-secondary/20`}>
            <h2 className={`font-bold text-foreground text-center ${mobile ? "text-xl" : "text-3xl"} mb-6`}>FAQ</h2>
            <div className="max-w-2xl mx-auto space-y-3">
              {content.faq.map((f: any, i: number) => (
                <details key={i} className="p-4 rounded-lg bg-card border border-border group">
                  <summary className="font-semibold text-foreground cursor-pointer list-none flex justify-between items-center">
                    <span>{f.q || f.question}</span>
                    <span className="text-muted-foreground group-open:rotate-180 transition-transform">▾</span>
                  </summary>
                  <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{f.a || f.answer}</p>
                </details>
              ))}
            </div>
          </section>
        )}

        {/* Final CTA */}
        {content.final_cta && (
          <section className={`${padX} py-16 bg-primary text-primary-foreground text-center`}>
            <h2 className={`font-bold ${mobile ? "text-2xl" : "text-4xl"} max-w-2xl mx-auto`}>
              {content.final_cta.headline || "Empieza ahora"}
            </h2>
            {content.final_cta.subheadline && (
              <p className="mt-3 opacity-90 max-w-xl mx-auto">{content.final_cta.subheadline}</p>
            )}
            {content.final_cta.button && (
              <button className="mt-6 px-8 py-3 rounded-full bg-background text-primary font-semibold shadow-lg">
                {content.final_cta.button}
              </button>
            )}
            {content.final_cta.reassurance && (
              <p className="text-xs opacity-75 mt-4">{content.final_cta.reassurance}</p>
            )}
          </section>
        )}

        {/* Footer */}
        <footer className={`${padX} py-6 text-center text-xs text-muted-foreground border-t border-border`}>
          © {new Date().getFullYear()} · Powered by Pragma
        </footer>
      </div>
    </BrowserFrame>
  );
}

// ─── Email Visual ────────────────────────────────────────
function EmailVisual({ content, brandName }: { content: any; brandName?: string }) {
  const emails = Array.isArray(content.emails) ? content.emails : (content.subject || content.body ? [content] : []);
  if (emails.length === 0) {
    return <p className="text-sm text-muted-foreground italic text-center py-8">No hay emails para previsualizar.</p>;
  }
  return (
    <div className="space-y-6">
      {emails.map((email: any, i: number) => (
        <div key={i} className="mx-auto max-w-[600px] bg-card rounded-lg shadow-md border border-border overflow-hidden">
          {/* Mail client header */}
          <div className="px-5 py-3 border-b border-border bg-muted/40">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-destructive/40" />
                <div className="w-3 h-3 rounded-full bg-[hsl(45,93%,47%)]/50" />
                <div className="w-3 h-3 rounded-full bg-[hsl(var(--status-approved))]/50" />
              </div>
              {typeof email.day_offset === "number" && (
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Día {email.day_offset}</span>
              )}
            </div>
            <div className="flex items-start gap-2.5">
              <div className="w-9 h-9 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-sm shrink-0">
                {(brandName || "P").charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{brandName || "Tu marca"}</span> &lt;hello@brand.com&gt;
                </p>
                {email.subject && (
                  <p className="font-semibold text-foreground text-sm mt-0.5 truncate">{email.subject}</p>
                )}
                {email.preview_text && (
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{email.preview_text}</p>
                )}
              </div>
            </div>
          </div>

          {/* Email body */}
          <div className="bg-background">
            {/* Optional header banner */}
            <div className="bg-gradient-to-r from-primary/15 to-secondary/30 px-6 py-5 text-center border-b border-border">
              <p className="text-xs uppercase tracking-widest text-primary font-bold">{brandName || "Newsletter"}</p>
            </div>

            <div className="px-6 py-6 space-y-4">
              {(email.body_markdown || email.body) && (
                <div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                  {email.body_markdown || email.body}
                </div>
              )}

              {Array.isArray(email.sections) && email.sections.map((s: any, j: number) => (
                <div key={j} className="space-y-1.5">
                  {s.heading && <h3 className="font-semibold text-foreground">{s.heading}</h3>}
                  {s.body && <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{s.body}</p>}
                </div>
              ))}

              {(email.cta_text || email.cta) && (
                <div className="pt-3 text-center">
                  <span className="inline-block px-7 py-3 rounded-md bg-primary text-primary-foreground text-sm font-semibold shadow-sm">
                    {email.cta_text || email.cta}
                  </span>
                  {email.cta_purpose && (
                    <p className="text-[11px] text-muted-foreground italic mt-2">{email.cta_purpose}</p>
                  )}
                </div>
              )}

              {email.signature && (
                <div className="pt-4 mt-4 border-t border-border text-sm text-muted-foreground whitespace-pre-wrap">
                  {email.signature}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-muted/30 border-t border-border text-center">
              <p className="text-[10px] text-muted-foreground">
                {brandName || "Tu marca"} · <a className="underline">Cancelar suscripción</a> · <a className="underline">Preferencias</a>
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Social Post Visual ──────────────────────────────────
function SocialVisual({ content, fileUrl, brandName }: { content: any; fileUrl?: string | null; brandName?: string }) {
  const isImage = fileUrl?.match(/\.(png|jpg|jpeg|webp|gif)$/i);
  const handle = (brandName || "tu_marca").toLowerCase().replace(/\s+/g, "_");
  const slides = Array.isArray(content.carousel_slides) ? content.carousel_slides : [];

  return (
    <PhoneFrame>
      <div className="bg-background">
        {/* IG header */}
        <div className="px-3 py-2.5 flex items-center justify-between border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[hsl(330,80%,60%)] via-[hsl(20,90%,60%)] to-[hsl(45,90%,60%)] p-0.5">
              <div className="w-full h-full rounded-full bg-background flex items-center justify-center text-xs font-bold text-foreground">
                {(brandName || "P").charAt(0).toUpperCase()}
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground leading-tight">{handle}</p>
              <p className="text-[10px] text-muted-foreground leading-tight">{content.platform || "Instagram"}</p>
            </div>
          </div>
          <MoreHorizontal className="w-5 h-5 text-foreground" />
        </div>

        {/* Image / slides */}
        {isImage && fileUrl ? (
          <img src={fileUrl} alt="" className="w-full aspect-square object-cover" />
        ) : slides.length > 0 ? (
          <div className="aspect-square bg-gradient-to-br from-primary/30 via-secondary/40 to-primary/10 p-6 flex flex-col justify-center text-center">
            <p className="text-[10px] uppercase tracking-wider text-primary font-bold mb-2">Slide 1 / {slides.length}</p>
            <h3 className="text-xl font-bold text-foreground mb-2">{slides[0].headline}</h3>
            <p className="text-sm text-muted-foreground">{slides[0].body}</p>
          </div>
        ) : (
          <div className="aspect-square bg-gradient-to-br from-primary/20 via-secondary/40 to-primary/5 p-8 flex items-center justify-center text-center">
            <p className="text-lg font-semibold text-foreground leading-snug">
              {content.hook || content.visual_brief || "Visual del post"}
            </p>
          </div>
        )}

        {/* Action bar */}
        <div className="px-3 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <Heart className="w-6 h-6 text-foreground" />
            <MessageCircle className="w-6 h-6 text-foreground" />
            <Send className="w-6 h-6 text-foreground" />
          </div>
          <Bookmark className="w-6 h-6 text-foreground" />
        </div>

        {/* Caption */}
        <div className="px-3 pb-4 space-y-1.5">
          <p className="text-xs text-foreground"><span className="font-semibold">1.247 Me gusta</span></p>
          {content.hook && (
            <p className="text-sm text-foreground font-semibold whitespace-pre-wrap">{content.hook}</p>
          )}
          {content.caption && (
            <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
              <span className="font-semibold">{handle}</span>{" "}
              {content.caption}
            </p>
          )}
          {Array.isArray(content.hashtags) && content.hashtags.length > 0 && (
            <p className="text-sm text-primary leading-relaxed">
              {content.hashtags.map((h: string) => `#${h.replace(/^#/, "")}`).join(" ")}
            </p>
          )}
          {content.cta && (
            <p className="text-sm text-foreground font-medium pt-1">→ {content.cta}</p>
          )}
        </div>
      </div>
    </PhoneFrame>
  );
}

// ─── Blog Visual ─────────────────────────────────────────
function BlogVisual({ content, mobile }: { content: any; mobile: boolean }) {
  return (
    <BrowserFrame mobile={mobile}>
      <article className={`bg-background ${mobile ? "px-5 py-8" : "px-12 py-12 max-w-3xl mx-auto"}`}>
        {content.target_keyword && (
          <p className="text-xs uppercase tracking-widest text-primary font-semibold mb-3">{content.target_keyword}</p>
        )}
        {content.h1 && (
          <h1 className={`font-bold text-foreground leading-tight ${mobile ? "text-2xl" : "text-4xl"}`}>{content.h1}</h1>
        )}
        <div className="flex items-center gap-3 mt-4 pb-6 mb-6 border-b border-border">
          <div className="w-10 h-10 rounded-full bg-primary/20 text-primary flex items-center justify-center font-semibold text-sm">P</div>
          <div className="text-xs text-muted-foreground">
            <p className="font-medium text-foreground">Equipo Pragma</p>
            <p>{new Date().toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })} · 5 min de lectura</p>
          </div>
        </div>

        {/* Hero placeholder */}
        <div className="aspect-[2/1] rounded-lg bg-gradient-to-br from-primary/15 to-secondary/40 mb-8 flex items-center justify-center">
          <span className="text-xs text-muted-foreground italic">Imagen destacada</span>
        </div>

        {content.intro && (
          <p className={`${mobile ? "text-base" : "text-lg"} text-foreground italic leading-relaxed mb-6`}>
            {content.intro}
          </p>
        )}

        {Array.isArray(content.sections) && content.sections.map((s: any, i: number) => (
          <section key={i} className="mb-6">
            {(s.h2 || s.heading) && (
              <h2 className={`font-bold text-foreground mt-8 mb-3 ${mobile ? "text-xl" : "text-2xl"}`}>
                {s.h2 || s.heading}
              </h2>
            )}
            {(s.body_markdown || s.body) && (
              <p className="text-foreground whitespace-pre-wrap leading-relaxed">{s.body_markdown || s.body}</p>
            )}
          </section>
        ))}

        {content.conclusion && (
          <section className="mt-10 pt-6 border-t border-border">
            <h2 className={`font-bold text-foreground mb-3 ${mobile ? "text-xl" : "text-2xl"}`}>Conclusión</h2>
            <p className="text-foreground whitespace-pre-wrap leading-relaxed">{content.conclusion}</p>
          </section>
        )}
      </article>
    </BrowserFrame>
  );
}

// ─── Main export ─────────────────────────────────────────
export function AssetVisualPreview({ assetType, content, fileUrl, brandName }: Props) {
  const [mobile, setMobile] = useState(false);
  const showDeviceToggle = assetType === "landing_page" || assetType === "blog_article";

  if (!content || Object.keys(content).length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
        No hay contenido generado todavía. La vista previa aparecerá cuando la IA genere el asset.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {showDeviceToggle && (
        <div className="flex justify-center gap-1 p-1 rounded-md bg-muted/50 w-fit mx-auto">
          <Button
            size="sm"
            variant={!mobile ? "default" : "ghost"}
            onClick={() => setMobile(false)}
            className="h-7 px-3"
          >
            <Monitor className="w-3.5 h-3.5 mr-1.5" /> Desktop
          </Button>
          <Button
            size="sm"
            variant={mobile ? "default" : "ghost"}
            onClick={() => setMobile(true)}
            className="h-7 px-3"
          >
            <Smartphone className="w-3.5 h-3.5 mr-1.5" /> Mobile
          </Button>
        </div>
      )}

      {assetType === "landing_page" && <LandingVisual content={content} mobile={mobile} />}
      {assetType === "email_flow" && <EmailVisual content={content} brandName={brandName} />}
      {assetType === "social_post" && <SocialVisual content={content} fileUrl={fileUrl} brandName={brandName} />}
      {assetType === "blog_article" && <BlogVisual content={content} mobile={mobile} />}
    </div>
  );
}
