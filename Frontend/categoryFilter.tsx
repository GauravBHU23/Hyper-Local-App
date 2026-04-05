"use client";
import { CATEGORY_ICONS, CATEGORY_LABELS, type ServiceCategory } from "@/types";
import { cn } from "@/lib/utils";

const POPULAR: ServiceCategory[] = [
  "plumber", "electrician", "ac_repair", "carpenter",
  "cleaning", "tutor", "doctor", "mechanic",
];

interface Props {
  selected: ServiceCategory | null;
  onChange: (cat: ServiceCategory | null) => void;
  showAll?: boolean;
}

export function CategoryFilter({ selected, onChange, showAll = false }: Props) {
  const cats = showAll
    ? (Object.keys(CATEGORY_LABELS) as ServiceCategory[])
    : POPULAR;

  return (
    <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
      <button
        onClick={() => onChange(null)}
        className={cn(
          "flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all shrink-0",
          !selected
            ? "bg-orange-500 text-white shadow-sm"
            : "bg-white text-slate-600 border border-slate-200 hover:border-orange-300"
        )}
      >
        All
      </button>

      {cats.map((cat) => (
        <button
          key={cat}
          onClick={() => onChange(selected === cat ? null : cat)}
          className={cn(
            "flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all shrink-0",
            selected === cat
              ? "bg-orange-500 text-white shadow-sm"
              : "bg-white text-slate-600 border border-slate-200 hover:border-orange-300"
          )}
        >
          <span>{CATEGORY_ICONS[cat]}</span>
          {CATEGORY_LABELS[cat]}
        </button>
      ))}
    </div>
  );
}