import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-semibold transition-all duration-200 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.97] focus-visible:outline-none [&_svg]:size-[1.15em] [&_svg]:shrink-0 select-none",
  {
    variants: {
      variant: {
        primary:
          "gradient-brand text-white shadow-[var(--shadow-glow)] hover:brightness-110 hover:-translate-y-0.5",
        solid:
          "bg-primary text-primary-foreground shadow-[var(--shadow-soft)] hover:brightness-110",
        soft: "bg-brand-50 text-brand-700 hover:bg-brand-100 dark:bg-brand-600/15 dark:text-brand-300 dark:hover:bg-brand-600/25",
        outline:
          "border border-border bg-card text-foreground hover:border-brand-300 hover:bg-muted",
        ghost: "text-foreground hover:bg-muted",
        danger: "bg-danger-500 text-white hover:brightness-110",
        success: "bg-success-500 text-white hover:brightness-110",
      },
      size: {
        sm: "h-9 px-3.5 text-sm rounded-xl",
        md: "h-11 px-5 text-sm rounded-xl",
        lg: "h-13 px-7 text-base rounded-2xl",
        icon: "h-11 w-11 rounded-xl",
        "icon-sm": "h-9 w-9 rounded-lg",
      },
      pill: { true: "rounded-full", false: "" },
    },
    defaultVariants: { variant: "solid", size: "md", pill: false },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, pill, asChild = false, type, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        // Evita submit acidental: só envia formulário quando type="submit" explícito.
        type={asChild ? type : (type ?? "button")}
        className={cn(buttonVariants({ variant, size, pill }), className)}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { buttonVariants };
