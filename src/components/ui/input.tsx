import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => {
  return (
    <input
      ref={ref}
      className={cn(
        "h-12 w-full rounded-xl border border-border bg-card px-4 text-base sm:text-sm transition placeholder:text-muted-foreground focus:border-brand-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
});
Input.displayName = "Input";

export function Field({
  label,
  htmlFor,
  children,
  hint,
  error,
  required,
}: {
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
  hint?: string;
  error?: string;
  required?: boolean;
}) {
  const hintId = htmlFor && hint ? `${htmlFor}-hint` : undefined;
  const errorId = htmlFor && error ? `${htmlFor}-error` : undefined;
  // Clone only the labelled control; other children keep their own semantics.
  const controls = React.Children.map(children, (child) => {
    if (!React.isValidElement<React.InputHTMLAttributes<HTMLInputElement>>(child) || !htmlFor || child.props.id !== htmlFor) return child;
    return React.cloneElement(child, {
      "aria-describedby": [child.props["aria-describedby"], hintId, errorId].filter(Boolean).join(" ") || undefined,
      "aria-invalid": error ? true : child.props["aria-invalid"],
      required: required ?? child.props.required,
    });
  });
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="text-sm font-semibold">
        {label}
        {required && <span className="ml-1 font-normal text-muted-foreground">(obrigatório)</span>}
      </label>
      {controls}
      {hint && <p id={hintId} className="text-sm leading-relaxed text-muted-foreground">{hint}</p>}
      {error && <p id={errorId} role="alert" className="text-sm font-medium text-danger-500">{error}</p>}
    </div>
  );
}
