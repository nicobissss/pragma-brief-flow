import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Upload, X, Loader2, Send, FileText, Image as ImageIcon, ExternalLink } from "lucide-react";

type UploadedFile = {
  file: File;
  preview?: string;
  name: string;
  caption?: string;
};

type SavedAsset = {
  id: string;
  asset_name: string;
  file_url: string | null;
  status: string;
  content: any;
};

interface AssetUploadZoneProps {
  clientId: string;
  assetType: "landing_page" | "email_flow" | "social_post" | "blog_article";
  onAssetSaved?: () => void;
}

const config: Record<string, {
  title: string;
  icon: any;
  accept: string;
  multiple: boolean;
  maxFiles: number;
  hasUrl: boolean;
  hasTextPaste: boolean;
  hasCaptions: boolean;
  description: string;
}> = {
  landing_page: {
    title: "Landing Page",
    icon: FileText,
    accept: ".png,.jpg,.jpeg,.webp,.pdf",
    multiple: false,
    maxFiles: 1,
    hasUrl: true,
    hasTextPaste: false,
    hasCaptions: false,
    description: "Upload an image (PNG, JPG, WebP) or PDF, or paste a URL",
  },
  email_flow: {
    title: "Email Flow",
    icon: FileText,
    accept: ".png,.jpg,.jpeg,.webp,.pdf,.txt",
    multiple: true,
    maxFiles: 5,
    hasUrl: false,
    hasTextPaste: false,
    hasCaptions: false,
    description: "Upload up to 5 files (one per email) or a single PDF",
  },
  social_post: {
    title: "Social Posts",
    icon: ImageIcon,
    accept: ".png,.jpg,.jpeg,.webp",
    multiple: true,
    maxFiles: 20,
    hasUrl: false,
    hasTextPaste: false,
    hasCaptions: true,
    description: "Upload up to 20 images (PNG, JPG, WebP)",
  },
  blog_article: {
    title: "Blog Articles",
    icon: FileText,
    accept: ".pdf,.txt,.md",
    multiple: true,
    maxFiles: 10,
    hasUrl: false,
    hasTextPaste: true,
    hasCaptions: false,
    description: "Upload PDF or TXT files, or paste article text",
  },
};

