'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { AlertCircle, Check, Loader2 } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface MarkAlpaButtonProps {
  jadwal_id: string
  jadwal_nama: string
  onSuccess?: () => void
}

export function MarkAlpaButton({ jadwal_id, jadwal_nama, onSuccess }: MarkAlpaButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

  const handleMarkAlpa = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/attendance/mark-alpa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jadwal_id })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to mark alpa')
      }

      toast({
        title: 'Success! ✅',
        description: `${data.alpaCreated} mahasiswa marked as ALPA, ${data.skipped} skipped (sudah hadir/izin)`,
        variant: 'success'
      })

      console.log('Mark Alpa Result:', data)
      setIsOpen(false)
      onSuccess?.()

    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to mark alpa',
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(true)}
        className="gap-2"
      >
        <AlertCircle className="h-4 w-4" />
        Mark as Alpa
      </Button>

      <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark attendance as ALPA?</AlertDialogTitle>
            <AlertDialogDescription>
              This will set all mahasiswa who didn't attend "{jadwal_nama}" as ALPA.
              <br />
              <br />
              <strong>Will be skipped:</strong>
              <ul className="mt-2 ml-4 list-disc space-y-1 text-sm">
                <li>Mahasiswa with status "Hadir"</li>
                <li>Mahasiswa with status "Izin"</li>
                <li>Mahasiswa with status "Sakit"</li>
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-3">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleMarkAlpa}
              disabled={isLoading}
              className="gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  Confirm
                </>
              )}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
