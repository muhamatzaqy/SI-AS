'use client'
import * as ToastPrimitives from '@radix-ui/react-toast'
import { X } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

export function Toaster() {
  const { toasts } = useToast()
  return (
    <ToastPrimitives.Provider>
      {toasts.map(({ id, title, description, variant }) => (
        <ToastPrimitives.Root key={id} className={cn(
          'group pointer-events-auto relative flex w-full items-center justify-between space-x-2 overflow-hidden rounded-md border p-4 pr-6 shadow-lg',
          variant === 'destructive' && 'border-destructive bg-destructive text-destructive-foreground',
          variant === 'success' && 'border-green-200 bg-green-50 text-green-900',
          variant === 'default' && 'border bg-background text-foreground'
        )}>
          <div className="grid gap-1">
            {title && <ToastPrimitives.Title className="text-sm font-semibold">{title}</ToastPrimitives.Title>}
            {description && <ToastPrimitives.Description className="text-sm opacity-90">{description}</ToastPrimitives.Description>}
          </div>
          <ToastPrimitives.Close className="absolute right-1 top-1 rounded-md p-1 opacity-70 hover:opacity-100">
            <X className="h-4 w-4" />
          </ToastPrimitives.Close>
        </ToastPrimitives.Root>
      ))}
      <ToastPrimitives.Viewport className="fixed top-0 z-[100] flex max-h-screen w-full flex-col-reverse p-4 sm:bottom-0 sm:right-0 sm:top-auto sm:flex-col md:max-w-[420px]" />
    </ToastPrimitives.Provider>
  )
}
