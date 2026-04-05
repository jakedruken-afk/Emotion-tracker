import { useToastContext } from "../components/ToastProvider";

export function useToast() {
  const { pushToast } = useToastContext();

  return {
    toast: pushToast,
  };
}
