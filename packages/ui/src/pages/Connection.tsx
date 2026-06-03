import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Connection() {
  const [models, setModels] = useState<any[]>([]);
  const [providers, setProviders] = useState<any[]>([]);
  const [selectedModel, setSelectedModel] = useState("");
  const [settings, setSettings] = useState<any>(null);

  useEffect(() => {
    api.getModels().then((m) => { setModels(m.filter((x: any) => x.enabled)); if (m.length > 0) setSelectedModel(m[0].id); });
    api.getProviders().then(setProviders);
    api.getSettings().then(setSettings);
  }, []);

  const model = models.find((m) => m.id === selectedModel);
  const provider = providers.find((p) => p.id === model?.providerId);
  const hostUrl = settings?.proxyPublicUrl || "http://localhost:15000";

  const copy = (text: string) => navigator.clipboard.writeText(text);

  const CodeBlock = ({ children, label }: { children: string; label?: string }) => (
    <div className="relative">
      {label && <p className="mb-1 text-xs font-medium text-muted-foreground">{label}</p>}
      <div className="flex items-center gap-2 rounded-md bg-muted p-3">
        <code className="flex-1 text-sm font-mono break-all">{children}</code>
        <Button variant="ghost" size="icon" onClick={() => copy(children)}><Copy className="h-4 w-4" /></Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold">Connection</h2>

      <Select value={selectedModel} onValueChange={setSelectedModel}>
        <SelectTrigger className="w-96"><SelectValue placeholder="Select a model" /></SelectTrigger>
        <SelectContent>
          {models.map((m) => <SelectItem key={m.id} value={m.id}>{m.publicSlug}</SelectItem>)}
        </SelectContent>
      </Select>

      {model && (
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Connection Details</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <CodeBlock label="Proxy Host URL">{hostUrl}</CodeBlock>
              <CodeBlock label="Model Name">{model.publicSlug}</CodeBlock>
              <CodeBlock label="Authorization">Authorization: Bearer &lt;your-proxy-api-key&gt;</CodeBlock>
            </CardContent>
          </Card>

          <Tabs defaultValue="claude-code">
            <TabsList>
              <TabsTrigger value="claude-code">Claude Code</TabsTrigger>
              <TabsTrigger value="cursor">Cursor</TabsTrigger>
              <TabsTrigger value="cline">Cline</TabsTrigger>
              <TabsTrigger value="generic">Generic</TabsTrigger>
            </TabsList>

            <TabsContent value="claude-code" className="space-y-4">
              <Card>
                <CardContent className="pt-6 space-y-4">
                  <CodeBlock label="Environment Variables">{`ANTHROPIC_BASE_URL=${hostUrl}\nANTHROPIC_MODEL=${model.publicSlug}`}</CodeBlock>
                  <CodeBlock label="Skill Markdown">{`## LLM Configuration\n- Base URL: ${hostUrl}\n- Model: ${model.publicSlug}\n- Auth: Bearer token (proxy API key)`}</CodeBlock>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="cursor" className="space-y-4">
              <Card>
                <CardContent className="pt-6 space-y-4">
                  <CodeBlock label="Environment Variables">{`OPENAI_BASE_URL=${hostUrl}/v1\nOPENAI_API_KEY=<your-proxy-api-key>\nOPENAI_MODEL=${model.publicSlug}`}</CodeBlock>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="cline" className="space-y-4">
              <Card>
                <CardContent className="pt-6 space-y-4">
                  <CodeBlock label="Settings">{`API Provider: OpenAI Compatible\nBase URL: ${hostUrl}/v1\nAPI Key: <your-proxy-api-key>\nModel ID: ${model.publicSlug}`}</CodeBlock>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="generic" className="space-y-4">
              <Card>
                <CardContent className="pt-6 space-y-4">
                  <CodeBlock label="cURL Example">{`curl ${hostUrl}/v1/chat/completions \\\n  -H "Authorization: Bearer <your-proxy-api-key>" \\\n  -H "Content-Type: application/json" \\\n  -d '{"model": "${model.publicSlug}", "messages": [{"role": "user", "content": "Hello"}]}'`}</CodeBlock>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  );
}
