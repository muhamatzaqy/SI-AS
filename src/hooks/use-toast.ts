'use client'
import { useState, useCallback } from 'react'

export type ToastVariant = 'default' | 'destructive' | 'success'
export interface ToastMessage { id: string; title: string; description?: string; variant?: ToastVariant }

export function useToast() {
  const [toasts, setToasts] = useState<ToastMessage[]>([])
  const toast = useCallback(({ title, description, variant = 'default' }: Omit<ToastMessage, 'id'>) => {
    const id = Math.random().toString(36).slice(2)
    setToasts(prev => [...prev, { id, title, description, variant }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000)
  }, [])
  const dismiss = useCallback((id: string) => setToasts(prev => prev.filter(t => t.id !== id)), [])
  return { toasts, toast, dismiss }
}
