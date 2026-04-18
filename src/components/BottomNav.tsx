import { Link, useLocation, useRouterState } from "@tanstack/react-router";
import { BarChart3, Package, CakeSlice, User, Loader2, ShoppingCart } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/", label: "Dashboard", icon: BarChart3 },
  { to: "/encomendas", label: "Encomendas", emoji: "📅" },
  { to: "/estoque", label: "Estoque", icon: ShoppingCart },
  { to: "/insumos", label: "Insumos", icon: Package },
  { to: "/produtos", label: "Receitas", icon: CakeSlice },
  { to: "/perfil", label: "Perfil", icon: User },
] as const;

export function BottomNav() {
  const location = useLocation();
  const isNavigating = useRouterState({
    select: (state) => state.status === "pending",
  });

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/80 backdrop-blur-md safe-area-bottom">
      {isNavigating && (
        <div className="absolute -top-9 left-1/2 -translate-x-1/2 rounded-full border border-border bg-card px-2.5 py-1 shadow-sm">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
        </div>
      )}
      <div className="mx-auto flex max-w-lg items-center justify-around py-2 px-1">
        {navItems.map((item) => {
          const isActive = location.pathname === item.to;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "relative flex flex-1 flex-col items-center gap-1 rounded-xl py-2 text-[10px] font-medium transition-all duration-200",
                isActive
                  ? "text-primary scale-105"
                  : "text-muted-foreground hover:text-foreground active:scale-95"
              )}
            >
              {"icon" in item ? (
                <item.icon
                  className={cn("h-5 w-5 transition-transform duration-200", isActive && "fill-primary/20")}
                />
              ) : (
                <span className="text-lg leading-none">{item.emoji}</span>
              )}
              <span className="truncate w-full text-center">{item.label}</span>
              {isActive && (
                <span className="absolute -bottom-1 h-0.5 w-6 rounded-full bg-primary" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}