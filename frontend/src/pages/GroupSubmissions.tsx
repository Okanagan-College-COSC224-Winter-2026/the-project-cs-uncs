import { useEffect, useMemo, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import BackArrow from "../components/BackArrow";
import Button from "../components/Button";
import TabNavigation from "../components/TabNavigation";
import { hasRole } from "../util/login";
import {
  CourseGroup,
  listCourseGroups,
  listSubmissions,
  getAssignmentDetails,
  getSubmissionDownloadUrl,
} from "../util/api";
import "./Groups.css";

type Submission = {
  id: number;
  student: { id: number; name?: string | null; email?: string | null };
  file_name?: string | null;
};

type AssignmentDetails = {
  id: number;
  name?: string | null;
  courseID?: number;
  course?: { id: number };
};

export default function GroupSubmissions() {
  const { id } = useParams<{ id: string }>();

  const [assignmentName, setAssignmentName] = useState<string | null>(null);
  const [courseId, setCourseId] = useState<number | null>(null);

  const [groups, setGroups] = useState<CourseGroup[]>([]);
  const [submissionsByStudentId, setSubmissionsByStudentId] = useState<Record<number, Submission>>({});

  const [selectedGroup, setSelectedGroup] = useState<CourseGroup | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isTeacherOrAdmin = hasRole("teacher", "admin");

  const tabs = useMemo(() => {
    const tabsForTeacher = [
      { label: "Home", path: `/assignment/${id}` },
      { label: "Details", path: `/assignment/${id}/details` },
      { label: "Group Submissions", path: `/assignment/${id}/group-submissions` },
      { label: "Peer Reviews", path: `/assignment/${id}/teacher-reviews` },
    ];

    const tabsForStudent = [
      { label: "Home", path: `/assignment/${id}` },
      { label: "Details", path: `/assignment/${id}/details` },
      { label: "Peer Review", path: `/assignment/${id}/reviews` },
      { label: "My Feedback", path: `/assignment/${id}/feedback` },
    ];

    return isTeacherOrAdmin ? tabsForTeacher : tabsForStudent;
  }, [id, isTeacherOrAdmin]);

  if (!isTeacherOrAdmin) {
    return <Navigate to={`/assignment/${id}`} replace />;
  }

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);

      try {
        if (!id) return;

        const details = (await getAssignmentDetails(Number(id))) as AssignmentDetails;
        if (cancelled) return;

        setAssignmentName(details?.name ?? null);

        const resolvedCourseId = Number(details?.course?.id ?? details?.courseID);
        setCourseId(Number.isFinite(resolvedCourseId) ? resolvedCourseId : null);
      } catch (e: unknown) {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg || "Failed to load assignment");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!id) return;
      if (!courseId) return;

      try {
        const [groupsResp, submissionsResp] = await Promise.all([
          listCourseGroups(courseId),
          listSubmissions(Number(id)),
        ]);
        if (cancelled) return;

        setGroups(groupsResp);

        const submissions = (submissionsResp?.submissions ?? []) as Submission[];
        const map: Record<number, Submission> = {};
        for (const sub of submissions) {
          if (sub?.student?.id) map[sub.student.id] = sub;
        }
        setSubmissionsByStudentId(map);
      } catch (e: unknown) {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg || "Failed to load groups/submissions");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [courseId, id]);

  const submittedCountForGroup = (group: CourseGroup) => {
    return (group.members ?? []).reduce((count, member) => {
      return submissionsByStudentId[member.id] ? count + 1 : count;
    }, 0);
  };

  const getGroupSubmission = (group: CourseGroup): Submission | null => {
    for (const member of group.members ?? []) {
      const sub = submissionsByStudentId[member.id];
      if (sub) return sub;
    }
    return null;
  };

  return (
    <>
      <BackArrow />
      <div className="ClassHeader">
        <div className="ClassHeaderLeft">
          <h2>{assignmentName || `Assignment ${id}`}</h2>
        </div>
      </div>

      <TabNavigation tabs={tabs} />

      <div className="GroupsPage">
        {error ? <div className="GroupsError">{error}</div> : null}
        {loading ? <div className="GroupsMuted">Loading…</div> : null}

        <div className="GroupsPanel">
          {selectedGroup ? (
            <>
              <div className="GroupsDetailHeader">
                <Button type="secondary" onClick={() => setSelectedGroup(null)}>
                  Back
                </Button>
                <h3>{selectedGroup.name}</h3>
              </div>

              <h4>Members</h4>
              {selectedGroup.members.length === 0 ? (
                <div className="GroupsMuted">No members in this group.</div>
              ) : (
                <div className="GroupsDetailList">
                  {selectedGroup.members.map((m) => (
                    <div key={m.id} className="GroupsDetailRow">
                      {m.name}
                    </div>
                  ))}
                </div>
              )}

              <h4>Submission</h4>
              {(() => {
                const groupSubmission = getGroupSubmission(selectedGroup);
                if (!groupSubmission) {
                  return <div className="GroupsMuted">No submission uploaded yet.</div>;
                }

                return (
                  <div className="GroupsDetailList">
                    <div className="GroupsDetailRow">
                      <div>
                        {groupSubmission.file_name ? groupSubmission.file_name : "(file)"} —{" "}
                        <a href={getSubmissionDownloadUrl(groupSubmission.id)} target="_blank" rel="noreferrer">
                          Download
                        </a>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </>
          ) : (
            <>
              <h3>Group Submissions</h3>
              {groups.length === 0 ? (
                <div className="GroupsMuted">No groups yet.</div>
              ) : (
                <div className="GroupsList">
                  {groups.map((group) => {
                    const submittedCount = submittedCountForGroup(group);

                    return (
                      <button
                        key={group.id}
                        className="GroupItem"
                        onClick={() => setSelectedGroup(group)}
                        type="button"
                      >
                        <div className="GroupItemName">{group.name}</div>
                        <div className="GroupItemMeta">{submittedCount > 0 ? "Submitted" : "No submission"}</div>
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
