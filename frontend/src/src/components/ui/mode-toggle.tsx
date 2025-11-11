import { Monitor, Moon, Sun } from "lucide-react";
import { Button } from "./button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./dropdown-menu";
import { useTheme } from "@/components/theme/theme-provider";
import { cn } from "@/lib/utils";

interface ModeToggleProps {
  className?: string;
  withLabel?: boolean;
}

const THEME_ITEMS = [
  {
    value: "light",
    label: "Light",
    description: "Bright, high contrast interface",
    icon: Sun,
  },
  {
    value: "dark",
    label: "Dark",
    description: "Low-light friendly palette",
    icon: Moon,
  },
  {
    value: "system",
    label: "Auto",
    description: "Sync with your device preference",
    icon: Monitor,
  },
] as const;

export function ModeToggle({ className, withLabel = false }: ModeToggleProps) {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const ActiveIcon = resolvedTheme === "dark" ? Moon : Sun;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "relative h-10 w-10 rounded-full bg-transparent hover:bg-accent/80 focus-visible:ring-2 focus-visible:ring-ring",
            className,
          )}
          aria-label="Toggle theme"
        >
          <Sun className="h-[1.1rem] w-[1.1rem] transition-transform duration-200 ease-in-out dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-[1.1rem] w-[1.1rem] rotate-90 scale-0 transition-transform duration-200 ease-in-out dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" sideOffset={8}>
        <DropdownMenuLabel className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
          <ActiveIcon className="h-3.5 w-3.5" />
          Display
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup value={theme} onValueChange={(value) => setTheme(value as typeof theme)}>
          {THEME_ITEMS.map(({ value, label, description, icon: Icon }) => (
            <DropdownMenuRadioItem
              key={value}
              value={value}
              className="group cursor-pointer rounded-lg px-3 py-2 text-sm transition-colors hover:bg-accent/60 focus:bg-accent focus:text-accent-foreground data-[state=checked]:bg-accent data-[state=checked]:text-accent-foreground"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-muted-foreground group-data-[state=checked]:bg-background group-data-[state=checked]:text-foreground">
                  <Icon className="h-4 w-4" />
                </span>
                <div className="flex flex-col text-left">
                  <span className="font-medium leading-none">{label}</span>
                  <span className="text-[0.7rem] text-muted-foreground group-data-[state=checked]:text-accent-foreground/80">
                    {description}
                  </span>
                </div>
              </div>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        {withLabel && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled
              className="cursor-default px-3 text-[0.7rem] uppercase tracking-[0.25em] text-muted-foreground"
            >
              Theme: {resolvedTheme}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
