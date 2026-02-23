import { useEffect, useState } from "react";
import ClassCard from "../components/ClassCard";

import './Home.css'
import { listClasses, listAssignments } from "../util/api";
import { isTeacher, isAdmin } from "../util/login";

export default function Home() {
  const [courses, setCourses] = useState<CourseWithAssignments[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    ;(async () => {
      try {
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
      } catch (error) {
        console.error("Error fetching courses:", error);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSearch = async (q: string) => {
    setSearchQuery(q);
    if (!q || q.trim() === "") {
      // If empty query, reload the user's classes without toggling global loading
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
      } catch (e) {
        console.error(e);
      }
      return;
    }
    try {
      const resp = await (await import("../util/api")).searchClasses(q);
      const results = resp.results || [];
      // Map to CourseWithAssignments shape (no assignments fetched here)
      const mapped = results.map((r: { id: number; name: string }) => ({ id: r.id, name: r.name, assignments: [], assignmentCount: 0 }));
      setCourses(mapped);
    } catch (error) {
      console.error("Search error:", error);
      setCourses([]);
    }
  }

  if (loading) {
    return (
      <div className="Home">
        <h1>Peer Review Dashboard</h1>
        <p>Loading courses...</p>
      </div>
    );
  }

  return (
    <div className="Home">
      <h1>Peer Review Dashboard</h1>

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
        
        {isAdmin() && <div className="ClassCreateButton" onClick={() => window.location.href = '/admin/create-teacher'}>
          <h2>Create Teacher</h2>
        </div>}
      </div>
    </div>
  )
}