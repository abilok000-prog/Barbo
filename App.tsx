import { Routes, Route, useLocation } from "react-router";
import { useAuth } from "@/hooks/useAuth";
import { BottomNav } from "@/components/BottomNav";
import { Toaster } from "@/components/ui/sonner";

// Pages
import Home from "@/pages/Home";
import Explore from "@/pages/Explore";
import Bookings from "@/pages/Bookings";
import Profile from "@/pages/Profile";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import BarberDetail from "@/pages/BarberDetail";
import BookingConfirmation from "@/pages/BookingConfirmation";
import Subscription from "@/pages/Subscription";
import Notifications from "@/pages/Notifications";
import AdminDashboard from "@/pages/AdminDashboard";
import NotFound from "@/pages/NotFound";

const publicRoutes = ["/login", "/register"];

function AppLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const showNav = !publicRoutes.includes(location.pathname);

  return (
    <div className="h-screen w-full bg-[#F9F8F6] flex justify-center">
      <div className="w-full max-w-[430px] h-full bg-[#F9F8F6] relative flex flex-col overflow-hidden">
        <main className="flex-1 overflow-y-auto scrollbar-hide">
          {children}
        </main>
        {showNav && <BottomNav />}
      </div>
      <Toaster position="top-center" />
    </div>
  );
}

function App() {
  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/explore" element={<Explore />} />
        <Route path="/bookings" element={<Bookings />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/barber/:id" element={<BarberDetail />} />
        <Route path="/booking/:barberId" element={<BookingConfirmation />} />
        <Route path="/subscription" element={<Subscription />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AppLayout>
  );
}

export default App;
