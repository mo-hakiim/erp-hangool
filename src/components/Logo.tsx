import logo from "@/assets/hangool-logo.png";
import { cn } from "@/lib/format";

/**
 * Hangool logo (same file as the company website).
 * - "full": mark + HANGOOL + "Construction & Real Estate"
 * - "icon": just the mark (the left part of the same image, cropped with CSS)
 */
export function Logo({ variant = "full", className }: { variant?: "full" | "icon"; className?: string }) {
  if (variant === "icon") {
    return (
      <span className={cn("block h-9 w-[30px] overflow-hidden", className)} aria-label="Hangool" role="img">
        <img src={logo} alt="" className="h-full w-auto max-w-none" />
      </span>
    );
  }
  return <img src={logo} alt="Hangool Construction & Real Estate" className={cn("h-10 w-auto", className)} />;
}
