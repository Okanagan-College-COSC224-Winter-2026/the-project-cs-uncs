import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { getCurrentUser } from "../util/api";

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
                const user = await getCurrentUser();

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