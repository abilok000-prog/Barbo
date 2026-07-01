import { Link, useLocation } from "react-router";
import { Home, Search, Calendar, User } from "lucide-react";

const navItems = [
  { path: "/", label: "Главная", icon: Home },
  { path: "/explore", label: "Поиск", icon: Search },
  { path: "/bookings", label: "Записи", icon: Calendar },
  { path: "/profile", label: "Профиль", icon: User },
];

export function BottomNav() {
  const location = useLocation();

  return (
    <nav className="shrink-0 h-16 bg-white/95 backdrop-blur-sm border-t border-[#E8E4DF] z-50 px-2">
      <div className="flex items-center justify-around h-full">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center justify-center gap-0.5 w-16 h-14 rounded-xl transition-all duration-150 active:scale-95 ${
                isActive
                  ? "text-[#D97706]"
                  : "text-[#A8A29E] hover:text-[#78716C]"
              }`}
            >
              <Icon
                size={22}
                strokeWidth={isActive ? 2.5 : 1.5}
                className={isActive ? "fill-[#D97706]/20" : ""}
              />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
