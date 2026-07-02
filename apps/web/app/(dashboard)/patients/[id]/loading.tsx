export default function PatientLoading() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-5" role="status" aria-label="Carregando paciente">
      {/* Cabeçalho do paciente */}
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-gray-200 animate-pulse flex-shrink-0" />
        <div className="space-y-2 flex-1">
          <div className="h-6 w-56 bg-gray-200 rounded animate-pulse" />
          <div className="h-4 w-40 bg-gray-100 rounded animate-pulse" />
        </div>
      </div>

      {/* Abas */}
      <div className="flex gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-8 w-24 bg-gray-100 rounded animate-pulse" />
        ))}
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border px-4 py-3 space-y-2">
            <div className="h-7 w-12 bg-gray-200 rounded animate-pulse" />
            <div className="h-3 w-20 bg-gray-100 rounded animate-pulse" />
          </div>
        ))}
      </div>

      {/* Bloco de conteúdo */}
      <div className="rounded-xl border p-5 space-y-3">
        <div className="h-5 w-44 bg-gray-200 rounded animate-pulse" />
        <div className="h-20 w-full bg-gray-100 rounded animate-pulse" />
      </div>

      <span className="sr-only">Carregando dados do paciente…</span>
    </div>
  );
}
