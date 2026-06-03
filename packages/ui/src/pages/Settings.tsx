import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Download, Upload, RefreshCw } from "lucide-react";

export function Settings() {
  const [settings, setSettings] = useState<any>(null);

  useEffect(() => {
    api.getSettings().then(setSettings);
  }, []);

  const handleExport = async () => {
    const data = await api.exportConfig();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "one-proxy-config.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleResetUsage = async () => {
    if (confirm("Reset all usage counters?")) {
      await api.resetUsage();
      alert("Usage counters reset");
    }
  };

  if (!settings) return <div>Loading...</div>;

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold">Settings</h2>

      <Card>
        <CardHeader><CardTitle>Configuration</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Proxy Public URL</p>
              <p className="text-sm">{settings.proxyPublicUrl}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Translation Fallback</p>
              <Badge variant={settings.translationFallback === "drop" ? "secondary" : "destructive"}>{settings.translationFallback}</Badge>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Debug Log Bodies</p>
              <Badge variant={settings.debugLogBodies ? "destructive" : "secondary"}>{settings.debugLogBodies ? "enabled" : "disabled"}</Badge>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Encryption Key</p>
              <Badge variant={settings.encryptionKeySet ? "success" : "warning"}>{settings.encryptionKeySet ? "configured" : "auto-generated"}</Badge>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Version</p>
              <p className="text-sm">{settings.version}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Backup & Restore</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <Button onClick={handleExport}><Download className="mr-2 h-4 w-4" />Export Config</Button>
            <Button variant="outline"><Upload className="mr-2 h-4 w-4" />Import Config</Button>
          </div>
          <p className="text-xs text-muted-foreground">Export includes providers, models, and proxy key metadata. Encrypted API key secrets are excluded and must be re-entered after import.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Usage</CardTitle></CardHeader>
        <CardContent>
          <Button variant="destructive" onClick={handleResetUsage}><RefreshCw className="mr-2 h-4 w-4" />Reset Usage Counters</Button>
        </CardContent>
      </Card>
    </div>
  );
}