export default function AssetUploadZone({ clientId, assetType, onAssetSaved }: AssetUploadZoneProps) {
  const cfg = config[assetType];
  const Icon = cfg.icon;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [assetName, setAssetName] = useState("");
  const [notes, setNotes] = useState("");
  const [url, setUrl] = useState("");
  const [pasteText, setPasteText] = useState("");
  const [uploading, setUploading] = useState(false);
  const [notifying, setNotifying] = useState(false);
  const [savedAssets, setSavedAssets] = useState<SavedAsset[]>([]);
  const [dragging, setDragging] = useState(false);

  const handleFiles = useCallback((newFiles: FileList | File[]) => {
    const arr = Array.from(newFiles);
    const remaining = cfg.maxFiles - files.length;
    const toAdd = arr.slice(0, remaining);

    const mapped: UploadedFile[] = toAdd.map((f) => ({
      file: f,
      preview: f.type.startsWith("image/") ? URL.createObjectURL(f) : undefined,
      name: f.name.replace(/\.[^/.]+$/, ""),
    }));

    setFiles((prev) => [...prev, ...mapped]);
  }, [files.length, cfg.maxFiles]);

  const removeFile = (idx: number) => {
    setFiles((prev) => {
      const next = [...prev];
      if (next[idx].preview) URL.revokeObjectURL(next[idx].preview!);
      next.splice(idx, 1);
      return next;
    });
  };

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  }, []);

  const onDragLeave = useCallback(() => setDragging(false), []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const uploadAndSave = async () => {
    if (!assetName.trim() && files.length === 0 && !url.trim() && !pasteText.trim()) {
      toast.error("Add content before saving.");
      return;
    }

    setUploading(true);
    try {
      // Handle URL-based landing page
      if (assetType === "landing_page" && url.trim()) {
        const { error } = await supabase.from("assets").insert({
          client_id: clientId,
          asset_type: assetType,
          asset_name: assetName.trim() || "Landing Page",
          content: { url: url.trim(), notes: notes.trim() || undefined },
        });
        if (error) throw error;
        setSavedAssets((prev) => [...prev, { id: crypto.randomUUID(), asset_name: assetName || "Landing Page", file_url: null, status: "pending_review", content: { url } }]);
        setUrl("");
        setAssetName("");
        setNotes("");
        toast.success("Asset saved!");
        onAssetSaved?.();
        setUploading(false);
        return;
      }

      // Handle pasted text (blog)
      if (assetType === "blog_article" && pasteText.trim() && files.length === 0) {
        const { error } = await supabase.from("assets").insert({
          client_id: clientId,
          asset_type: assetType,
          asset_name: assetName.trim() || "Blog Article",
          content: { text: pasteText.trim(), notes: notes.trim() || undefined },
        });
        if (error) throw error;
        setSavedAssets((prev) => [...prev, { id: crypto.randomUUID(), asset_name: assetName || "Blog Article", file_url: null, status: "pending_review", content: { text: pasteText } }]);
        setPasteText("");
        setAssetName("");
        setNotes("");
        toast.success("Asset saved!");
        onAssetSaved?.();
        setUploading(false);
        return;
      }

      // Upload files
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        const filePath = `${clientId}/${assetType}/${Date.now()}_${f.file.name}`;

        const { error: uploadErr } = await supabase.storage
          .from("client-assets")
          .upload(filePath, f.file);
        if (uploadErr) throw uploadErr;

        const { data: urlData } = supabase.storage
          .from("client-assets")
          .getPublicUrl(filePath);

        const itemName = files.length === 1
          ? (assetName.trim() || f.name)
          : (f.name || `${cfg.title} ${i + 1}`);

        const content: any = { notes: notes.trim() || undefined };
        if (cfg.hasCaptions && f.caption) content.caption = f.caption;

        const { data: inserted, error: insertErr } = await supabase.from("assets").insert({
          client_id: clientId,
          asset_type: assetType,
          asset_name: itemName,
          file_url: urlData.publicUrl,
          content,
        }).select("id, asset_name, file_url, status, content").single();

        if (insertErr) throw insertErr;
        if (inserted) setSavedAssets((prev) => [...prev, inserted as SavedAsset]);
      }

      setFiles([]);
      setAssetName("");
      setNotes("");
      toast.success(`${files.length} asset${files.length > 1 ? "s" : ""} saved!`);
      onAssetSaved?.();
    } catch (e: any) {
      toast.error(e.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const notifyClient = async () => {
    if (savedAssets.length === 0) return;
    setNotifying(true);
    try {
      // Update all saved assets to pending_review
      const ids = savedAssets.map((a) => a.id);
      const { error } = await supabase
        .from("assets")
        .update({ status: "pending_review" as any })
        .in("id", ids);
      if (error) throw error;

      setSavedAssets((prev) => prev.map((a) => ({ ...a, status: "pending_review" })));
      toast.success("Client notified! Assets are now pending review.");
    } catch (e: any) {
      toast.error(e.message || "Failed to notify");
    } finally {
      setNotifying(false);
    }
  };

  return (
    <div className="bg-card rounded-lg border border-border overflow-hidden">
      <div className="p-4 border-b border-border flex items-center gap-3">
        <div className="p-2 rounded-md bg-secondary">
          <Icon className="w-4 h-4 text-foreground" />
        </div>
        <div>
          <h4 className="font-medium text-foreground">{cfg.title}</h4>
          <p className="text-xs text-muted-foreground">{cfg.description}</p>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Asset name */}
        <Input
          placeholder={`${cfg.title} name`}
          value={assetName}
          onChange={(e) => setAssetName(e.target.value)}
        />

        {/* URL input (landing page) */}
        {cfg.hasUrl && (
          <Input
            placeholder="Or paste URL (e.g. https://...)"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        )}

        {/* Text paste (blog) */}
        {cfg.hasTextPaste && (
          <Textarea
            placeholder="Or paste article text directly..."
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            className="min-h-[120px]"
          />
        )}

        {/* Drop zone */}
        {(!cfg.hasUrl || !url.trim()) && (!cfg.hasTextPaste || !pasteText.trim()) && (
          <div
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
              dragging ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/50"
            }`}
          >
            <Upload className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              Drag & drop or click to upload
              {cfg.multiple && ` (up to ${cfg.maxFiles})`}
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept={cfg.accept}
              multiple={cfg.multiple}
              onChange={(e) => { if (e.target.files) handleFiles(e.target.files); e.target.value = ""; }}
              className="hidden"
            />
          </div>
        )}

        {/* File previews */}
        {files.length > 0 && (
          <div className="space-y-2">
            {files.map((f, idx) => (
              <div key={idx} className="flex items-center gap-3 p-2 rounded-md bg-secondary/30">
                {f.preview ? (
                  <img src={f.preview} alt={f.name} className="w-12 h-12 object-cover rounded" />
                ) : (
                  <div className="w-12 h-12 bg-secondary rounded flex items-center justify-center">
                    <FileText className="w-5 h-5 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  {cfg.hasCaptions ? (
                    <Input
                      placeholder="Caption for this image"
                      value={f.caption || ""}
                      onChange={(e) => {
                        setFiles((prev) => {
                          const next = [...prev];
                          next[idx] = { ...next[idx], caption: e.target.value };
                          return next;
                        });
                      }}
                      className="h-8 text-sm"
                    />
                  ) : (
                    <p className="text-sm text-foreground truncate">{f.file.name}</p>
                  )}
                  <p className="text-xs text-muted-foreground">{(f.file.size / 1024).toFixed(0)} KB</p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => removeFile(idx)} className="shrink-0">
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Notes */}
        <Textarea
          placeholder="Optional notes for the client..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="min-h-[60px]"
        />

        {/* Actions */}
        <div className="flex gap-3">
          <Button
            onClick={uploadAndSave}
            disabled={uploading || (files.length === 0 && !url.trim() && !pasteText.trim())}
          >
            {uploading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            Save Asset{files.length > 1 ? "s" : ""}
          </Button>
        </div>

        {/* Saved assets list */}
        {savedAssets.length > 0 && (
          <div className="border-t border-border pt-4 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-foreground">{savedAssets.length} saved</p>
              <Button
                size="sm"
                variant="outline"
                onClick={notifyClient}
                disabled={notifying}
                className="gap-2"
              >
                {notifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Notify client for review
              </Button>
            </div>
            {savedAssets.map((a) => (
              <div key={a.id} className="flex items-center gap-2 text-sm text-muted-foreground">
                <FileText className="w-3 h-3" />
                <span>{a.asset_name}</span>
                {a.content?.url && (
                  <a href={a.content.url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
