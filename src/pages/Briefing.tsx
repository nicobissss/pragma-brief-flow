import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { BriefingData, emptyBriefing } from "@/lib/briefing-data";
import { BriefingStep1 } from "@/components/briefing/BriefingStep1";
import { BriefingStep2 } from "@/components/briefing/BriefingStep2";
import { BriefingStep3 } from "@/components/briefing/BriefingStep3";
import { BriefingStep4 } from "@/components/briefing/BriefingStep4";
import { toast } from "sonner";

const STORAGE_KEY = "pragma_briefing_draft";

export default function BriefingPage() {
  const [step, setStep] = useState(1);
  const [data, setData] = useState<BriefingData>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? { ...emptyBriefing, ...JSON.parse(saved) } : emptyBriefing;
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const navigate = useNavigate();

  const update = useCallback((partial: Partial<BriefingData>) => {
    setData((prev) => ({ ...prev, ...partial }));
  }, []);

  // Auto-save every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }, 30000);
    return () => clearInterval(interval);
  }, [data]);

  // Save on step change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [step, data]);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const { name, company_name, email, phone, market, vertical, sub_niche, ...rest } = data;
      const { error } = await supabase.from("prospects").insert({
        name,
        company_name,
        email,
        phone: phone || null,
        market: market as "es" | "it" | "ar",
        vertical,
        sub_niche,
        status: "new",
        briefing_answers: rest,
      });
      if (error) throw error;
      localStorage.removeItem(STORAGE_KEY);
      setSubmitted(true);
    } catch (e: any) {
      toast.error("Error submitting briefing: " + e.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="max-w-lg text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-status-accepted/20 flex items-center justify-center mx-auto">
            <svg className="w-8 h-8 text-status-accepted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-foreground">Thank you!</h1>
          <p className="text-muted-foreground">
            The PRAGMA team will review your briefing and contact you within 24 hours.
          </p>
        </div>
      </div>
    );
  }

  const totalSteps = 4;
  const progress = ((step - 1) / (totalSteps - 1)) * 100;

  return (
    <div className="min-h-screen bg-background">
      {/* Progress bar */}
      <div className="sticky top-0 z-10 bg-card border-b border-border">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-foreground">Step {step} of {totalSteps}</span>
            <span className="text-sm text-muted-foreground">
              {step === 1 && "About your business"}
              {step === 2 && "Your current situation"}
              {step === 3 && "Your goals"}
              {step === 4 && "Confirmation"}
            </span>
          </div>
          <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8">
        {step === 1 && <BriefingStep1 data={data} update={update} onNext={() => setStep(2)} />}
        {step === 2 && <BriefingStep2 data={data} update={update} onNext={() => setStep(3)} onBack={() => setStep(1)} />}
        {step === 3 && <BriefingStep3 data={data} update={update} onNext={() => setStep(4)} onBack={() => setStep(2)} />}
        {step === 4 && <BriefingStep4 data={data} onBack={() => setStep(3)} onSubmit={handleSubmit} submitting={submitting} />}
      </div>
    </div>
  );
}
