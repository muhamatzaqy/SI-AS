import { cn } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { type LucideIcon } from 'lucide-react'

interface StatCardProps {
  title: string
  value: string | number
  description?: string
  icon?: LucideIcon
  className?: string
  iconClassName?: string
}

export function StatCard({ title, value, description, icon: Icon, className, iconClassName }: StatCardProps) {
  return (
    <Card className={cn('hover-lift group transition-all duration-300 border border-border/60', className)}>
      <CardContent className="p-3 sm:p-5">
        <div className="flex items-start justify-between gap-2 sm:gap-3">
          <div className="space-y-0.5 sm:space-y-1 min-w-0">
            <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-muted-foreground leading-tight">{title}</p>
            <p className="text-xl sm:text-3xl font-bold text-foreground truncate">{value}</p>
            {description && <p className="text-[10px] sm:text-xs text-muted-foreground">{description}</p>}
          </div>
          {Icon && (
            <div className={cn(
              'flex h-9 w-9 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-xl sm:rounded-2xl transition-transform duration-300 group-hover:scale-110',
              'bg-primary/10',
              iconClassName
            )}>
              <Icon className="h-4 w-4 sm:h-6 sm:w-6 text-primary" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
