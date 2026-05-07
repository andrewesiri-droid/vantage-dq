import { toast } from 'sonner';

export function toastSuccess(msg: string) {
  toast.success(msg, { duration: 2000 });
}

export function toastError(msg: string) {
  toast.error(msg, { duration: 4000 });
}

export function toastAIError() {
  toast.error('AI request failed — please try again', { duration: 3000 });
}

export function toastSaved() {
  toast.success('Saved', { duration: 1500 });
}
