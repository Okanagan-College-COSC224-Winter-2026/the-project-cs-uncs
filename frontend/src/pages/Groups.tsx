import { useEffect, useMemo, useState } from "react";
import { Navigate, useLocation, useParams } from "react-router-dom";
import BackArrow from "../components/BackArrow";
import Button from "../components/Button";
import TabNavigation from "../components/TabNavigation";
import { isTeacher } from "../util/login";
import {
    createCourseGroup,
    listCourseGroups,
    listCourseMembers,
    listClasses,
    getAssignmentDetails,
} from "../util/api";
import "./Groups.css";

interface Member {
    id: number;
    name: string;
    email: string;
}

interface Group {
    id: number;
    name: string;
    members: Member[];
}

export default function Groups() {
    const { id } = useParams<{ id: string }>();
    const location = useLocation();
    const isAssignmentRoute = useMemo(() => location.pathname.startsWith("/assignment/"), [location.pathname]);

    const [courseId, setCourseId] = useState<number | null>(null);
    const [headerTitle, setHeaderTitle] = useState<string | null>(null);

    const [groups, setGroups] = useState<Group[]>([]);
    const [courseMembers, setCourseMembers] = useState<Member[]>([]);
    const [showCreateGroup, setShowCreateGroup] = useState(false);
    const [newGroupName, setNewGroupName] = useState("");
    const [selectedMembers, setSelectedMembers] = useState<number[]>([]);
    const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    if (!isTeacher()) {
        return <Navigate to={isAssignmentRoute ? `/assignment/${id}` : `/classes/${id}/my-group`} replace />;
    }

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
                    const resolvedCourseId = Number(details?.course?.id ?? details?.courseID);
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
                const [groupsResp, membersResp] = await Promise.all([
                    listCourseGroups(courseId),
                    listCourseMembers(String(courseId)),
                ]);
                if (cancelled) return;
                setGroups(groupsResp as Group[]);
                setCourseMembers(membersResp as Member[]);
            } catch (e: unknown) {
                if (cancelled) return;
                const msg = e instanceof Error ? e.message : String(e);
                setError(msg || "Failed to load groups");
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [courseId]);

    const handleCreateGroup = async () => {
        if (!courseId) return;
        if (!newGroupName.trim()) {
            setError("Group name is required");
            return;
        }
        if (selectedMembers.length === 0) {
            setError("Select at least one student");
            return;
        }

        try {
            setError(null);
            await createCourseGroup(courseId, newGroupName.trim(), selectedMembers);
            const refreshed = await listCourseGroups(courseId);
            setGroups(refreshed as Group[]);
            setShowCreateGroup(false);
            setNewGroupName("");
            setSelectedMembers([]);
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            setError(msg || "Failed to create group");
        }
    };

    const handleMemberSelection = (memberId: number) => {
        setSelectedMembers(prev =>
            prev.includes(memberId)
                ? prev.filter(id => id !== memberId)
                : [...prev, memberId]
        );
    };

    const classTabs = useMemo(
        () => [
            { label: "Home", path: `/classes/${courseId ?? id}/home` },
            { label: "Members", path: `/classes/${courseId ?? id}/members` },
            { label: "Groups", path: `/classes/${courseId ?? id}/groups` },
        ],
        [courseId, id]
    );

    const assignmentTabs = useMemo(() => {
        const tabs = [
            { label: "Home", path: `/assignment/${id}` },
            { label: "Details", path: `/assignment/${id}/details` },
            { label: "Groups", path: `/assignment/${id}/groups` },
        ];

        if (isTeacher()) {
            tabs.push({ label: "Peer Reviews", path: `/assignment/${id}/teacher-reviews` });
        } else {
            tabs.push({ label: "Peer Review", path: `/assignment/${id}/reviews` });
            tabs.push({ label: "My Feedback", path: `/assignment/${id}/feedback` });
        }

        return tabs;
    }, [id]);

    return (
        <>
            <BackArrow />
            <div className="ClassHeader">
                <div className="ClassHeaderLeft">
                    <h2>{headerTitle || (isAssignmentRoute ? `Assignment ${id}` : `Class ${id}`)}</h2>
                </div>
                <div className="ClassHeaderRight">
                    {isTeacher() && courseId ? (
                        <Button type="secondary" onClick={() => setShowCreateGroup((v) => !v)}>
                            {showCreateGroup ? "Cancel" : "Create New Group"}
                        </Button>
                    ) : null}
                </div>
            </div>

            <TabNavigation tabs={isAssignmentRoute ? assignmentTabs : classTabs} />

            <div className="GroupsPage">
                {error ? <div className="GroupsError">{error}</div> : null}

                {loading ? <div className="GroupsMuted">Loading…</div> : null}

                {showCreateGroup && isTeacher() ? (
                    <div className="GroupsPanel">
                        <h3>Create Group</h3>

                        <label className="GroupsLabel">
                            Group name
                            <input
                                className="GroupsInput"
                                type="text"
                                value={newGroupName}
                                onChange={(e) => setNewGroupName(e.target.value)}
                                placeholder="e.g., Group 1"
                            />
                        </label>

                        <div className="GroupsMemberPicker">
                            <div className="GroupsMemberPickerHeader">Select enrolled students</div>
                            {courseMembers.length === 0 ? (
                                <div className="GroupsMuted">No students enrolled.</div>
                            ) : (
                                courseMembers.map((member) => (
                                    <label key={member.id} className="GroupsMemberRow">
                                        <input
                                            type="checkbox"
                                            checked={selectedMembers.includes(member.id)}
                                            onChange={() => handleMemberSelection(member.id)}
                                        />
                                        <span className="GroupsMemberName">{member.name}</span>
                                        <span className="GroupsMemberEmail">{member.email}</span>
                                    </label>
                                ))
                            )}
                        </div>

                        <div className="GroupsActions">
                            <Button onClick={handleCreateGroup} disabled={!newGroupName.trim() || selectedMembers.length === 0}>
                                Save Group
                            </Button>
                        </div>
                    </div>
                ) : null}

                <div className="GroupsPanel">
                    {selectedGroup ? (
                        <>
                            <div className="GroupsDetailHeader">
                                <Button type="secondary" onClick={() => setSelectedGroup(null)}>
                                    Back
                                </Button>
                                <h3>{selectedGroup.name}</h3>
                            </div>

                            {selectedGroup.members.length === 0 ? (
                                <div className="GroupsMuted">No members in this group.</div>
                            ) : (
                                <div className="GroupsDetailList">
                                    {selectedGroup.members.map((m) => (
                                        <div key={m.id} className="GroupsDetailRow">{m.name}</div>
                                    ))}
                                </div>
                            )}
                        </>
                    ) : (
                        <>
                            <h3>Groups</h3>
                            {groups.length === 0 ? (
                                <div className="GroupsMuted">No groups yet.</div>
                            ) : (
                                <div className="GroupsList">
                                    {groups.map((group) => (
                                        <button
                                            key={group.id}
                                            className="GroupItem"
                                            onClick={() => setSelectedGroup(group)}
                                            type="button"
                                        >
                                            <div className="GroupItemName">{group.name}</div>
                                            <div className="GroupItemMeta">{group.members?.length ?? 0} members</div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </>
    );
}
