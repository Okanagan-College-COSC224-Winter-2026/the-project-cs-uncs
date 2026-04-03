import { useEffect, useMemo, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import BackArrow from "../components/BackArrow";
import HeaderTitle from "../components/HeaderTitle";
import TabNavigation from "../components/TabNavigation";
import { getAssignmentDetails, getMyCourseGroup, listClasses, peekAssignmentDetails } from "../util/api";
import { isAdmin, isTeacher } from "../util/login";
import "./MyGroup.css";

type Member = {
  id: number;
  name: string;
  preferred_name?: string;
  preferred_pronouns?: 'Not specified' | 'he/him' | 'she/her' | 'they/them';
  email?: string;
};

type Group = {
  id: number;
  name: string;
  course_id: number;
  members: Member[];
};

export default function MyGroup() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const isAssignmentRoute = useMemo(() => location.pathname.startsWith("/assignment/"), [location.pathname]);

  const [courseId, setCourseId] = useState<number | null>(null);
  const [headerTitle, setHeaderTitle] = useState<string | null>(null);
  const [assignmentType, setAssignmentType] = useState<string | null>(null);
  const [group, setGroup] = useState<Group | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const assignmentTypeHint = useMemo(() => {
    if (!isAssignmentRoute) return null
    if (!id) return null
    const cached = peekAssignmentDetails(Number(id))
    if (!cached || typeof cached !== "object") return null
    const record = cached as Record<string, unknown>
    return typeof record.assignment_type === "string" ? record.assignment_type : null
  }, [id, isAssignmentRoute]);

  const effectiveAssignmentType = assignmentType ?? assignmentTypeHint;

  const currentUserId = useMemo(() => {
    try {
      const stored = localStorage.getItem("user");
      if (!stored) return null;
      const parsed = JSON.parse(stored);
      return typeof parsed?.id === "number" ? parsed.id : null;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);

      try {
        if (!id) return;

        if (isAssignmentRoute) {
          const details = await getAssignmentDetails(Number(id));
          if (cancelled) return;
          const resolvedCourseId = Number(details?.courseID);
          setCourseId(Number.isFinite(resolvedCourseId) ? resolvedCourseId : null);
          setHeaderTitle(details?.name ?? null);
          setAssignmentType(details?.assignment_type ?? null);
        } else {
          const resolvedCourseId = Number(id);
          setCourseId(Number.isFinite(resolvedCourseId) ? resolvedCourseId : null);
          const classes = await listClasses();
          if (cancelled) return;
          const currentClass = classes.find((c: { id: number }) => c.id === resolvedCourseId);
          setHeaderTitle(currentClass?.name ?? null);
        }
      } catch (e: unknown) {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg || "Failed to load page");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id, isAssignmentRoute]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!courseId) return;
      try {
        const resp = await getMyCourseGroup(courseId);
        if (cancelled) return;
        setGroup((resp?.group as Group) ?? null);
      } catch (e: unknown) {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg || "Failed to load group");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [courseId]);

  const classTabs = useMemo(
    () => [
      { label: "Assignments", path: `/classes/${courseId ?? id}/home` },
      { label: "My Group", path: `/classes/${courseId ?? id}/my-group` },
    ],
    [courseId, id]
  );

  const assignmentTabs = useMemo(() => {
    const showRubricTab = (effectiveAssignmentType === "peer_eval_group" || effectiveAssignmentType === "peer_eval_individual") && (isTeacher() || isAdmin());
    const tabs = [
      ...(showRubricTab ? [{ label: "Rubric", path: `/assignment/${id}` }] : []),
      { label: "Details", path: `/assignment/${id}/details` },
      { label: "My Group", path: `/assignment/${id}/my-group` },
    ];

    if (isTeacher()) {
      if (effectiveAssignmentType === "peer_eval_group" || effectiveAssignmentType === "peer_eval_individual") {
        tabs.push({ label: "Peer Reviews", path: `/assignment/${id}/teacher-reviews` });
      }
    } else {
      if (effectiveAssignmentType === "peer_eval_group" || effectiveAssignmentType === "peer_eval_individual") {
        tabs.push({ label: "Peer Review", path: `/assignment/${id}/reviews` });
        tabs.push({ label: "My Feedback", path: `/assignment/${id}/feedback` });
      }
    }

    return tabs;
  }, [effectiveAssignmentType, id]);

  const otherMembers = useMemo(() => {
    if (!group?.members) return [] as Member[];
    if (!currentUserId) return group.members;
    return group.members.filter((m) => m.id !== currentUserId);
  }, [group, currentUserId]);

  return (
    <div className="Page">
      <BackArrow />
      <div className="ClassHeader">
        <div className="ClassHeaderLeft">
          <h2>
            <HeaderTitle
              title={headerTitle}
              loading={loading}
              fallback={isAssignmentRoute ? "Assignment" : "Class"}
            />
          </h2>
        </div>
      </div>

      <TabNavigation tabs={isAssignmentRoute ? assignmentTabs : classTabs} />

      <div className="MyGroupPage">
        {error ? <div className="MyGroupError">{error}</div> : null}
        {loading ? <div className="PageStatusText">Loading…</div> : null}

        {!loading && !error ? (
          <div className="MyGroupPanel">
            <h3>My Group</h3>

            {group ? (
              <>
                <div className="MyGroupName">{group.name}</div>

                <div className="MyGroupSectionTitle">Members</div>
                {otherMembers.length === 0 ? (
                  <div className="MyGroupMuted">No other members.</div>
                ) : (
                  <div className="MyGroupList">
                    {otherMembers.map((m) => (
                      <div key={m.id} className="MyGroupRow">
                        <div className="MyGroupRowName">
                          {(() => {
                            const displayName = String(m.preferred_name || '').trim() || m.name
                            const pronouns = String(m.preferred_pronouns || '').trim()
                            const showPronouns = pronouns.length > 0 && pronouns !== 'Not specified'
                            return `${displayName}${showPronouns ? ` (${pronouns})` : ''}`
                          })()}
                        </div>
                        <div className="MyGroupRowEmail">{m.email}</div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="MyGroupMuted">You are not assigned to a group.</div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
