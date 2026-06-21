import { toast as sonnerToast } from "sonner";

export const toast = {
  loading: (message: string) => sonnerToast.loading(message),
  success: (message: string, id?: string | number) =>
    sonnerToast.success(message, { id, duration: 5000 }),
  error: (message: string, id?: string | number) =>
    sonnerToast.error(message, { id, duration: 6000 }),
  warning: (message: string, id?: string | number) =>
    sonnerToast.warning(message, { id, duration: 5500 }),
  info: (message: string, id?: string | number) =>
    sonnerToast.info(message, { id, duration: 5000 }),
};
