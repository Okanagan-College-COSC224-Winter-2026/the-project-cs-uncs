import { ReactNode } from "react"
import { Navigate } from "react-router-dom"

import { getUserRole } from "../util/login"

type RoleRouteGuardProps = {
  children: ReactNode
  allowedRoles: string[]
}

export default function RoleRouteGuard({ children, allowedRoles }: RoleRouteGuardProps) {
  const role = getUserRole()

  if (!allowedRoles.includes(role)) {
    return <Navigate to="/home" replace />
  }

  return <>{children}</>
}
