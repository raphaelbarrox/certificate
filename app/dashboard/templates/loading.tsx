export default function Loading() {
  return (
    <div className="space-y-6" role="status" aria-label="Carregando templates">
      <div className="space-y-2">
        <div className="h-8 bg-gray-200 rounded animate-pulse w-64"></div>
        <div className="h-4 bg-gray-200 rounded animate-pulse w-96"></div>
      </div>

      <div className="h-20 bg-gray-200 rounded animate-pulse"></div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="h-48 bg-gray-200 rounded animate-pulse"></div>
        ))}
      </div>

      <span className="sr-only">Carregando templates...</span>
    </div>
  )
}
