import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { fetchLmsSettings, updateLmsSettings } from "@/lib/lmsApi";

export default function AdminLmsSettingsPage() {
  const { toast } = useToast();
  const { data: settings } = useQuery({ queryKey: ["/api/admin/settings"], queryFn: fetchLmsSettings });
  const [companyName, setCompanyName] = useState("");
  const [issuerName, setIssuerName] = useState("");

  useEffect(() => {
    if (settings) {
      setCompanyName(settings.companyName);
      setIssuerName(settings.issuerName);
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: updateLmsSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settings"] });
      toast({ title: "設定を保存しました" });
    },
  });

  return (
    <AdminLayout title="設定">
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle className="text-base">修了証の発行元情報</CardTitle>
          <CardDescription>
            ここで設定した内容は、これ以降に発行される修了証にのみ反映されます。発行済みの修了証は変わりません。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>会社名</Label>
            <Input
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              data-testid="input-setting-company"
            />
          </div>
          <div className="space-y-2">
            <Label>発行者名(役職＋氏名)</Label>
            <Input
              value={issuerName}
              onChange={(e) => setIssuerName(e.target.value)}
              placeholder="例: 代表取締役 山田太郎"
              data-testid="input-setting-issuer"
            />
          </div>
          <Button
            className="bg-gradient-to-r from-[#FF8C42] to-[#FFA566] text-white"
            onClick={() => saveMutation.mutate({ companyName, issuerName })}
            disabled={saveMutation.isPending}
            data-testid="button-save-settings"
          >
            保存
          </Button>
        </CardContent>
      </Card>
    </AdminLayout>
  );
}
