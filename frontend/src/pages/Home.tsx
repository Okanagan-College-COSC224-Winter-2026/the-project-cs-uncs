import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import ClassCard from "../components/ClassCard";
import StatusMessage from "../components/StatusMessage";

import './Home.css'
import { listAssignments } from "../util/api_client/assignments";
import { listClasses, searchClasses } from "../util/api_client/classes";
import { isTeacher, isAdmin } from "../util/login";

export default function Home() {
  const navigate = useNavigate();
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const classesSectionRef = useRef<HTMLDivElement | null>(null);
  const [courses, setCourses] = useState<CourseWithAssignments[]>([]);
  const [allCourses, setAllCourses] = useState<CourseWithAssignments[] | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string>("");

  const adminMode = isAdmin();
  const totalAssignments = courses.reduce((sum, course) => sum + Number(course.assignmentCount || 0), 0);

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
        <h1>{adminMode ? "Admin Dashboard" : "Peer Review Dashboard"}</h1>
        <p className="PageStatusText">Loading…</p>
      </div>
    );
  }

  return (
    <div className="Home Page">
      <h1>{adminMode ? "Admin Dashboard" : "Peer Review Dashboard"}</h1>

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

              return (
                <ClassCard
                  key={course.id}
                  image="https://crc.losrios.edu//shared/img/social-1200-630/programs/general-science-social.jpg"
                  name={course.name}
                  subtitle={assignmentText}
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