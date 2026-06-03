import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2, ChevronLeft, ChevronRight } from "lucide-react";

export function Logs() {
  const [data, setData] = useState<any>({ logs: [], total: 0, page: 1, pageSize: 50 });
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<Record<string, string>>({});

  const load = () => {
    const params: Record<string, string> = { page: String(page), pageSize: "50" };
    Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v; });
    api.getLogs(params).then(setData);
  };
  useEffect(() => { load(); }, [page, filters]);

  const clearLogs = async () => {
    if (confirm("Clear all logs?")) {
      await api.clearLogs();
      load();
    }
  };

  const totalPages = Math.ceil(data.total / data.pageSize);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold">Logs</h2>
        <Button variant="destructive" onClick={clearLogs}><Trash2 className="mr-2 h-4 w-4" />Clear Logs</Button>
      </div>

      <div className="flex items-center gap-4">
        <Input className="w-48" placeholder="Model slug" value={filters.modelSlug || ""} onChange={(e) => setFilters({ ...filters, modelSlug: e.target.value })} />
        <Select value={filters.statusCode || "all"} onValueChange={(v) => setFilters({ ...filters, statusCode: v === "all" ? "" : v })}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="200">200 OK</SelectItem>
            <SelectItem value="400">400 Bad Request</SelectItem>
            <SelectItem value="401">401 Unauthorized</SelectItem>
            <SelectItem value="404">404 Not Found</SelectItem>
            <SelectItem value="429">429 Rate Limited</SelectItem>
            <SelectItem value="500">500 Server Error</SelectItem>
            <SelectItem value="502">502 Bad Gateway</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Model</TableHead>
                <TableHead>Protocol</TableHead>
                <TableHead>Route</TableHead>
                <TableHead>Key</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Latency</TableHead>
                <TableHead>Tokens</TableHead>
                <TableHead>Error</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.logs.map((log: any) => (
                <TableRow key={log.id}>
                  <TableCell className="whitespace-nowrap">{new Date(log.timestamp).toLocaleString()}</TableCell>
                  <TableCell className="max-w-[150px] truncate">{log.modelSlug}</TableCell>
                  <TableCell><Badge variant="outline">{log.inboundProtocol}</Badge></TableCell>
                  <TableCell><Badge variant={log.routeMode === "native_passthrough" ? "success" : "warning"}>{log.routeMode === "native_passthrough" ? "native" : "translated"}</Badge></TableCell>
                  <TableCell>{log.providerKeyLabel}</TableCell>
                  <TableCell>
                    <Badge variant={(log.statusCode || 0) >= 400 ? "destructive" : "success"}>{log.statusCode}</Badge>
                  </TableCell>
                  <TableCell>{log.latencyMs}ms</TableCell>
                  <TableCell>{log.inputTokens ? `${log.inputTokens}/${log.outputTokens}` : "-"}</TableCell>
                  <TableCell className="max-w-[200px] truncate text-red-600">{log.errorSummary}</TableCell>
                </TableRow>
              ))}
              {data.logs.length === 0 && (
                <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground">No logs found</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{data.total} total logs</p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="text-sm">Page {page} of {totalPages || 1}</span>
          <Button variant="outline" size="icon" disabled={page >= totalPages} onClick={() => setPage(page + 1)}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>
    </div>
  );
}
