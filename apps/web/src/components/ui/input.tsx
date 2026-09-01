import { forwardRef, type InputHTMLAttributes } from "react";

import { cn } from "../../lib/utils";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "h-11 w-full rounded-lg border border-[#758173]/45 bg-[#FEF5EF] px-3 text-sm text-[#191102] outline-none transition placeholder:text-[#758173] focus:border-[#912F56] focus:ring-2 focus:ring-[#912F56]/15 disabled:cursor-not-allowed disabled:bg-[#758173]/15",
        className,
      )}
      {...props}
    />
  ),
);

Input.displayName = "Input";
