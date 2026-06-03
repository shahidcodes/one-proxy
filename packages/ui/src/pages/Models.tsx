import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2, Search } from "lucide-react";

export function Models() {
  const [models, setModels] = useState<any[]>([]);
  const [providers, setProviders] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>({
    publicSlug: "", providerId: "", upstreamModelId: "",
    inputPrice: 0, outputPrice: 0, contextWindow: 128000, maxOutputTokens: 8192,
    capStreaming: true, capTools: false, capVision: false, capJsonMode: false, capCaching: false, capThinking: false,
  });

  const load = () => {
    api.getModels(search || undefined).then(setModels);
    api.getProviders().then(setProviders);
  };
  useEffect(() => { load(); }, [search]);

  const openCreate = () => {
    setEditing(null);
    setForm({ publicSlug: "", providerId: providers[0]?.id || "", upstreamModelId: "", inputPrice: 0, outputPrice: 0, contextWindow: 128000, maxOutputTokens: 8192, capStreaming: true, capTools: false, capVision: false, capJsonMode: false, capCaching: false, capThinking: false });
    setDialogOpen(true);
  };

  const openEdit = (m: any) => {
    setEditing(m);
    setForm({ publicSlug: m.publicSlug, providerId: m.providerId, upstreamModelId: m.upstreamModelId, inputPrice: m.inputPrice, outputPrice: m.outputPrice, contextWindow: m.contextWindow, maxOutputTokens: m.maxOutputTokens, capStreaming: m.capStreaming, capTools: m.capTools, capVision: m.capVision, capJsonMode: m.capJsonMode, capCaching: m.capCaching, capThinking: m.capThinking });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (editing) {
      await api.updateModel(editing.id, form);
    } else {
      await api.createModel(form);
    }
    setDialogOpen(false);
    load();
  };

  const handleDelete = async (id: string) => {
    if (confirm("Delete this model?")) { await api.deleteModel(id); load(); }
  };

  const toggleEnabled = async (m: any) => {
    await api.updateModel(m.id, { enabled: !m.enabled });
    load();
  };

  const caps = [
    { key: "capStreaming", label: "Stream" },
    { key: "capTools", label: "Tools" },
    { key: "capVision", label: "Vision" },
    { key: "capJsonMode", label: "JSON" },
    { key: "capCaching", label: "Cache" },
    { key: "capThinking", label: "Think" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold">Models</h2>
        <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />Add Model</Button>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search models..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Slug</TableHead>
                <TableHead>Upstream</TableHead>
                <TableHead>Pricing (per 1M)</TableHead>
                <TableHead>Context</TableHead>
                <TableHead>Capabilities</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {models.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">{m.publicSlug}</TableCell>
                  <TableCell>{m.upstreamModelId}</TableCell>
                  <TableCell>${m.inputPrice} / ${m.outputPrice}</TableCell>
                  <TableCell>{m.contextWindow?.toLocaleString()}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {caps.filter(c => m[c.key]).map(c => (
                        <Badge key={c.key} variant="secondary" className="text-xs">{c.label}</Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell><Switch checked={m.enabled} onCheckedChange={() => toggleEnabled(m)} /></TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(m)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(m.id)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Model" : "Add Model"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Public Slug</Label>
                <Input value={form.publicSlug} onChange={(e) => setForm({ ...form, publicSlug: e.target.value })} placeholder="anthropic/claude-sonnet-4-20250514" />
              </div>
              <div className="space-y-2">
                <Label>Provider</Label>
                <Select value={form.providerId} onValueChange={(v) => setForm({ ...form, providerId: v })}>
                  <SelectTrigger><SelectValue placeholder="Select provider" /></SelectTrigger>
                  <SelectContent>
                    {providers.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Upstream Model ID</Label>
              <Input value={form.upstreamModelId} onChange={(e) => setForm({ ...form, upstreamModelId: e.target.value })} placeholder="claude-sonnet-4-20250514" />
            </div>
            <div className="grid grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Input Price</Label>
                <Input type="number" step="0.01" value={form.inputPrice} onChange={(e) => setForm({ ...form, inputPrice: parseFloat(e.target.value) || 0 })} />
              </div>
              <div className="space-y-2">
                <Label>Output Price</Label>
                <Input type="number" step="0.01" value={form.outputPrice} onChange={(e) => setForm({ ...form, outputPrice: parseFloat(e.target.value) || 0 })} />
              </div>
              <div className="space-y-2">
                <Label>Context Window</Label>
                <Input type="number" value={form.contextWindow} onChange={(e) => setForm({ ...form, contextWindow: parseInt(e.target.value) || 128000 })} />
              </div>
              <div className="space-y-2">
                <Label>Max Output</Label>
                <Input type="number" value={form.maxOutputTokens} onChange={(e) => setForm({ ...form, maxOutputTokens: parseInt(e.target.value) || 8192 })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Capabilities</Label>
              <div className="flex flex-wrap gap-2">
                {caps.map((c) => (
                  <Badge
                    key={c.key}
                    variant={form[c.key] ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => setForm({ ...form, [c.key]: !form[c.key] })}
                  >
                    {c.label}
                  </Badge>
                ))}
              </div>
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
