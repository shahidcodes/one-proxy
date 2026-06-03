import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2, TestTube } from "lucide-react";

export function KeyPools() {
  const [providers, setProviders] = useState<any[]>([]);
  const [providerKeys, setProviderKeys] = useState<any[]>([]);
  const [proxyKeys, setProxyKeys] = useState<any[]>([]);
  const [selectedProvider, setSelectedProvider] = useState("");
  const [keyDialogOpen, setKeyDialogOpen] = useState(false);
  const [proxyKeyDialogOpen, setProxyKeyDialogOpen] = useState(false);
  const [keyForm, setKeyForm] = useState({ label: "", secret: "", priority: 0 });
  const [proxyKeyForm, setProxyKeyForm] = useState({ label: "" });
  const [newProxyKey, setNewProxyKey] = useState<string | null>(null);

  const load = () => {
    api.getProviders().then((p) => { setProviders(p); if (!selectedProvider && p.length > 0) setSelectedProvider(p[0].id); });
    api.getProxyKeys().then(setProxyKeys);
  };
  useEffect(() => { load(); }, []);
  useEffect(() => { if (selectedProvider) api.getProviderKeys(selectedProvider).then(setProviderKeys); }, [selectedProvider]);

  const handleAddKey = async () => {
    await api.createProviderKey({ ...keyForm, providerId: selectedProvider });
    setKeyDialogOpen(false);
    setKeyForm({ label: "", secret: "", priority: 0 });
    api.getProviderKeys(selectedProvider).then(setProviderKeys);
  };

  const handleDeleteKey = async (id: string) => {
    if (confirm("Delete this key?")) {
      await api.deleteProviderKey(id);
      api.getProviderKeys(selectedProvider).then(setProviderKeys);
    }
  };

  const handleTestKey = async (id: string) => {
    const result = await api.testProviderKey(id);
    alert(result.success ? `Key works (status: ${result.status})` : `Key failed: ${result.error || result.status}`);
  };

  const toggleKeyEnabled = async (key: any) => {
    await api.updateProviderKey(key.id, { enabled: !key.enabled });
    api.getProviderKeys(selectedProvider).then(setProviderKeys);
  };

  const handleAddProxyKey = async () => {
    const result = await api.createProxyKey(proxyKeyForm);
    setNewProxyKey(result.key);
    setProxyKeyDialogOpen(false);
    setProxyKeyForm({ label: "" });
    api.getProxyKeys().then(setProxyKeys);
  };

  const handleDeleteProxyKey = async (id: string) => {
    if (confirm("Delete this proxy key?")) {
      await api.deleteProxyKey(id);
      api.getProxyKeys().then(setProxyKeys);
    }
  };

  const toggleProxyKeyEnabled = async (key: any) => {
    await api.updateProxyKey(key.id, { enabled: !key.enabled });
    api.getProxyKeys().then(setProxyKeys);
  };

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold">Key Pools</h2>

      <Tabs defaultValue="provider-keys">
        <TabsList>
          <TabsTrigger value="provider-keys">Provider API Keys</TabsTrigger>
          <TabsTrigger value="proxy-keys">Proxy API Keys</TabsTrigger>
        </TabsList>

        <TabsContent value="provider-keys" className="space-y-4">
          <div className="flex items-center gap-4">
            <Select value={selectedProvider} onValueChange={setSelectedProvider}>
              <SelectTrigger className="w-64"><SelectValue placeholder="Select provider" /></SelectTrigger>
              <SelectContent>
                {providers.map((p) => <SelectItem key={p.id} value={p.id}>{p.name} ({p.balancingStrategy})</SelectItem>)}
              </SelectContent>
            </Select>
            <Button onClick={() => setKeyDialogOpen(true)}><Plus className="mr-2 h-4 w-4" />Add Key</Button>
          </div>

          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Label</TableHead>
                    <TableHead>Key</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {providerKeys.map((k) => (
                    <TableRow key={k.id}>
                      <TableCell className="font-medium">{k.label}</TableCell>
                      <TableCell>****{k.keyLast4}</TableCell>
                      <TableCell>{k.priority}</TableCell>
                      <TableCell><Switch checked={k.enabled} onCheckedChange={() => toggleKeyEnabled(k)} /></TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="sm" onClick={() => handleTestKey(k.id)}><TestTube className="mr-1 h-4 w-4" />Test</Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDeleteKey(k.id)}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="proxy-keys" className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Proxy API keys are used by coding agents to authenticate with the proxy.</p>
            <Button onClick={() => setProxyKeyDialogOpen(true)}><Plus className="mr-2 h-4 w-4" />Generate Key</Button>
          </div>

          {newProxyKey && (
            <Card className="border-green-200 bg-green-50">
              <CardContent className="pt-6">
                <p className="text-sm font-medium text-green-800">New key generated - copy it now, it won't be shown again:</p>
                <code className="mt-2 block rounded bg-green-100 p-2 text-sm font-mono break-all">{newProxyKey}</code>
                <Button size="sm" className="mt-2" onClick={() => { navigator.clipboard.writeText(newProxyKey); setNewProxyKey(null); }}>Copy & Dismiss</Button>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Label</TableHead>
                    <TableHead>Prefix</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {proxyKeys.map((k) => (
                    <TableRow key={k.id}>
                      <TableCell className="font-medium">{k.label}</TableCell>
                      <TableCell><code>{k.keyPrefix}...</code></TableCell>
                      <TableCell><Switch checked={k.enabled} onCheckedChange={() => toggleProxyKeyEnabled(k)} /></TableCell>
                      <TableCell>{new Date(k.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteProxyKey(k.id)}><Trash2 className="h-4 w-4" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={keyDialogOpen} onOpenChange={setKeyDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Provider API Key</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Label</Label>
              <Input value={keyForm.label} onChange={(e) => setKeyForm({ ...keyForm, label: e.target.value })} placeholder="Personal account" />
            </div>
            <div className="space-y-2">
              <Label>API Key Secret</Label>
              <Input type="password" value={keyForm.secret} onChange={(e) => setKeyForm({ ...keyForm, secret: e.target.value })} placeholder="sk-..." />
            </div>
            <div className="space-y-2">
              <Label>Priority (for failover)</Label>
              <Input type="number" value={keyForm.priority} onChange={(e) => setKeyForm({ ...keyForm, priority: parseInt(e.target.value) || 0 })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setKeyDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAddKey}>Add Key</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={proxyKeyDialogOpen} onOpenChange={setProxyKeyDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Generate Proxy API Key</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Label</Label>
              <Input value={proxyKeyForm.label} onChange={(e) => setProxyKeyForm({ ...proxyKeyForm, label: e.target.value })} placeholder="Cursor on MacBook" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProxyKeyDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAddProxyKey}>Generate</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
