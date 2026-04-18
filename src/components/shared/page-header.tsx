export function PageHeader({ title, description, children }: { title: string; description?: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-1 min-w-0">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-bold tracking-tight text-foreground sm:text-2xl truncate">{title}</h1>
        </div>
        {description && (
          <p className="text-xs sm:text-sm text-muted-foreground">{description}</p>
        )}
        {/* Gradient underline decoration */}
        <div className="h-0.5 w-12 rounded-full bg-gradient-to-r from-primary to-transparent" />
      </div>
      {children && (
        <div className="flex items-center gap-2 flex-wrap shrink-0">{children}</div>
      )}
    </div>
  )
}
