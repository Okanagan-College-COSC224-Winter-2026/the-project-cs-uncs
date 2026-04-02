import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { getCurrentUser } from "../util/api_client/users";

interface ProtectedRouteProps {
    children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
    const navigate = useNavigate();
    const location = useLocation();
    const [isAuthChecked, setIsAuthChecked] = useState<boolean>(false);

    useEffect(() => {
        let cancelled = false;

        ;(async () => {
            try {
                const user = await getCurrentUser();
                    localStorage.setItem('user', JSON.stringify(user));
                if (cancelled) return;

                // If user must change password, redirect to /change-password
                // (unless they're already on that page)
                if (user.must_change_password && location.pathname !== "/change-password") {
                    navigate("/change-password");
                    return;
                }

                setIsAuthChecked(true);
            } catch (error) {
                if (cancelled) return;
                console.error("Error checking authentication:", error);
                navigate("/login");
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [navigate, location.pathname]);

    return isAuthChecked ? (
        <>{children}</>
    ) : (
        <div className="Page">
            <p className="PageStatusText">Checking your session…</p>
        </div>
    );
}