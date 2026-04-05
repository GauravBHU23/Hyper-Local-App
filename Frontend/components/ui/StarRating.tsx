"use client";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  value: number;
  onChange?: (val: number) => void;
  size?: number;
  readonly?: boolean;
}

export function StarRating({ value, onChange, size = 16, readonly = false }: Props) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readonly}
          onClick={() => onChange?.(star)}
          className={cn(
            "transition-transform",
            !readonly && "hover:scale-110 cursor-pointer",
            readonly && "cursor-default"
          )}
        >
          <Star
            size={size}
            className={cn(
              star <= value ? "text-yellow-400 fill-yellow-400" : "text-slate-300"
            )}
          />
        </button>
      ))}
    </div>
  );
}
