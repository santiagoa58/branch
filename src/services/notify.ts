import { sileo } from "sileo";

export type NotifyType = "success" | "error" | "warning" | "info";

export interface NotifyOptions {
  title: string;
  message?: string;
  duration?: number | null;
  /** One action shown in the toast, for example Undo. */
  button?: { title: string; onClick: () => void };
}

const METHOD_MAP: Record<NotifyType, typeof sileo.success> = {
  success: sileo.success,
  error: sileo.error,
  warning: sileo.warning,
  info: sileo.info,
};

const show = (type: NotifyType, options: NotifyOptions): string => {
  const fn = METHOD_MAP[type];
  return fn({
    title: options.title,
    ...(options.message === undefined ? {} : { description: options.message }),
    ...(options.duration === undefined ? {} : { duration: options.duration }),
    ...(options.button === undefined ? {} : { button: options.button }),
  });
};

export const notify = {
  show,
  success: (options: NotifyOptions) => show("success", options),
  error: (options: NotifyOptions) => show("error", options),
  warning: (options: NotifyOptions) => show("warning", options),
  info: (options: NotifyOptions) => show("info", options),
};
