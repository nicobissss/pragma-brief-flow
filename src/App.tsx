import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import LoginPage from "./pages/Login";
import AdminLayout from "./layouts/AdminLayout";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminProspects from "./pages/admin/AdminProspects";
import AdminProspectDetail from "./pages/admin/AdminProspectDetail";
import AdminClients from "./pages/admin/AdminClients";
import AdminSettings from "./pages/admin/AdminSettings";
import AdminDataDashboard from "./pages/admin/AdminDataDashboard";
import AdminClientDetail from "./pages/admin/AdminClientDetail";
import AdminClientBible from "./pages/admin/AdminClientBible";
import ClientLayout from "./layouts/ClientLayout";
import ClientDashboard from "./pages/client/ClientDashboard";
import ClientAssetReview from "./pages/client/ClientAssetReview";
import ClientCampaignReview from "./pages/client/ClientCampaignReview";
import ClientCollect from "./pages/client/ClientCollect";
import NotFound from "./pages/NotFound";
import UpdatePasswordPage from "./pages/UpdatePassword";
import UnsubscribePage from "./pages/Unsubscribe";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <ErrorBoundary>
          <Routes>
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/update-password" element={<UpdatePasswordPage />} />
            <Route path="/unsubscribe" element={<UnsubscribePage />} />

            <Route path="/admin" element={<AdminLayout />}>
              <Route path="dashboard" element={<AdminDashboard />} />
              <Route path="prospects" element={<AdminProspects />} />
              <Route path="prospect/:id" element={<AdminProspectDetail />} />
              <Route path="clients" element={<AdminClients />} />
              <Route path="client/:id" element={<AdminClientDetail />} />
              <Route path="client/:id/bible" element={<AdminClientBible />} />
              <Route path="settings" element={<AdminSettings />} />
              <Route path="data" element={<AdminDataDashboard />} />
            </Route>

            <Route path="/client" element={<ClientLayout />}>
              <Route path="dashboard" element={<ClientDashboard />} />
              <Route path="assets/:type" element={<ClientAssetReview />} />
              <Route path="campaign/:id" element={<ClientCampaignReview />} />
              <Route path="collect" element={<ClientCollect />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </ErrorBoundary>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
