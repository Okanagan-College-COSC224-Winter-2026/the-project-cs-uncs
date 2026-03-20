import { useEffect, useMemo, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import BackArrow from "../components/BackArrow";
import TabNavigation from "../components/TabNavigation";
import { getAssignmentDetails, getMyCourseGroup, listClasses } from "../util/api";
import { isTeacher } from "../util/login";
import "./MyGroup.css";

type Member = {
  id: number;
  name: string;
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
  const [group, setGroup] = useState<Group | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      { label: "Home", path: `/classes/${courseId ?? id}/home` },
      { label: "My Group", path: `/classes/${courseId ?? id}/my-group` },
    ],
    [courseId, id]
  );

  const assignmentTabs = useMemo(() => {
    const tabs = [
      { label: "Home", path: `/assignment/${id}` },
      { label: "Details", path: `/assignment/${id}/details` },
      { label: "My Group", path: `/assignment/${id}/my-group` },
    ];

    if (isTeacher()) {
      tabs.push({ label: "Peer Reviews", path: `/assignment/${id}/teacher-reviews` });
    } else {
      tabs.push({ label: "Peer Review", path: `/assignment/${id}/reviews` });
      tabs.push({ label: "My Feedback", path: `/assignment/${id}/feedback` });
    }

    return tabs;
  }, [id]);

  const otherMembers = useMemo(() => {
    if (!group?.members) return [] as Member[];
    if (!currentUserId) return group.members;
    return group.members.filter((m) => m.id !== currentUserId);
  }, [group, currentUserId]);

  return (
    <>
      <BackArrow />
      <div className="ClassHeader">
        <div className="ClassHeaderLeft">
          <h2>{headerTitle || (isAssignmentRoute ? `Assignment ${id}` : `Class ${id}`)}</h2>
        </div>
      </div>

      <TabNavigation tabs={isAssignmentRoute ? assignmentTabs : classTabs} />

      <div className="MyGroupPage">
        {error ? <div className="MyGroupError">{error}</div> : null}
        {loading ? <div className="MyGroupMuted">Loading…</div> : null}

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
                        <div className="MyGroupRowName">{m.name}</div>
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
    </>
  );
}
