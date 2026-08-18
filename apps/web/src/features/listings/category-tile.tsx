import { Coins, Gift, Package, Rocket, Sparkles, UserRound } from "lucide-react";
import { Link } from "react-router-dom";

import type { Category } from "./types";

const categoryIcons = {
  accounts: UserRound,
  "game-currency": Coins,
  items: Package,
  skins: Sparkles,
  "gift-cards": Gift,
  boosting: Rocket,
};

export function CategoryTile({ category }: { category: Category }) {
  const Icon = categoryIcons[category.slug as keyof typeof categoryIcons] ?? Package;

  return (
    <Link
      className="group flex min-w-0 items-start gap-3 rounded-md border border-gray-200 bg-white p-4 transition-colors hover:border-emerald-600"
      to={`/categories/${category.slug}`}
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-md bg-emerald-50 text-emerald-800 group-hover:bg-emerald-100">
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block font-semibold text-gray-950">{category.name}</span>
        <span className="mt-1 block text-sm leading-5 text-gray-500">{category.description}</span>
      </span>
    </Link>
  );
}
