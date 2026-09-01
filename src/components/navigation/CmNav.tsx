import { NavLink } from "react-router-dom";
import {
  History,
  Home,
  MessageSquare,
  PlusCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

const links = [
  { to: "/app", label: "Home", icon: Home, end: true },
  { to: "/app/simulator", label: "Nuova simulazione", icon: PlusCircle },
  { to: "/app/chat", label: "Chat", icon: MessageSquare },
  { to: "/app/history", label: "Cronologia", icon: History },
];

type CmNavProps = {
  orientation?: "horizontal" | "vertical";
  onNavigate?: () => void;
};

export function CmNav({ orientation = "vertical", onNavigate }: CmNavProps) {
  return (
    <nav
      className={cn(
        "flex gap-1",
        orientation === "vertical" ? "flex-col" : "flex-row flex-wrap",
      )}
    >
      {links.map((link) => (
        <NavLink
          key={link.to}
          to={link.to}
          end={link.end}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )
          }
        >
          <link.icon className="h-4 w-4" />
          {link.label}
        </NavLink>
      ))}
    </nav>
  );
}
