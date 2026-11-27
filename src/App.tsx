import { lazy, Suspense, type ReactNode } from "react";
import { Spinner } from "@/components/ui";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "@/auth/AuthProvider";
import { ForgotPasswordPage, LoginPage, MfaChallengePage, MfaSetupPage, ResetPasswordPage } from "@/auth/pages";
import { AppShell } from "@/app/AppShell";
import { Guard, HomeRedirect, NotFound, RequireAuth } from "@/app/guards";
import { access, navItems, type NavItem } from "@/app/nav";
import { AccountPage } from "@/pages/AccountPage";
import { NotificationsPage } from "@/pages/NotificationsPage";
import { ClientHomePage, StaffHomePage } from "@/pages/HomePages";
const OverviewPage = lazy(() => import("@/owner/OverviewPage").then((m) => ({ default: m.OverviewPage })));
const ProjectsPage = lazy(() => import("@/owner/ProjectsPage").then((m) => ({ default: m.ProjectsPage })));
const ProjectDetailPage = lazy(() => import("@/owner/ProjectDetailPage").then((m) => ({ default: m.ProjectDetailPage })));
const ApprovalsPage = lazy(() => import("@/owner/ApprovalsPage").then((m) => ({ default: m.ApprovalsPage })));
const FinancePage = lazy(() => import("@/owner/FinancePage").then((m) => ({ default: m.FinancePage })));
const CrmPage = lazy(() => import("@/owner/CrmPage").then((m) => ({ default: m.CrmPage })));
const ProcurementPage = lazy(() => import("@/owner/ProcurementPage").then((m) => ({ default: m.ProcurementPage })));
const InventoryPage = lazy(() => import("@/owner/InventoryPage").then((m) => ({ default: m.InventoryPage })));
const HrPage = lazy(() => import("@/owner/HrPage").then((m) => ({ default: m.HrPage })));
const RealEstatePage = lazy(() => import("@/owner/RealEstatePage").then((m) => ({ default: m.RealEstatePage })));
const MarketingPage = lazy(() => import("@/owner/MarketingPage").then((m) => ({ default: m.MarketingPage })));
const ReportsPage = lazy(() => import("@/owner/ReportsPage").then((m) => ({ default: m.ReportsPage })));
const DocumentsPage = lazy(() => import("@/owner/DocumentsPage").then((m) => ({ default: m.DocumentsPage })));
const StaffPage = lazy(() => import("@/owner/StaffPage").then((m) => ({ default: m.StaffPage })));
const AuditPage = lazy(() => import("@/owner/AuditPage").then((m) => ({ default: m.AuditPage })));
const SettingsPage = lazy(() => import("@/owner/SettingsPage").then((m) => ({ default: m.SettingsPage })));

// Owner portal screens. Every route uses the same access rule as its menu item.
const ownerScreens: Partial<Record<NavItem["key"], ReactNode>> = {
  overview: <OverviewPage />, projects: <ProjectsPage />, approvals: <ApprovalsPage />, finance: <FinancePage />,
  clients: <CrmPage />, procurement: <ProcurementPage />, inventory: <InventoryPage />, hr: <HrPage />,
  realEstate: <RealEstatePage />, marketing: <MarketingPage />, reports: <ReportsPage />, documents: <DocumentsPage />,
  staff: <StaffPage />, audit: <AuditPage />, settings: <SettingsPage />,
};
const ownerRoutes = navItems.filter((i) => i.path.startsWith("/owner") && ownerScreens[i.key]);

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/mfa" element={<MfaChallengePage />} />
          <Route path="/mfa/setup" element={<MfaSetupPage />} />

          <Route element={<RequireAuth />}>
            <Route element={<AppShell />}>
              <Route index element={<HomeRedirect />} />
              <Route path="home" element={<Guard allow={access.staff}><StaffHomePage /></Guard>} />
              <Route path="client" element={<Guard allow={access.clientOnly}><ClientHomePage /></Guard>} />
              <Route path="notifications" element={<NotificationsPage />} />
              <Route path="account" element={<AccountPage />} />
              {ownerRoutes.map((item) => (
                <Route key={item.path} path={item.path.slice(1)} element={<Guard allow={item.allow}><Suspense fallback={<Spinner />}>{ownerScreens[item.key]}</Suspense></Guard>} />
              ))}
              <Route path="owner/projects/:id" element={<Guard allow={access.management}><Suspense fallback={<Spinner />}><ProjectDetailPage /></Suspense></Guard>} />
              <Route path="owner/*" element={<Guard allow={access.management}><NotFound /></Guard>} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
