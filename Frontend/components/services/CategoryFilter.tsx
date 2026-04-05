"use client";

import { cn } from "@/lib/utils";
import { CATEGORY_LABELS, type ServiceCategory } from "@/types";

const POPULAR: ServiceCategory[] = [
  "plumber",
  "electrician",
  "ac_repair",
  "carpenter",
  "cleaning",
  "tutor",
  "doctor",
  "mechanic",
];

interface Props {
  selected: ServiceCategory | null;
  onChange: (category: ServiceCategory | null) => void;
  showAll?: boolean;
}

export function CategoryFilter({ selected, onChange, showAll = false }: Props) {
  const categories = showAll
    ? (Object.keys(CATEGORY_LABELS) as ServiceCategory[])
    : POPULAR;

  return (
    <div className="scrollbar-hide flex gap-2 overflow-x-auto pb-1 md:flex-wrap md:overflow-visible">
      <button
        onClick={() => onChange(null)}
        className={cn(
          "shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-all",
          !selected
            ? "bg-orange-500 text-white shadow-sm"
            : "border border-slate-200 bg-white text-slate-600 hover:border-orange-300"
        )}
      >
        All
      </button>

      {categories.map((category) => (
        <button
          key={category}
          onClick={() => onChange(selected === category ? null : category)}
          className={cn(
            "flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-all",
            selected === category
              ? "bg-orange-500 text-white shadow-sm"
              : "border border-slate-200 bg-white text-slate-600 hover:border-orange-300"
          )}
        >
          {CATEGORY_LABELS[category]}
        </button>
      ))}
    </div>
  );
}
