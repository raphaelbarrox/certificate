export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8">
        <div className="text-center">
          <div className="h-8 bg-gray-200 rounded animate-pulse w-32 mx-auto mb-2"></div>
          <div className="h-4 bg-gray-200 rounded animate-pulse w-48 mx-auto"></div>
        </div>

        <div className="space-y-6">
          <div className="space-y-4">
            <div className="h-4 bg-gray-200 rounded animate-pulse w-16"></div>
            <div className="h-10 bg-gray-200 rounded animate-pulse"></div>
          </div>

          <div className="space-y-4">
            <div className="h-4 bg-gray-200 rounded animate-pulse w-16"></div>
            <div className="h-10 bg-gray-200 rounded animate-pulse"></div>
          </div>

          <div className="h-10 bg-gray-200 rounded animate-pulse"></div>

          <div className="h-4 bg-gray-200 rounded animate-pulse w-48 mx-auto"></div>
        </div>
      </div>
    </div>
  )
}
