import { NavLink } from "react-router-dom";
import {
  Building2,
  LayoutDashboard,
  ListOrdered,
  MessageSquareText,
  Shield,
  Table2,
  FolderOpen,
  Bot,
} from "lucide-react";
import { cn } from "@/lib/utils";

const links = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/admin/finanziarie", label: "Finanziarie", icon: Building2 },
  { to: "/admin/tabelle", label: "Tabelle", icon: Table2 },
  { to: "/admin/policy", label: "Policy", icon: Shield },
  { to: "/admin/priorita", label: "Priorità", icon: ListOrdered },
  { to: "/admin/messaggi", label: "Messaggi interni", icon: MessageSquareText },
  { to: "/admin/virtual-marco", label: "Virtual Marco", icon: Bot },
  { to: "/admin/simulazioni", label: "Simulazioni", icon: FolderOpen },
];

export function AdminNav() {
  return (
    <nav className="flex flex-col gap-1">
      {links.map((link) => (
        <NavLink
          key={link.to}
          to={link.to}
          end={link.end}
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
