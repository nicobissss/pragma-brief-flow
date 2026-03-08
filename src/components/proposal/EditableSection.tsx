import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Pencil, Save, X } from "lucide-react";

type Props = {
  title: string;
  icon: React.ReactNode;
  editable?: boolean;
  children: (editing: boolean) => React.ReactNode;
  onSave?: () => void;
  onCancel?: () => void;
  className?: string;
};

export function EditableSection({ title, icon, editable, children, onSave, onCancel, className }: Props) {
  const [editing, setEditing] = useState(false);

  const handleSave = () => {
    onSave?.();
    setEditing(false);
  };

  const handleCancel = () => {
    onCancel?.();
    setEditing(false);
  };

  return (
    <div className={`bg-card rounded-lg border border-border p-6 ${className || ""}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
          {icon} {title}
        </h3>
        {editable && !editing && (
          <Button variant="ghost" size="sm" onClick={() => setEditing(true)} className="text-muted-foreground">
            <Pencil className="w-4 h-4 mr-1" /> Edit
          </Button>
        )}
        {editing && (
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={handleCancel}>
              <X className="w-4 h-4 mr-1" /> Cancel
            </Button>
            <Button size="sm" onClick={handleSave}>
              <Save className="w-4 h-4 mr-1" /> Save changes
            </Button>
          </div>
        )}
      </div>
      {children(editing)}
    </div>
  );
}
