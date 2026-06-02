import { cn } from "@/lib/utils";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Upload,
  Clock,
  Scan,
} from "lucide-react";
import type { UploadStatus } from "@/hooks/use-file-upload";

interface DocumentStatusBadgeProps {
  status: UploadStatus;
  progress?: number;
  className?: string;
}

const STATUS_CONFIG: Record<
  UploadStatus,
  {
    label: string;
    icon: React.ElementType;
    color: string;
    animate?: boolean;
  }
> = {
  idle: {
    label: "Pending",
    icon: Clock,
    color: "text-slate-500",
  },
  "requesting-url": {
    label: "Preparing...",
    icon: Loader2,
    color: "text-blue-500",
    animate: true,
  },
  uploading: {
    label: "Uploading",
    icon: Upload,
    color: "text-blue-600",
    animate: true,
  },
  confirming: {
    label: "Confirming...",
    icon: Loader2,
    color: "text-blue-500",
    animate: true,
  },
  processing: {
    label: "Processing",
    icon: Scan,
    color: "text-violet-600",
    animate: true,
  },
  ready: {
    label: "Ready",
    icon: CheckCircle2,
    color: "text-emerald-600",
  },
  failed: {
    label: "Failed",
    icon: XCircle,
    color: "text-red-600",
  },
};

export function DocumentStatusBadge({
  status,
  progress,
  className,
}: DocumentStatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-medium",
        config.color,
        className
      )}
    >
      <Icon
        className={cn("h-3.5 w-3.5", config.animate && "animate-spin")}
      />
      {config.label}
      {status === "uploading" && progress != null && ` ${progress}%`}
    </span>
  );
}
