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
      className="group flex min-w-0 items-start gap-4 rounded-2xl border border-[#758173]/30 bg-[#FEF5EF] p-5 transition duration-200 hover:-translate-y-0.5 hover:border-[#912F56] hover:shadow-lg"
      to={`/categories/${category.slug}`}
    >
      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#912F56]/12 text-[#912F56] transition group-hover:bg-[#912F56] group-hover:text-[#FEF5EF]">
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block font-semibold text-[#191102]">{category.name}</span>
        <span className="mt-1 block text-sm leading-5 text-[#758173]">{category.description}</span>
      </span>
    </Link>
  );
}
