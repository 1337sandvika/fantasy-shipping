import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes } from "react";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 rounded-md text-sm font-medium tracking-[0.01em] transition-[transform,box-shadow,background-color,border-color,color,filter] duration-200 ease-out focus:outline-2 focus:outline-offset-2 focus:outline-accent disabled:pointer-events-none disabled:opacity-50 active:translate-y-px",
  {
    variants: {
      variant: {
        default:
          "bg-accent text-accent-fg shadow-[inset_0_1px_0_rgb(255_255_255/0.22),0_10px_22px_rgb(214_106_44/0.22)] hover:brightness-110",
        secondary:
          "border border-border bg-bg-elevated/85 text-fg shadow-[inset_0_1px_0_rgb(255_255_255/0.05)] hover:border-brass/45 hover:bg-surface",
        ghost: "text-muted hover:text-fg hover:bg-surface/80",
      },
      size: {
        default: "min-h-11 px-4",
        sm: "min-h-9 px-3 text-xs",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export function Button({
  className,
  variant,
  size,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>) {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}

export { buttonVariants };
