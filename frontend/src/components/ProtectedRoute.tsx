import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";

const BASE_URL = "http://localhost:5000";

interface ProtectedRouteProps {
    children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
    const navigate = useNavigate();
    const location = useLocation();
    const [isAuthChecked, setIsAuthChecked] = useState<boolean>(false);

    useEffect(() => {
        ;(async () => {
            try {
                const response = await fetch(`${BASE_URL}/user`, {
                    method: "GET",
                    credentials: "include",
                });
                if (!response.ok) {
                    navigate("/");
                    return;
                }

                const user = await response.json();

                // If user must change password, redirect to /change-password
                // (unless they're already on that page)
                if (user.must_change_password && location.pathname !== "/change-password") {
                    navigate("/change-password");
                    return;
                }

                setIsAuthChecked(true);
            } catch (error) {
                console.error("Error checking authentication:", error);
                navigate("/");
            }
        })();
    }, [navigate, location.pathname]);

    return isAuthChecked ? <>{children}</> : null;
}