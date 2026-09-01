import * as React from "react";
import { cn } from "@/lib/utils";

export type CheckboxProps = Omit<
  React.ComponentProps<"input">,
  "type" | "onChange"
> & {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
};

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, checked, onCheckedChange, ...props }, ref) => {
    return (
      <input
        type="checkbox"
        ref={ref}
        checked={checked}
        onChange={(event) => onCheckedChange?.(event.target.checked)}
        className={cn(
          "h-4 w-4 rounded border border-input text-primary accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          className,
        )}
        {...props}
      />
    );
  },
);
Checkbox.displayName = "Checkbox";

export { Checkbox };
