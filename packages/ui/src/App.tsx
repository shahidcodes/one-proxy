import { Routes, Route } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Login } from "@/pages/Login";
import { Dashboard } from "@/pages/Dashboard";
import { Providers } from "@/pages/Providers";
import { Models } from "@/pages/Models";
import { KeyPools } from "@/pages/KeyPools";
import { Connection } from "@/pages/Connection";
import { Logs } from "@/pages/Logs";
import { Settings } from "@/pages/Settings";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/providers" element={<Providers />} />
        <Route path="/models" element={<Models />} />
        <Route path="/key-pools" element={<KeyPools />} />
        <Route path="/connection" element={<Connection />} />
        <Route path="/logs" element={<Logs />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
    </Routes>
  );
}
