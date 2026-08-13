import { useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";
import { LearnerLayout } from "@/components/learner-layout";
import { Button } from "@/components/ui/button";
import { fetchMyCertificate, certificatePdfUrl } from "@/lib/lmsApi";

export default function LearnerCertificatePage() {
  const { id: courseId } = useParams<{ id: string }>();
  const { data: certificate, isLoading } = useQuery({
    queryKey: ["/api/my/courses", courseId, "certificate"],
    queryFn: () => fetchMyCertificate(courseId),
    enabled: !!courseId,
  });

  return (
    <LearnerLayout title="修了証" backHref={`/learn/courses/${courseId}`} backLabel="コースへ戻る">
      {isLoading ? null : !certificate ? (
        <p className="text-sm text-muted-foreground">このコースはまだ完了していません。</p>
      ) : (
        <div className="flex flex-col items-center gap-4">
          <div className="w-full max-w-2xl aspect-[1.42/1] border-2 border-[#E8722C] rounded-md p-2">
            <iframe
              src={certificatePdfUrl(certificate.id)}
              title="修了証"
              className="w-full h-full border-0 rounded"
              data-testid="iframe-certificate-preview"
            />
          </div>
          <a href={certificatePdfUrl(certificate.id)} download target="_blank" rel="noreferrer">
            <Button className="bg-gradient-to-r from-[#FF8C42] to-[#FFA566] text-white" data-testid="button-download-certificate">
              PDFをダウンロード
            </Button>
          </a>
          <p className="text-xs text-muted-foreground">証明番号: {certificate.certificateNumber}</p>
        </div>
      )}
    </LearnerLayout>
  );
}
