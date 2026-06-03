import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2, ExternalLink } from "lucide-react";

export function Providers() {
  const [providers, setProviders] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ name: "", baseUrl: "", anthropicBaseUrl: "", supportedProtocols: ["openai"] as string[], balancingStrategy: "round_robin", timeoutMs: 120000 });

  const load = () => api.getProviders().then(setProviders);
  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: "", baseUrl: "", anthropicBaseUrl: "", supportedProtocols: ["openai"], balancingStrategy: "round_robin", timeoutMs: 120000 });
    setDialogOpen(true);
  };

  const openEdit = (p: any) => {
    setEditing(p);
    setForm({ name: p.name, baseUrl: p.baseUrl, anthropicBaseUrl: p.anthropicBaseUrl || "", supportedProtocols: p.supportedProtocols, balancingStrategy: p.balancingStrategy, timeoutMs: p.timeoutMs });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (editing) {
      await api.updateProvider(editing.id, form);
    } else {
      await api.createProvider(form);
    }
    setDialogOpen(false);
    load();
  };

  const handleDelete = async (id: string) => {
    if (confirm("Delete this provider?")) {
      await api.deleteProvider(id);
      load();
    }
  };

  const toggleEnabled = async (p: any) => {
    await api.updateProvider(p.id, { enabled: !p.enabled });
    load();
  };

  const testUrl = async (id: string) => {
    const result = await api.testProviderUrl(id);
    alert(result.reachable ? `Reachable (status: ${result.status})` : "Unreachable");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold">Providers</h2>
        <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />Add Provider</Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Base URL</TableHead>
                <TableHead>Protocols</TableHead>
                <TableHead>Strategy</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {providers.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell className="max-w-xs truncate">{p.baseUrl}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {p.supportedProtocols.map((proto: string) => (
                        <Badge key={proto} variant={proto === "openai" ? "default" : "secondary"}>{proto}</Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>{p.balancingStrategy}</TableCell>
                  <TableCell>
                    <Switch checked={p.enabled} onCheckedChange={() => toggleEnabled(p)} />
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => testUrl(p.id)}><ExternalLink className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(p.id)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Provider" : "Add Provider"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Base URL</Label>
              <Input value={form.baseUrl} onChange={(e) => setForm({ ...form, baseUrl: e.target.value })} placeholder="https://api.openai.com" />
            </div>
            <div className="space-y-2">
              <Label>Supported Protocols</Label>
              <div className="flex gap-2">
                {["openai", "anthropic"].map((proto) => (
                  <Badge
                    key={proto}
                    variant={form.supportedProtocols.includes(proto) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => {
                      const protocols = form.supportedProtocols.includes(proto)
                        ? form.supportedProtocols.filter((p) => p !== proto)
                        : [...form.supportedProtocols, proto];
                      setForm({ ...form, supportedProtocols: protocols });
                    }}
                  >
                    {proto}
                  </Badge>
                ))}
              </div>
            </div>
            {form.supportedProtocols.includes("anthropic") && (
              <div className="space-y-2">
                <Label>Anthropic Base URL <span className="text-muted-foreground text-xs">(optional, defaults to Base URL)</span></Label>
                <Input value={form.anthropicBaseUrl} onChange={(e) => setForm({ ...form, anthropicBaseUrl: e.target.value })} placeholder="https://api.anthropic.com" />
              </div>
            )}
            <div className="space-y-2">
              <Label>Balancing Strategy</Label>
              <Select value={form.balancingStrategy} onValueChange={(v) => setForm({ ...form, balancingStrategy: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="round_robin">Round Robin</SelectItem>
                  <SelectItem value="random">Random</SelectItem>
                  <SelectItem value="ordered_failover">Ordered Failover</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Timeout (ms)</Label>
              <Input type="number" value={form.timeoutMs} onChange={(e) => setForm({ ...form, timeoutMs: parseInt(e.target.value) || 120000 })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
