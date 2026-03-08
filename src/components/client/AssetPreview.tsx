import { useState } from "react";
import { ExternalLink, ZoomIn, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AssetPreviewProps {
  assetType: string;
  assetName: string;
  fileUrl: string | null;
  content: any;
}

function ImageZoomModal({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80" onClick={onClose}>
      <button onClick={onClose} className="absolute top-4 right-4 text-white hover:text-white/80 z-50">
        <X className="w-6 h-6" />
      </button>
      <img src={src} alt={alt} className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg" onClick={(e) => e.stopPropagation()} />
    </div>
  );
}

function LandingPagePreview({ fileUrl, content, assetName }: Omit<AssetPreviewProps, "assetType">) {
  const [zoomed, setZoomed] = useState(false);
  const url = content?.url || null;
  const isImage = fileUrl?.match(/\.(png|jpg|jpeg|webp|gif)$/i);
  const isPdf = fileUrl?.match(/\.pdf$/i);
  const htmlContent = content?.html || content?.text || null;

  return (
    <div className="space-y-3">
      {/* URL → iframe */}
      {url && (
        <div>
          <iframe
            src={url}
            title={assetName}
            className="w-full h-[600px] rounded-lg border border-border"
            sandbox="allow-scripts allow-same-origin"
          />
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 mt-2 text-sm text-primary hover:underline"
          >
            <ExternalLink className="w-3.5 h-3.5" /> Open in new tab
          </a>
        </div>
      )}

      {/* Image → zoomable */}
      {isImage && fileUrl && (
        <div className="relative group cursor-pointer" onClick={() => setZoomed(true)}>
          <img src={fileUrl} alt={assetName} className="w-full rounded-lg border border-border" />
          <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/20 transition-colors rounded-lg">
            <ZoomIn className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
          </div>
          {zoomed && <ImageZoomModal src={fileUrl} alt={assetName} onClose={() => setZoomed(false)} />}
        </div>
      )}

      {/* PDF → embedded viewer */}
      {isPdf && fileUrl && (
        <div>
          <embed src={fileUrl} type="application/pdf" className="w-full h-[600px] rounded-lg border border-border" />
          <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 mt-2 text-sm text-primary hover:underline">
            <ExternalLink className="w-3.5 h-3.5" /> Download PDF
          </a>
        </div>
      )}

      {/* Non-image/pdf file link */}
      {fileUrl && !isImage && !isPdf && (
        <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
          <ExternalLink className="w-3.5 h-3.5" /> View file
        </a>
      )}

      {/* HTML/text content → styled preview */}
      {!url && !fileUrl && htmlContent && (
        <div className="prose prose-sm max-w-none text-foreground border border-border rounded-lg p-6 bg-background">
          {content?.html ? (
            <div dangerouslySetInnerHTML={{ __html: content.html }} />
          ) : (
            <div className="whitespace-pre-wrap">{htmlContent}</div>
          )}
        </div>
      )}

      {/* Nothing to show */}
      {!url && !fileUrl && !htmlContent && (
        <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No preview available yet. The asset file will appear here once uploaded.
        </div>
      )}
    </div>
  );
}

function EmailFlowPreview({ content, fileUrl, assetName }: Omit<AssetPreviewProps, "assetType">) {
  const [zoomed, setZoomed] = useState(false);
  const isImage = fileUrl?.match(/\.(png|jpg|jpeg|webp|gif)$/i);

  return (
    <div className="space-y-3">
      {/* Image preview of the email */}
      {isImage && fileUrl && (
        <div className="relative group cursor-pointer" onClick={() => setZoomed(true)}>
          <img src={fileUrl} alt={assetName} className="w-full max-w-[600px] mx-auto rounded-lg border border-border" />
          <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/20 transition-colors rounded-lg">
            <ZoomIn className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
          </div>
          {zoomed && <ImageZoomModal src={fileUrl} alt={assetName} onClose={() => setZoomed(false)} />}
        </div>
      )}

      {/* Realistic email mockup */}
      {(content?.subject || content?.body) && (
        <div className="bg-muted/50 rounded-lg p-6">
          <div className="mx-auto max-w-[600px] bg-card rounded-lg shadow-md border border-border overflow-hidden">
            {/* Email header bar */}
            <div className="px-5 py-3 border-b border-border bg-muted/30">
              <div className="flex items-center gap-1.5 mb-2">
                <div className="w-3 h-3 rounded-full bg-destructive/40" />
                <div className="w-3 h-3 rounded-full bg-[hsl(45,93%,47%)]/40" />
                <div className="w-3 h-3 rounded-full bg-[hsl(var(--status-approved))]/40" />
              </div>
              {content?.subject && (
                <p className="font-semibold text-foreground text-sm">{content.subject}</p>
              )}
              {content?.preview_text && (
                <p className="text-xs text-muted-foreground mt-0.5">{content.preview_text}</p>
              )}
            </div>
            {/* Email body */}
            <div className="px-5 py-4">
              {content?.body ? (
                <div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{content.body}</div>
              ) : (
                <p className="text-sm text-muted-foreground italic">No email body content</p>
              )}
              {content?.cta && (
                <div className="mt-4">
                  <span className="inline-block px-5 py-2.5 rounded-md bg-primary text-primary-foreground text-sm font-medium">
                    {content.cta}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Fallback: file link */}
      {fileUrl && !isImage && (
        <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
          <ExternalLink className="w-3.5 h-3.5" /> View file
        </a>
      )}

      {!fileUrl && !content?.subject && !content?.body && (
        <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No preview available yet.
        </div>
      )}
    </div>
  );
}

function SocialPostPreview({ content, fileUrl, assetName }: Omit<AssetPreviewProps, "assetType">) {
  const [zoomed, setZoomed] = useState(false);
  const isImage = fileUrl?.match(/\.(png|jpg|jpeg|webp|gif)$/i);

  return (
    <div className="space-y-3">
      {isImage && fileUrl && (
        <div className="relative group cursor-pointer max-w-md" onClick={() => setZoomed(true)}>
          <img src={fileUrl} alt={assetName} className="w-full rounded-lg border border-border" />
          <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/20 transition-colors rounded-lg">
            <ZoomIn className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
          </div>
          {zoomed && <ImageZoomModal src={fileUrl} alt={assetName} onClose={() => setZoomed(false)} />}
        </div>
      )}
      {fileUrl && !isImage && (
        <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
          <ExternalLink className="w-3.5 h-3.5" /> View file
        </a>
      )}
      {!fileUrl && !content?.caption && (
        <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No preview available yet.
        </div>
      )}
    </div>
  );
}

function BlogPreview({ content, fileUrl, assetName }: Omit<AssetPreviewProps, "assetType">) {
  if (content?.html) {
    return (
      <div className="prose prose-sm max-w-none text-foreground border border-border rounded-lg p-6 bg-background">
        <div dangerouslySetInnerHTML={{ __html: content.html }} />
      </div>
    );
  }
  if (fileUrl) {
    return (
      <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
        <ExternalLink className="w-3.5 h-3.5" /> View file
      </a>
    );
  }
  // Text content is rendered via CommentableSection paragraphs in the parent
  return null;
}

export function AssetPreview({ assetType, assetName, fileUrl, content }: AssetPreviewProps) {
  switch (assetType) {
    case "landing_page":
      return <LandingPagePreview fileUrl={fileUrl} content={content} assetName={assetName} />;
    case "email_flow":
      return <EmailFlowPreview fileUrl={fileUrl} content={content} assetName={assetName} />;
    case "social_post":
      return <SocialPostPreview fileUrl={fileUrl} content={content} assetName={assetName} />;
    case "blog_article":
      return <BlogPreview fileUrl={fileUrl} content={content} assetName={assetName} />;
    default:
      return (
        <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No preview available for this asset type.
        </div>
      );
  }
}
