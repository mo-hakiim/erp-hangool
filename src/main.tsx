import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { I18nProvider } from "./i18n";
import { supabaseConfigured } from "./lib/supabase";
import "./index.css";

const root = createRoot(document.getElementById("root")!);

if (!supabaseConfigured) {
  root.render(
    <div style={{ fontFamily: "system-ui", padding: 24 }}>
      Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Copy .env.example to .env.local and fill them in.
    </div>,
  );
} else {
  root.render(
    <StrictMode>
      <I18nProvider>
        <App />
      </I18nProvider>
    </StrictMode>,
  );
}
