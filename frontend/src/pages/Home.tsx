import { useEffect, useState } from "react";
import ClassCard from "../components/ClassCard";
import StatusMessage from "../components/StatusMessage";

import './Home.css'
import { listClasses, listAssignments, searchClasses } from "../util/api";
import { isTeacher, isAdmin } from "../util/login";

export default function Home() {
  const [courses, setCourses] = useState<CourseWithAssignments[]>([]);
  const [allCourses, setAllCourses] = useState<CourseWithAssignments[] | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string>("");

  useEffect(() => {
    ;(async () => {
      try {
        setErrorMessage("");
        const coursesResp = await listClasses();
        
        // Fetch assignments for each course
        const coursesWithAssignments = await Promise.all(
          coursesResp.map(async (course: Course) => {
            try {
              const assignments = await listAssignments(String(course.id));
              return {
                ...course,
                assignments: assignments || [],
                assignmentCount: assignments?.length || 0
              };
            } catch (error) {
              console.error(`Error fetching assignments for course ${course.id}:`, error);
              return {
                ...course,
                assignments: [],
                assignmentCount: 0
              };
            }
          })
        );
        
        setCourses(coursesWithAssignments);
        setAllCourses(coursesWithAssignments);
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
        const coursesWithAssignments = await Promise.all(
          coursesResp.map(async (course: Course) => {
            try {
              const assignments = await listAssignments(String(course.id));
              return {
                ...course,
                assignments: assignments || [],
                assignmentCount: assignments?.length || 0,
              };
            } catch {
              return {
                ...course,
                assignments: [],
                assignmentCount: 0,
              };
            }
          })
        );
        setCourses(coursesWithAssignments);
        setAllCourses(coursesWithAssignments);
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
      let allowedIds: Set<number>;
      if (allCourses) {
        allowedIds = new Set(allCourses.map((c) => Number(c.id)));
      } else {
        const allowedCourses = await listClasses();
        allowedIds = new Set(allowedCourses.map((c: Course) => Number(c.id)));
      }

      const visibleResults = results.filter((r: { id: number }) => allowedIds.has(Number(r.id)));

      const cachedById = new Map((allCourses || []).map((c) => [Number(c.id), c]));

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

          // Fallback for cases where the initial course cache is unavailable.
          try {
            const assignments = await listAssignments(String(r.id));
            return {
              id: r.id,
              name: r.name,
              assignments: assignments || [],
              assignmentCount: assignments?.length || 0,
            };
          } catch {
            return {
              id: r.id,
              name: r.name,
              assignments: [],
              assignmentCount: 0,
            };
          }
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
        <h1>Peer Review Dashboard</h1>
        <p className="PageStatusText">Loading…</p>
      </div>
    );
  }

  return (
    <div className="Home Page">
      <h1>Peer Review Dashboard</h1>

      <StatusMessage message={errorMessage} type="error" />

      <div className="Search">
        <input
          type="text"
          className="SearchInput"
          placeholder="Search for Courses"
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
        />
      </div>

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

              return (
                <ClassCard
                  key={course.id}
                  image="https://crc.losrios.edu//shared/img/social-1200-630/programs/general-science-social.jpg"
                  name={course.name}
                  subtitle={assignmentText}
                  onclick={() => {
                    window.location.href = `/classes/${course.id}/home`;
                  }}
                />
              );
            })
          )
        }

        {isTeacher() && <div className="ClassCreateButton" onClick={() => window.location.href = '/classes/create'}>
          <h2>Create Class</h2>
        </div>}
        
        {isAdmin() && <div className="ClassCreateButton" onClick={() => window.location.href = '/admin/users'}>
          <h2>Manage Users</h2>
        </div>}
      </div>
    </div>
  )
}