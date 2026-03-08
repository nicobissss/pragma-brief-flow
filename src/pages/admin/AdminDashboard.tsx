import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format, isToday, isBefore, startOfDay } from "date-fns";
import { CalendarClock, Eye } from "lucide-react";

type FollowUp = {
  id: string;
  name: string;
  company_name: string;
  follow_up_date: string;
};

export default function AdminDashboard() {
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchFollowUps = async () => {
      const today = format(new Date(), "yyyy-MM-dd");
      const { data } = await supabase
        .from("prospects")
        .select("id, name, company_name, follow_up_date")
        .not("follow_up_date", "is", null)
        .lte("follow_up_date", today)
        .order("follow_up_date", { ascending: true });
      setFollowUps((data || []) as FollowUp[]);
      setLoading(false);
    };
    fetchFollowUps();
  }, []);

  const isOverdue = (dateStr: string) => {
    return isBefore(new Date(dateStr), startOfDay(new Date())) && !isToday(new Date(dateStr));
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-foreground mb-2">Dashboard</h1>
      <p className="text-muted-foreground mb-8">Welcome to the PRAGMA admin panel.</p>

      {/* Follow-ups card */}
      <div className="bg-card rounded-lg border border-border p-6 max-w-2xl">
        <div className="flex items-center gap-3 mb-4">
          <CalendarClock className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-foreground">Follow ups due today</h3>
          {followUps.length > 0 && (
            <Badge variant="destructive" className="text-xs">{followUps.length}</Badge>
          )}
        </div>

        {loading ? (
          <p className="text-muted-foreground text-sm">Loading...</p>
        ) : followUps.length === 0 ? (
          <p className="text-muted-foreground text-sm">No follow-ups due. 🎉</p>
        ) : (
          <div className="space-y-2">
            {followUps.map((fu) => (
              <div
                key={fu.id}
                className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-secondary/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">{fu.name}</p>
                    <p className="text-xs text-muted-foreground">{fu.company_name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-medium ${isOverdue(fu.follow_up_date) ? "text-destructive" : "text-muted-foreground"}`}>
                    {isOverdue(fu.follow_up_date) ? "Overdue: " : ""}
                    {format(new Date(fu.follow_up_date), "dd MMM yyyy")}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => navigate(`/admin/prospect/${fu.id}`)}
                  >
                    <Eye className="w-3 h-3 mr-1" /> View
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
