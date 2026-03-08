import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import BriefingPage from "./pages/Briefing";
import LoginPage from "./pages/Login";
import AdminLayout from "./layouts/AdminLayout";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminProspects from "./pages/admin/AdminProspects";
import AdminProspectDetail from "./pages/admin/AdminProspectDetail";
import AdminClients from "./pages/admin/AdminClients";
import AdminSettings from "./pages/admin/AdminSettings";
import AdminClientDetail from "./pages/admin/AdminClientDetail";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/briefing" replace />} />
          <Route path="/briefing" element={<BriefingPage />} />
          <Route path="/login" element={<LoginPage />} />

          <Route path="/admin" element={<AdminLayout />}>
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="prospects" element={<AdminProspects />} />
            <Route path="prospect/:id" element={<AdminProspectDetail />} />
            <Route path="clients" element={<AdminClients />} />
            <Route path="client/:id" element={<AdminClientDetail />} />
            <Route path="settings" element={<AdminSettings />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
