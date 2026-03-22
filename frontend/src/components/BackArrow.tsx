import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import Button from './Button'
import { getAssignmentDetails } from '../util/api'
import './BackArrow.css'

interface Props {
  to?: string
  fallbackTo?: string
  className?: string
  forceBrowserBack?: boolean
}

const assignmentToCourseHomeCache = new Map<number, string>()

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const extractCourseId = (details: unknown) => {
  if (!isRecord(details)) return null
  const courseRecord = isRecord(details.course) ? details.course : null
  const courseId = Number(details.courseID ?? details.course_id ?? courseRecord?.id)
  return Number.isFinite(courseId) ? courseId : null
}

function parseAssignmentId(pathname: string): number | null {
  // Supports:
  // - /assignment/:id
  // - /assignment/:id/details
  // - /assignment/:id/review/:reviewId
  // - /assignments/:id
  const parts = pathname.split('/').filter(Boolean)
  const assignmentIdx = parts.findIndex((p) => p === 'assignment' || p === 'assignments')
  if (assignmentIdx < 0) return null
  const raw = parts[assignmentIdx + 1]
  const id = Number(raw)
  return Number.isFinite(id) ? id : null
}

export default function BackArrow(props: Props) {
  const navigate = useNavigate()
  const location = useLocation()

  const pathname = location.pathname
  const assignmentId = useMemo(() => parseAssignmentId(pathname), [pathname])
  const [resolving, setResolving] = useState(false)

  const computedTarget = useMemo(() => {
    if (props.to) return props.to

    if (pathname === '/' || pathname === '/login' || pathname === '/register' || pathname === '/home') {
      return props.fallbackTo || '/home'
    }

    // Create-class page should go back to the classes list
    if (pathname === '/classes/create') {
      return '/home'
    }

    // Class-scoped pages
    if (pathname.startsWith('/classes/')) {
      const parts = pathname.split('/').filter(Boolean)
      const classId = parts[1]
      // Create-assignment is a drill-in under a class; go back to that class home
      if (parts[2] === 'create-assignment' && classId) {
        return `/classes/${classId}/home`
      }

      // Any other class tab/page: go up to the classes list
      return '/home'
    }

    // Assignment-scoped pages: resolve to the parent class home (assignment list)
    if (assignmentId !== null) {
      return assignmentToCourseHomeCache.get(assignmentId) || null
    }

    return props.fallbackTo || '/home'
  }, [assignmentId, pathname, props.fallbackTo, props.to])

  useEffect(() => {
    if (props.to) return
    if (assignmentId === null) return
    if (assignmentToCourseHomeCache.has(assignmentId)) return

    let cancelled = false
    ;(async () => {
      try {
        const details = await getAssignmentDetails(assignmentId)
        if (cancelled) return
        const courseId = extractCourseId(details)
        if (courseId == null) return
        assignmentToCourseHomeCache.set(assignmentId, `/classes/${courseId}/home`)
      } catch {
        // ignore; we'll fall back on click
      }
    })()

    return () => {
      cancelled = true
    }
  }, [assignmentId, props.to])

  const goBack = async () => {
    if (props.forceBrowserBack) {
      navigate(-1)
      return
    }

    if (computedTarget) {
      navigate(computedTarget)
      return
    }

    // Assignment route without cached course id: resolve it now.
    if (assignmentId !== null) {
      try {
        setResolving(true)
        const details = await getAssignmentDetails(assignmentId)
        const courseId = extractCourseId(details)
        if (courseId != null) {
          const target = `/classes/${courseId}/home`
          assignmentToCourseHomeCache.set(assignmentId, target)
          navigate(target)
          return
        }
      } catch {
        // fall through
      } finally {
        setResolving(false)
      }
    }

    navigate(props.fallbackTo || '/home')
  }

  const extraClass = props.className ? ` ${props.className}` : ''

  return (
    <div className={'BackArrow' + extraClass}>
      <Button type="secondary" className="BackArrowButton" onClick={() => void goBack()} disabled={resolving}>
        ← Back
      </Button>
    </div>
  )
}
