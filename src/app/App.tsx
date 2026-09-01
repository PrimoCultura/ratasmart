import { BrowserRouter } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider } from "@/lib/auth/AuthProvider";
import { AppRouter } from "./router";

/**
 * Shell applicativa.
 * AuthProvider usa DemoAuthAdapter; in futuro si potrà iniettare Auth0Adapter.
 */
export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRouter />
        <Toaster richColors position="top-right" closeButton />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
