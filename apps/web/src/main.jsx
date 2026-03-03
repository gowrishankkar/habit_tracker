import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import { store } from "./app/store";
import { AuthProvider } from "./app/AuthContext";
import App from "./App";
import "./index.css";
import { registerSW } from "virtual:pwa-register";

const updateSW = registerSW({
  onNeedRefresh() {
    const accepted = window.confirm(
      "A new version of Habit Tracker is available. Reload to update?"
    );
    if (accepted) updateSW(true);
  },
  onOfflineReady() {
    console.info("[PWA] App is ready for offline use.");
  },
});

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error('Root element #root not found. Check that index.html contains <div id="root">.');
}

createRoot(rootElement).render(
  <StrictMode>
    <Provider store={store}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </Provider>
  </StrictMode>,
);
