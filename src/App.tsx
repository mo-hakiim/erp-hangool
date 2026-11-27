import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "@/auth/AuthProvider";
import { ForgotPasswordPage, LoginPage, MfaChallengePage, MfaSetupPage, ResetPasswordPage } from "@/auth/pages";
import { AppShell } from "@/app/AppShell";
import { Guard, HomeRedirect, NotFound, RequireAuth } from "@/app/guards";
import { access, navItems } from "@/app/nav";
import { AccountPage } from "@/pages/AccountPage";
import { NotificationsPage } from "@/pages/NotificationsPage";
import { ClientHomePage, OwnerPlaceholder, StaffHomePage } from "@/pages/HomePages";

// Owner portal screens (stage 3 replaces the placeholders). Each route is guarded with the same rule as its menu item.
const ownerRoutes = navItems.filter((i) => i.path.startsWith("/owner"));

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
                <Route key={item.path} path={item.path.slice(1)} element={<Guard allow={item.allow}><OwnerPlaceholder titleKey={item.key} /></Guard>} />
              ))}
              <Route path="owner/*" element={<Guard allow={access.management}><NotFound /></Guard>} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
