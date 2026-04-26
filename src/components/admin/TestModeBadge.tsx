import { Badge } from "@/components/ui/badge";
import { FlaskConical } from "lucide-react";

export default function TestModeBadge({ className = "" }: { className?: string }) {
  return (
    <Badge variant="outline" className={`border-amber-400 bg-amber-50 text-amber-800 gap-1 ${className}`}>
      <FlaskConical className="w-3 h-3" /> TEST
    </Badge>
  );
}
