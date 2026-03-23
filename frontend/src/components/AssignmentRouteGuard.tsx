import { ReactNode, useEffect, useState } from "react"
import { Navigate, useParams } from "react-router-dom"

import { isAdmin, isTeacher } from "../util/login"
import { getAssignmentDetails } from "../util/api"

type AssignmentRouteGuardProps = {
  children: ReactNode
  paramName?: "id" | "assignmentId"
  requireTeacherOrAdmin?: boolean
}

export default function AssignmentRouteGuard({
  children,
  paramName = "id",
  requireTeacherOrAdmin = false,
}: AssignmentRouteGuardProps) {
  const params = useParams()
  const assignmentParam = params[paramName]

  const [isLoading, setIsLoading] = useState(true)
  const [hasAccess, setHasAccess] = useState(false)

  useEffect(() => {
    let cancelled = false

    const validate = async () => {
      if (!assignmentParam || Number.isNaN(Number(assignmentParam))) {
        if (!cancelled) {
          setHasAccess(false)
          setIsLoading(false)
        }
        return
      }

      if (requireTeacherOrAdmin && !(isTeacher() || isAdmin())) {
        if (!cancelled) {
          setHasAccess(false)
          setIsLoading(false)
        }
        return
      }

      try {
        await getAssignmentDetails(Number(assignmentParam))
        if (!cancelled) setHasAccess(true)
      } catch {
        if (!cancelled) setHasAccess(false)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void validate()

    return () => {
      cancelled = true
    }
  }, [assignmentParam, requireTeacherOrAdmin])

  if (isLoading) {
    return <div className="Page">Loading assignment...</div>
  }

  if (!hasAccess) {
    return <Navigate to="/home" replace />
  }

  return <>{children}</>
}
