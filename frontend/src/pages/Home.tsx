import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import ClassCard from "../components/ClassCard";
import Button from "../components/Button";
import StatusMessage from "../components/StatusMessage";

import './Home.css'
import { deleteClass, listClasses, searchClasses } from "../util/api_client/classes";
import { isTeacher, isAdmin } from "../util/login";

export default function Home() {
  const navigate = useNavigate();
  const location = useLocation();
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const classesSectionRef = useRef<HTMLDivElement | null>(null);
  const [courses, setCourses] = useState<CourseWithAssignments[]>([]);
  const [allCourses, setAllCourses] = useState<CourseWithAssignments[] | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [statusType, setStatusType] = useState<'error' | 'success'>('success');
  const [confirmDeleteCourseId, setConfirmDeleteCourseId] = useState<number | null>(null);
  const [deletingCourseId, setDeletingCourseId] = useState<number | null>(null);

  const adminMode = isAdmin();
  const canDeleteCourses = adminMode || isTeacher();
  const dashboardTitle = adminMode
    ? "Admin Dashboard"
    : isTeacher()
      ? "Teacher Dashboard"
      : "Student Dashboard";
  const totalAssignments = courses.reduce((sum, course) => sum + Number(course.assignmentCount || 0), 0);

  const handleDeleteCourse = async (courseId: number) => {
    if (confirmDeleteCourseId !== courseId) {
      setConfirmDeleteCourseId(courseId);
      setStatusType('error');
      setStatusMessage('Click delete again to confirm.');
      return;
    }

    try {
      setDeletingCourseId(courseId);
      await deleteClass(courseId);
      setCourses((prev) => prev.filter((c) => Number(c.id) !== Number(courseId)));
      setAllCourses((prev) => (prev ? prev.filter((c) => Number(c.id) !== Number(courseId)) : prev));
      setStatusType('success');
      setStatusMessage('Class deleted successfully!');
    } catch (e) {
      console.error('Error deleting class:', e);
      setStatusType('error');
      setStatusMessage(e instanceof Error ? e.message : 'Error deleting class.');
    } finally {
      setDeletingCourseId(null);
      setConfirmDeleteCourseId(null);
    }
  };

  const handleBrowseClasses = () => {
    if (allCourses) {
      setCourses(allCourses);
    }
    setSearchQuery("");
    setErrorMessage("");
    classesSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    searchInputRef.current?.focus();
  };

  useEffect(() => {
    const state = location.state as unknown;
    if (!state || typeof state !== 'object') return;
    const record = state as Record<string, unknown>;

    const maybeMsg = record.statusMessage;
    const maybeType = record.statusType;

    if (typeof maybeMsg !== 'string' || !maybeMsg.trim()) return;
    if (maybeType !== 'success' && maybeType !== 'error') return;

    setStatusMessage(maybeMsg);
    setStatusType(maybeType);
    navigate(location.pathname, { replace: true, state: null });
  }, [location.pathname, location.state, navigate]);

  useEffect(() => {
      document.title = 'Dashboard';

    ;(async () => {
      try {
        setErrorMessage("");
        const coursesResp = await listClasses();

        const mapped = (coursesResp || []).map((course: Course) => {
          const assignmentCount = Number((course as unknown as { assignmentCount?: number }).assignmentCount || 0);
          return {
            ...course,
            assignmentCount,
          };
        });

        setCourses(mapped);
        setAllCourses(mapped);
      } catch (error) {
        console.error("Error fetching courses:", error);
        setErrorMessage(error instanceof Error ? error.message : "Failed to load courses.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSearch = async (q: string) => {
    setSearchQuery(q);
    setErrorMessage("");
    if (!q || q.trim() === "") {
      // If empty query, restore the cached full list (avoids re-fetching every course + assignments).
      if (allCourses) {
        setCourses(allCourses);
        return;
      }

      // Fallback if cache wasn't populated for some reason.
      try {
        const coursesResp = await listClasses();
        const mapped = (coursesResp || []).map((course: Course) => {
          const assignmentCount = Number((course as unknown as { assignmentCount?: number }).assignmentCount || 0);
          return {
            ...course,
            assignmentCount,
          };
        });
        setCourses(mapped);
        setAllCourses(mapped);
      } catch (e) {
        console.error(e);
        setErrorMessage(e instanceof Error ? e.message : "Failed to load courses.");
      }
      return;
    }
    try {
      const resp = await searchClasses(q);
      const results = resp.results || [];

      // Defense-in-depth: only render classes the current user is authorized to see.
      let allowedCourses: CourseWithAssignments[];
      if (allCourses) {
        allowedCourses = allCourses;
      } else {
        const fresh = await listClasses();
        allowedCourses = (fresh || []).map((course: Course) => {
          const assignmentCount = Number((course as unknown as { assignmentCount?: number }).assignmentCount || 0);
          return {
            ...course,
            assignmentCount,
          };
        });
        setAllCourses(allowedCourses);
      }

      const allowedIds = new Set(allowedCourses.map((c) => Number(c.id)));

      const visibleResults = results.filter((r: { id: number }) => allowedIds.has(Number(r.id)));

      const cachedById = new Map((allowedCourses || []).map((c) => [Number(c.id), c]));

      const mapped = await Promise.all(
        visibleResults.map(async (r: { id: number; name: string }) => {
          const cached = cachedById.get(Number(r.id));
          if (cached) {
            return {
              ...cached,
              name: r.name,
              assignmentCount: Number(cached.assignmentCount || 0),
            };
          }

          return {
            id: r.id,
            name: r.name,
            assignmentCount: 0,
          };
        })
      );
      setCourses(mapped);
    } catch (error) {
      console.error("Search error:", error);
      setErrorMessage(error instanceof Error ? error.message : "Search failed.");
      setCourses([]);
    }
  }

  if (loading) {
    return (
      <div className="Home Page">
        <h1>{dashboardTitle}</h1>
        <p className="PageStatusText">Loading…</p>
      </div>
    );
  }

  return (
    <div className="Home Page">
      <h1>{dashboardTitle}</h1>

      <StatusMessage message={statusMessage} type={statusType} />
      <StatusMessage message={errorMessage} type="error" />

      {adminMode ? (
        <div className="AdminIntro">
          <p className="AdminIntroText">
            Manage users, monitor classes, and quickly jump into course spaces.
          </p>
          <div className="AdminStats">
            <div className="AdminStatCard">
              <div className="AdminStatValue">{courses.length}</div>
              <div className="AdminStatLabel">Visible classes</div>
            </div>
            <div className="AdminStatCard">
              <div className="AdminStatValue">{totalAssignments}</div>
              <div className="AdminStatLabel">Assignments across classes</div>
            </div>
          </div>

          <div className="AdminActions">
            <button className="AdminActionCard" onClick={() => navigate('/admin/users')}>
              <h3>Manage Users</h3>
              <p>Create users, update roles, and manage account access.</p>
            </button>
            <button className="AdminActionCard" onClick={handleBrowseClasses}>
              <h3>Browse Classes</h3>
              <p>Jump to class directory and search classes you can inspect.</p>
            </button>
          </div>
        </div>
      ) : null}

      <div className="Search">
        <input
          ref={searchInputRef}
          type="text"
          className="SearchInput"
          placeholder={adminMode ? "Search classes to inspect" : "Search for Courses"}
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
        />
      </div>

      <div className="ClassesSection" ref={classesSectionRef}>
        {adminMode ? <h2 className="ClassesTitle">Class Directory</h2> : null}

      <div className="Classes">
        {
          courses.length === 0 && searchQuery.trim() !== "" ? (
            <div className="NoResults">
              <h3>{`No courses found for "${searchQuery}"`}</h3>
              <p>Try a different name or remove filters to see all courses.</p>
            </div>
          ) : (
            courses.map((course) => {
              const assignmentText = `${course.assignmentCount || 0} assignments`;
              const courseId = Number(course.id);
              const isConfirmingDelete = confirmDeleteCourseId === courseId;
              const isDeleting = deletingCourseId === courseId;

              return (
                <ClassCard
                  key={course.id}
                  image="https://crc.losrios.edu//shared/img/social-1200-630/programs/general-science-social.jpg"
                  name={course.name}
                  subtitle={assignmentText}
                  actions={
                    canDeleteCourses ? (
                      <Button
                        type="secondary"
                        disabled={isDeleting}
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleDeleteCourse(courseId);
                        }}
                      >
                        {isConfirmingDelete ? 'Confirm Delete' : 'Delete'}
                      </Button>
                    ) : null
                  }
                  onclick={() => {
                    navigate(`/classes/${course.id}/home`);
                  }}
                />
              );
            })
          )
        }

        {isTeacher() && !adminMode && <div className="ClassCreateButton" onClick={() => navigate('/classes/create')}>
          <h2>Create Class</h2>
        </div>}
      </div>
      </div>
    </div>
  )
}