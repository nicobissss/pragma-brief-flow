import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { uploadClientAsset } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Upload, X, Loader2, CheckCircle2, Palette, Camera,
  Globe, FileText, Mail, Share2, Search, Inbox,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

const BRAND_TAGS = [
  "Professional", "Warm", "Bold", "Minimalist", "Scientific",
  "Energetic", "Premium", "Accessible", "Local", "Innovative",
  "Trustworthy", "Friendly",
] as const;

type MaterialFile = {
  file: File;
  preview?: string;
  description: string;
};

export type ClientUploadItem = {
  url?: string;
  label: string;
  type_hint?: string;
  text_response?: string;
  source: "client_upload" | "admin";
  use_for_ai?: boolean;
  synced_at?: string;
};

export type ClientMaterialsData = {
  logo_url?: string;
  primary_color?: string;
  secondary_color?: string;
  brand_tags?: string[];
  photos?: { url: string; description: string }[];
  website_url?: string;
  website_context?: string;
  pricing_pdf_url?: string;
  pricing_pdf_text?: string;
  email_files?: { url: string; name: string }[];
  email_text?: string;
  social_posts?: { url: string; caption: string }[];
  /** Files synced from /client/collect (read-only here, but admin can toggle use_for_ai) */
  client_uploads?: ClientUploadItem[];
};

interface Props {
  clientId: string;
  kickoffId: string | null;
  materials: ClientMaterialsData;
  onMaterialsChange: (m: ClientMaterialsData) => void;
  onSave: (m: ClientMaterialsData) => Promise<void>;
}

function SectionHeader({ icon, title, provided }: { icon: React.ReactNode; title: string; provided: boolean }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      {provided ? (
        <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
      ) : (
        <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/30 shrink-0" />
      )}
      {icon}
      <h4 className="font-medium text-foreground text-sm">{title}</h4>
    </div>
  );
}

