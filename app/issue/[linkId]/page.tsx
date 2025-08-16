import { CertificateIssueFlow } from "./certificate-issue-flow"

export default function IssuePage({ params }: { params: { linkId: string } }) {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-2xl">
        <CertificateIssueFlow linkId={params.linkId} />
      </div>
    </div>
  )
}
