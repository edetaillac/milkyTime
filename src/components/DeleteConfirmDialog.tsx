import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Trash2 } from "lucide-react"

interface DeleteConfirmDialogProps {
  open: boolean
  submitting: boolean
  onCancel: () => void
  onConfirm: () => void
}

export function DeleteConfirmDialog({ open, submitting, onCancel, onConfirm }: DeleteConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-red-500" />
            Confirm deletion
          </DialogTitle>
          <DialogDescription>
            Are you sure you want to delete this feeding? This action is irreversible.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2 mt-4">
          <Button onClick={onCancel} variant="outline">Cancel</Button>
          <Button onClick={onConfirm} variant="destructive" disabled={submitting}>
            <Trash2 className="h-4 w-4 mr-2" />
            {submitting ? "Deleting..." : "Delete"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}