export default function ClientMaterials({ clientId, kickoffId, materials, onMaterialsChange, onSave }: Props) {
  const [saving, setSaving] = useState(false);
  const [fetchingUrl, setFetchingUrl] = useState(false);
  const [extractingPdf, setExtractingPdf] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [uploadingEmails, setUploadingEmails] = useState(false);
  const [uploadingSocial, setUploadingSocial] = useState(false);

  const [photoFiles, setPhotoFiles] = useState<MaterialFile[]>([]);
  const [socialFiles, setSocialFiles] = useState<MaterialFile[]>([]);
  const photoRef = useRef<HTMLInputElement>(null);
  const socialRef = useRef<HTMLInputElement>(null);

  const update = (patch: Partial<ClientMaterialsData>) => {
    onMaterialsChange({ ...materials, ...patch });
  };

  // Completion tracking
  const sections = [
    { name: "Logo & Brand", provided: !!(materials.logo_url || materials.primary_color || (materials.brand_tags?.length ?? 0) > 0) },
    { name: "Photos", provided: (materials.photos?.length ?? 0) > 0 },
    { name: "Website", provided: !!materials.website_context },
    { name: "Pricing PDF", provided: !!materials.pricing_pdf_text },
    { name: "Emails", provided: !!((materials.email_files?.length ?? 0) > 0 || materials.email_text) },
    { name: "Social Posts", provided: (materials.social_posts?.length ?? 0) > 0 },
  ];
  const filledCount = sections.filter((s) => s.provided).length;
  const progressPct = (filledCount / 6) * 100;
  const completenessLabel =
    filledCount <= 2 ? "Basic — prompts will be generic" :
    filledCount <= 4 ? "Good — prompts will be personalized" :
    "Excellent — prompts will be highly specific";

  // Upload helpers
  const uploadFile = async (file: File, folder: string): Promise<string> => {
    const path = `kickoff/${clientId}/${folder}/${Date.now()}_${file.name}`;
    return uploadClientAsset(path, file);
  };

  // 1. Logo upload
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    try {
      const url = await uploadFile(file, "logo");
      update({ logo_url: url });
      toast.success("Logo uploaded");
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploadingLogo(false);
    }
  };

  // 2. Photos upload
  const handlePhotoFiles = useCallback((fileList: FileList | File[]) => {
    const arr = Array.from(fileList);
    const remaining = 20 - photoFiles.length;
    const toAdd = arr.slice(0, remaining).filter((f) => f.size <= 50 * 1024 * 1024);
    const mapped = toAdd.map((f) => ({
      file: f,
      preview: f.type.startsWith("image/") ? URL.createObjectURL(f) : undefined,
      description: "",
    }));
    setPhotoFiles((prev) => [...prev, ...mapped]);
  }, [photoFiles.length]);

  const uploadAllPhotos = async () => {
    if (photoFiles.length === 0) return;
    setUploadingPhotos(true);
    try {
      const uploaded: { url: string; description: string }[] = [];
      for (const pf of photoFiles) {
        const url = await uploadFile(pf.file, "photos");
        uploaded.push({ url, description: pf.description });
      }
      update({ photos: [...(materials.photos || []), ...uploaded] });
      setPhotoFiles([]);
      toast.success(`${uploaded.length} file(s) uploaded`);
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploadingPhotos(false);
    }
  };

  // 3. Website fetch
  const fetchWebsite = async () => {
    if (!materials.website_url?.trim()) return;
    setFetchingUrl(true);
    try {
      const { data, error } = await supabase.functions.invoke("fetch-website-context", {
        body: { url: materials.website_url },
      });
      if (error) throw error;
      update({ website_context: data?.extracted_context || "No content could be extracted." });
      toast.success("Website context extracted");
    } catch (err: any) {
      toast.error(err.message || "Failed to fetch website");
    } finally {
      setFetchingUrl(false);
    }
  };

  // 4. PDF upload & extract
  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || file.size > 20 * 1024 * 1024) {
      toast.error("Max 20MB");
      return;
    }
    setUploadingPdf(true);
    try {
      const url = await uploadFile(file, "pricing");
      update({ pricing_pdf_url: url });
      toast.success("PDF uploaded, extracting text...");

      setExtractingPdf(true);
      const { data, error } = await supabase.functions.invoke("extract-pdf-text", {
        body: { file_url: url },
      });
      if (error) throw error;
      update({ pricing_pdf_url: url, pricing_pdf_text: data?.text || "Could not extract text." });
      toast.success("PDF text extracted");
    } catch (err: any) {
      toast.error(err.message || "PDF processing failed");
    } finally {
      setUploadingPdf(false);
      setExtractingPdf(false);
    }
  };

  // 5. Email files upload
  const handleEmailFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const arr = Array.from(files).slice(0, 5);
    setUploadingEmails(true);
    try {
      const uploaded: { url: string; name: string }[] = [];
      for (const f of arr) {
        const url = await uploadFile(f, "emails");
        uploaded.push({ url, name: f.name });
      }
      update({ email_files: [...(materials.email_files || []), ...uploaded] });
      toast.success(`${uploaded.length} email file(s) uploaded`);
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploadingEmails(false);
    }
  };

  // 6. Social posts upload
  const handleSocialFiles = useCallback((fileList: FileList | File[]) => {
    const arr = Array.from(fileList);
    const remaining = 10 - socialFiles.length;
    const toAdd = arr.slice(0, remaining);
    const mapped = toAdd.map((f) => ({
      file: f,
      preview: f.type.startsWith("image/") ? URL.createObjectURL(f) : undefined,
      description: "",
    }));
    setSocialFiles((prev) => [...prev, ...mapped]);
  }, [socialFiles.length]);

  const uploadAllSocial = async () => {
    if (socialFiles.length === 0) return;
    setUploadingSocial(true);
    try {
      const uploaded: { url: string; caption: string }[] = [];
      for (const sf of socialFiles) {
        const url = await uploadFile(sf.file, "social");
        uploaded.push({ url, caption: sf.description });
      }
      update({ social_posts: [...(materials.social_posts || []), ...uploaded] });
      setSocialFiles([]);
      toast.success(`${uploaded.length} social post(s) uploaded`);
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploadingSocial(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(materials);
      toast.success("Materials saved!");
    } catch (err: any) {
      toast.error(err.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-card rounded-lg border border-border p-6 mb-6">
      <h3 className="font-semibold text-foreground text-lg mb-1">Client Materials (optional but recommended)</h3>
      <p className="text-sm text-muted-foreground mb-6">
        The more you provide, the more specific and ready-to-use the generated prompts will be.
      </p>

      <div className="space-y-6">
        {/* 1. Logo & Brand Colors */}
        <div className="border border-border rounded-lg p-4">
          <SectionHeader icon={<Palette className="w-4 h-4 text-muted-foreground" />} title="Logo & Brand Colors" provided={sections[0].provided} />
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Logo (PNG, SVG, JPG)</label>
              <div className="flex items-center gap-3">
                <Input type="file" accept=".png,.svg,.jpg,.jpeg" onChange={handleLogoUpload} disabled={uploadingLogo} className="max-w-xs" />
                {uploadingLogo && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
                {materials.logo_url && <CheckCircle2 className="w-4 h-4 text-green-500" />}
              </div>
              {materials.logo_url && (
                <img src={materials.logo_url} alt="Logo" className="mt-2 h-12 object-contain rounded border border-border p-1" />
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Primary color</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={materials.primary_color || "#000000"} onChange={(e) => update({ primary_color: e.target.value })} className="w-8 h-8 rounded border border-border cursor-pointer" />
                  <Input value={materials.primary_color || ""} onChange={(e) => update({ primary_color: e.target.value })} placeholder="#000000" className="font-mono text-sm" />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Secondary color</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={materials.secondary_color || "#666666"} onChange={(e) => update({ secondary_color: e.target.value })} className="w-8 h-8 rounded border border-border cursor-pointer" />
                  <Input value={materials.secondary_color || ""} onChange={(e) => update({ secondary_color: e.target.value })} placeholder="#666666" className="font-mono text-sm" />
                </div>
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Brand personality</label>
              <div className="flex flex-wrap gap-2">
                {BRAND_TAGS.map((tag) => {
                  const selected = materials.brand_tags?.includes(tag);
                  return (
                    <Badge
                      key={tag}
                      variant={selected ? "default" : "outline"}
                      className="cursor-pointer select-none"
                      onClick={() => {
                        const current = materials.brand_tags || [];
                        update({ brand_tags: selected ? current.filter((t) => t !== tag) : [...current, tag] });
                      }}
                    >
                      {tag}
                    </Badge>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* 2. Photos & Videos */}
        <div className="border border-border rounded-lg p-4">
          <SectionHeader icon={<Camera className="w-4 h-4 text-muted-foreground" />} title="Photos & Videos" provided={sections[1].provided} />
          <div
            className="border-2 border-dashed border-border rounded-lg p-4 text-center cursor-pointer hover:border-muted-foreground/50 transition-colors mb-3"
            onClick={() => photoRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files.length) handlePhotoFiles(e.dataTransfer.files); }}
          >
            <Upload className="w-5 h-5 text-muted-foreground mx-auto mb-1" />
            <p className="text-xs text-muted-foreground">Drag & drop or click (PNG, JPG, WebP, MP4, MOV · max 50MB · up to 20)</p>
            <input ref={photoRef} type="file" accept=".png,.jpg,.jpeg,.webp,.mp4,.mov" multiple onChange={(e) => { if (e.target.files) handlePhotoFiles(e.target.files); e.target.value = ""; }} className="hidden" />
          </div>
          {photoFiles.length > 0 && (
            <div className="space-y-2 mb-3">
              {photoFiles.map((pf, i) => (
                <div key={i} className="flex items-center gap-2 p-2 bg-secondary/30 rounded">
                  {pf.preview ? <img src={pf.preview} alt="" className="w-10 h-10 object-cover rounded" /> : <FileText className="w-10 h-10 text-muted-foreground" />}
                  <Input placeholder="What is this photo/video of?" value={pf.description} onChange={(e) => setPhotoFiles((prev) => { const n = [...prev]; n[i] = { ...n[i], description: e.target.value }; return n; })} className="flex-1 h-8 text-sm" />
                  <Button variant="ghost" size="icon" onClick={() => setPhotoFiles((p) => p.filter((_, j) => j !== i))}><X className="w-4 h-4" /></Button>
                </div>
              ))}
              <Button size="sm" onClick={uploadAllPhotos} disabled={uploadingPhotos}>
                {uploadingPhotos && <Loader2 className="w-4 h-4 animate-spin mr-1" />} Upload {photoFiles.length} file(s)
              </Button>
            </div>
          )}
          {(materials.photos?.length ?? 0) > 0 && (
            <p className="text-xs text-muted-foreground flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-green-500" /> {materials.photos!.length} file(s) uploaded</p>
          )}
        </div>

        {/* 3. Website URL */}
        <div className="border border-border rounded-lg p-4">
          <SectionHeader icon={<Globe className="w-4 h-4 text-muted-foreground" />} title="Website URL" provided={sections[2].provided} />
          <div className="flex gap-2 mb-3">
            <Input placeholder="https://www.example.com" value={materials.website_url || ""} onChange={(e) => update({ website_url: e.target.value })} className="flex-1" />
            <Button size="sm" onClick={fetchWebsite} disabled={fetchingUrl || !materials.website_url?.trim()}>
              {fetchingUrl ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Search className="w-4 h-4 mr-1" />} Fetch
            </Button>
          </div>
          {materials.website_context && (
            <Textarea value={materials.website_context} onChange={(e) => update({ website_context: e.target.value })} className="min-h-[120px] text-sm" placeholder="Extracted context..." />
          )}
        </div>

        {/* 4. Pricing / Brochure PDF */}
        <div className="border border-border rounded-lg p-4">
          <SectionHeader icon={<FileText className="w-4 h-4 text-muted-foreground" />} title="Pricing / Brochure PDF" provided={sections[3].provided} />
          <Input type="file" accept=".pdf" onChange={handlePdfUpload} disabled={uploadingPdf} className="max-w-sm" />
          {(uploadingPdf || extractingPdf) && (
            <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> {extractingPdf ? "Extracting text..." : "Uploading..."}</div>
          )}
          {materials.pricing_pdf_text && (
            <Textarea value={materials.pricing_pdf_text} onChange={(e) => update({ pricing_pdf_text: e.target.value })} className="mt-3 min-h-[120px] text-sm" />
          )}
        </div>

        {/* 5. Existing Emails */}
        <div className="border border-border rounded-lg p-4">
          <SectionHeader icon={<Mail className="w-4 h-4 text-muted-foreground" />} title="Existing Emails" provided={sections[4].provided} />
          <p className="text-xs text-muted-foreground mb-2">Examples of their current email communications</p>
          <Tabs defaultValue="upload">
            <TabsList className="mb-2">
              <TabsTrigger value="upload">Upload files</TabsTrigger>
              <TabsTrigger value="paste">Paste text</TabsTrigger>
            </TabsList>
            <TabsContent value="upload">
              <Input type="file" accept=".pdf,.txt" multiple onChange={handleEmailFiles} disabled={uploadingEmails} className="max-w-sm" />
              {uploadingEmails && <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Uploading...</div>}
              {(materials.email_files?.length ?? 0) > 0 && (
                <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-green-500" /> {materials.email_files!.length} file(s) uploaded</p>
              )}
            </TabsContent>
            <TabsContent value="paste">
              <Textarea placeholder="Paste email text here..." value={materials.email_text || ""} onChange={(e) => update({ email_text: e.target.value })} className="min-h-[150px]" />
            </TabsContent>
          </Tabs>
        </div>

        {/* 6. Existing Social Posts */}
        <div className="border border-border rounded-lg p-4">
          <SectionHeader icon={<Share2 className="w-4 h-4 text-muted-foreground" />} title="Existing Social Posts" provided={sections[5].provided} />
          <p className="text-xs text-muted-foreground mb-2">Examples of their current social posts</p>
          <div
            className="border-2 border-dashed border-border rounded-lg p-4 text-center cursor-pointer hover:border-muted-foreground/50 transition-colors mb-3"
            onClick={() => socialRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files.length) handleSocialFiles(e.dataTransfer.files); }}
          >
            <Upload className="w-5 h-5 text-muted-foreground mx-auto mb-1" />
            <p className="text-xs text-muted-foreground">Images (PNG, JPG · up to 10)</p>
            <input ref={socialRef} type="file" accept=".png,.jpg,.jpeg" multiple onChange={(e) => { if (e.target.files) handleSocialFiles(e.target.files); e.target.value = ""; }} className="hidden" />
          </div>
          {socialFiles.length > 0 && (
            <div className="space-y-2 mb-3">
              {socialFiles.map((sf, i) => (
                <div key={i} className="flex items-center gap-2 p-2 bg-secondary/30 rounded">
                  {sf.preview && <img src={sf.preview} alt="" className="w-10 h-10 object-cover rounded" />}
                  <Input placeholder="Caption for this post" value={sf.description} onChange={(e) => setSocialFiles((prev) => { const n = [...prev]; n[i] = { ...n[i], description: e.target.value }; return n; })} className="flex-1 h-8 text-sm" />
                  <Button variant="ghost" size="icon" onClick={() => setSocialFiles((p) => p.filter((_, j) => j !== i))}><X className="w-4 h-4" /></Button>


        {/* 7. Files uploaded by the client (synced from /client/collect) */}
        {(materials.client_uploads?.length ?? 0) > 0 && (
          <div className="border border-border rounded-lg p-4 bg-secondary/20">
            <SectionHeader
              icon={<Inbox className="w-4 h-4 text-muted-foreground" />}
              title={`Archivos enviados por el cliente (${materials.client_uploads!.length})`}
              provided
            />
            <p className="text-xs text-muted-foreground mb-3">
              📤 Sincronizados desde el portal del cliente. Marca cuáles debe usar la IA al generar contenido.
            </p>
            <div className="space-y-2">
              {materials.client_uploads!.map((u, i) => (
                <div key={i} className="flex items-start gap-3 p-2 bg-card rounded border border-border">
                  <Checkbox
                    id={`upload-ai-${i}`}
                    checked={u.use_for_ai !== false}
                    onCheckedChange={(checked) => {
                      const next = [...(materials.client_uploads || [])];
                      next[i] = { ...next[i], use_for_ai: !!checked };
                      update({ client_uploads: next });
                    }}
                    className="mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-foreground truncate">{u.label}</span>
                      <Badge variant="outline" className="text-[10px]">📤 cliente</Badge>
                      {u.type_hint && <Badge variant="secondary" className="text-[10px]">{u.type_hint}</Badge>}
                    </div>
                    {u.url && (
                      <a href={u.url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">
                        Ver archivo
                      </a>
                    )}
                    {u.text_response && (
                      <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap line-clamp-3">{u.text_response}</p>
                    )}
                    <label htmlFor={`upload-ai-${i}`} className="text-[11px] text-muted-foreground cursor-pointer block mt-1">
                      Usar para IA
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
              ))}
              <Button size="sm" onClick={uploadAllSocial} disabled={uploadingSocial}>
                {uploadingSocial && <Loader2 className="w-4 h-4 animate-spin mr-1" />} Upload {socialFiles.length} post(s)
              </Button>
            </div>
          )}
          {(materials.social_posts?.length ?? 0) > 0 && (
            <p className="text-xs text-muted-foreground flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-green-500" /> {materials.social_posts!.length} post(s) uploaded</p>
          )}
        </div>
      </div>

      {/* Completeness bar */}
      <div className="mt-6 p-4 bg-secondary/30 rounded-lg">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-foreground">Materials completeness</span>
          <span className="text-xs text-muted-foreground">{filledCount}/6 sections</span>
        </div>
        <Progress value={progressPct} className="h-2 mb-2" />
        <p className="text-xs text-muted-foreground">{completenessLabel}</p>
      </div>

      <Button onClick={handleSave} disabled={saving} className="mt-4">
        {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
        Save Materials
      </Button>
    </div>
  );
}
