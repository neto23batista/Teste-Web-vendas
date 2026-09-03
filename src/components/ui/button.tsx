import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-normal text-center font-semibold transition-colors duration-200 disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring [&_svg]:size-[1.15em] [&_svg]:shrink-0 select-none",
  {
    variants: {
      variant: {
        primary:
          "bg-brand-600 text-white shadow-[var(--shadow-soft)] hover:bg-brand-700 active:bg-brand-800",
        solid:
          "bg-primary text-primary-foreground shadow-[var(--shadow-soft)] hover:brightness-110",
        soft: "bg-brand-50 text-brand-700 hover:bg-brand-100 dark:bg-brand-600/15 dark:text-brand-300 dark:hover:bg-brand-600/25",
        outline:
          "border border-border bg-card text-foreground hover:border-brand-300 hover:bg-muted",
        ghost: "text-foreground hover:bg-muted",
        danger: "border-2 border-destructive bg-destructive text-destructive-foreground hover:brightness-110",
        success: "bg-success-solid text-white hover:brightness-110",
      },
      size: {
        sm: "min-h-11 px-3.5 text-sm rounded-xl",
        md: "min-h-11 px-5 py-2 text-sm rounded-xl",
        lg: "min-h-13 px-7 py-3 text-base rounded-2xl",
        icon: "h-11 w-11 rounded-xl",
        "icon-sm": "h-11 w-11 rounded-lg",
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
