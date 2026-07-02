export default function DashboardLoading() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-5" role="status" aria-label="Carregando">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <div className="h-7 w-48 bg-gray-200 rounded animate-pulse" />
          <div className="h-4 w-64 bg-gray-100 rounded animate-pulse" />
        </div>
        <div className="h-9 w-32 bg-gray-200 rounded animate-pulse" />
      </div>

      {/* Cards grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border p-4 space-y-2">
            <div className="h-4 w-20 bg-gray-100 rounded animate-pulse" />
            <div className="h-8 w-16 bg-gray-200 rounded animate-pulse" />
            <div className="h-3 w-24 bg-gray-100 rounded animate-pulse" />
          </div>
        ))}
      </div>

      {/* Content blocks */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 rounded-xl border p-5 space-y-3">
          <div className="h-5 w-40 bg-gray-200 rounded animate-pulse" />
          <div className="h-16 w-full bg-gray-100 rounded animate-pulse" />
          <div className="h-16 w-full bg-gray-100 rounded animate-pulse" />
        </div>
        <div className="lg:col-span-2 rounded-xl border p-5 space-y-3">
          <div className="h-5 w-32 bg-gray-200 rounded animate-pulse" />
          <div className="h-10 w-full bg-gray-100 rounded animate-pulse" />
          <div className="h-10 w-full bg-gray-100 rounded animate-pulse" />
        </div>
      </div>

      <span className="sr-only">Carregando conteúdo do painel…</span>
    </div>
  );
}
