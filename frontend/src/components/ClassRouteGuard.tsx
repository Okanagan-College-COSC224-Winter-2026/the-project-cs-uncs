import { ReactNode, useEffect, useState } from "react"
import { Navigate, useParams } from "react-router-dom"

import { isAdmin, isTeacher } from "../util/login"
import { listClasses } from "../util/api"

type ClassRouteGuardProps = {
  children: ReactNode
  requireTeacherOrAdmin?: boolean
}

export default function ClassRouteGuard({
  children,
  requireTeacherOrAdmin = false,
}: ClassRouteGuardProps) {
  const { id } = useParams()
  const [isLoading, setIsLoading] = useState(true)
  const [hasAccess, setHasAccess] = useState(false)
  const [hasRoleAccess, setHasRoleAccess] = useState(true)

  useEffect(() => {
    let cancelled = false

    const validate = async () => {
      if (!id || Number.isNaN(Number(id))) {
        if (!cancelled) {
          setHasAccess(false)
          setIsLoading(false)
        }
        return
      }

      if (requireTeacherOrAdmin && !(isTeacher() || isAdmin())) {
        if (!cancelled) {
          setHasRoleAccess(false)
          setHasAccess(false)
          setIsLoading(false)
        }
        return
      }

      try {
        const classes = await listClasses()
        if (cancelled) return

        const existsForUser = classes.some((course: { id: number }) => course.id === Number(id))
        setHasAccess(existsForUser)
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
  }, [id, requireTeacherOrAdmin])

  if (isLoading) {
    return <div className="Page">Loading class...</div>
  }

  if (!hasRoleAccess) {
    return <Navigate to="/home" replace />
  }

  if (!hasAccess) {
    return <Navigate to="/home" replace />
  }

  return <>{children}</>
}
