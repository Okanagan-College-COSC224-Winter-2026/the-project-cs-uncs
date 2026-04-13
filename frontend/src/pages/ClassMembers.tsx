import { Navigate, useParams, useSearchParams } from "react-router-dom";
import BackArrow from "../components/BackArrow";
import TabNavigation from "../components/TabNavigation";
import { useEffect, useState } from "react";
import Button from "../components/Button";
import { importCSV } from "../util/csv";
import { enrollStudentsByEmail, listCourseGroups, listCourseMembers, listClasses, removeCourseMember, type CourseGroup } from "../util/api";
import HeaderTitle from "../components/HeaderTitle";
import StatusMessage from "../components/StatusMessage";
import { getUserById } from "../util/api_client/users";

import './ClassMembers.css'
import { isAdmin, isTeacher } from "../util/login";

export default function ClassMembers() {
  const { id } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()

  const teacherOrAdmin = isTeacher() || isAdmin()

  const [members, setMembers] = useState<User[]>([])
  const [groupNameByUserId, setGroupNameByUserId] = useState<Record<number, string>>({})
  const [className, setClassName] = useState<string | null>(null);
  const [loadingHeader, setLoadingHeader] = useState(true);
  const [showAddStudents, setShowAddStudents] = useState(false);
  const [emailsText, setEmailsText] = useState("");
  const [adding, setAdding] = useState(false);
  const [removingMemberId, setRemovingMemberId] = useState<number | null>(null);
  const [confirmRemoveMemberId, setConfirmRemoveMemberId] = useState<number | null>(null);

  const [statusMessage, setStatusMessage] = useState('');
  const [statusType, setStatusType] = useState<'error' | 'success'>('error');

  const [selectedMemberInfo, setSelectedMemberInfo] = useState<User | null>(null)
  const [loadingSelectedMember, setLoadingSelectedMember] = useState(false)
  const [selectedMemberError, setSelectedMemberError] = useState<string | null>(null)

  const selectedMemberIdRaw = searchParams.get('member')
  const selectedMemberId = selectedMemberIdRaw ? Number(selectedMemberIdRaw) : null
  const isDrillInOpen = selectedMemberId != null && Number.isFinite(selectedMemberId)

  useEffect(() => {
      document.title = 'Members';

    if (!teacherOrAdmin) return
    if (!id) {
      setLoadingHeader(false)
      return
    }

    let cancelled = false

    ;(async () => {
      try {
        setLoadingHeader(true);
        const [members, classes] = await Promise.all([listCourseMembers(id as string), listClasses()]);
        if (cancelled) return;

        const currentClass = classes.find((c: { id: number }) => c.id === Number(id));
        setMembers(members)
        setClassName(currentClass?.name || null);

        if (id) {
          const groups: CourseGroup[] = await listCourseGroups(Number(id))
          if (cancelled) return;
          const map: Record<number, string> = {}
          for (const g of groups) {
            for (const m of g.members || []) {
              if (typeof m.id !== 'number') continue
              // If a student somehow appears in multiple groups, keep the first name.
              if (!map[m.id]) {
                map[m.id] = g.name
              }
            }
          }
          setGroupNameByUserId(map)
        }
      } catch (e) {
        if (cancelled) return;
        console.error('Failed to load class members page data:', e)
        setStatusType('error')
        setStatusMessage(e instanceof Error ? e.message : 'Failed to load class members.')
        setGroupNameByUserId({})
      } finally {
        if (!cancelled) setLoadingHeader(false);
      }
    })()

    return () => {
      cancelled = true
    }
  }, [id, teacherOrAdmin])  

  useEffect(() => {
    if (!isDrillInOpen) {
      setSelectedMemberInfo(null)
      setSelectedMemberError(null)
      setLoadingSelectedMember(false)
      return
    }

    if (!teacherOrAdmin) {
      setSelectedMemberInfo(null)
      setSelectedMemberError(null)
      setLoadingSelectedMember(false)
      return
    }

    if (selectedMemberId == null || !Number.isFinite(selectedMemberId)) {
      setSelectedMemberInfo(null)
      setSelectedMemberError(null)
      setLoadingSelectedMember(false)
      return
    }

    let cancelled = false
    ;(async () => {
      setSelectedMemberInfo(null)
      setSelectedMemberError(null)
      setStatusMessage('')
      setLoadingSelectedMember(true)
      try {
        const info = await getUserById(selectedMemberId)
        if (cancelled) return
        setSelectedMemberInfo(info as User)
      } catch (e) {
        if (cancelled) return
        console.error('Failed to load member info:', e)
        setSelectedMemberError(e instanceof Error ? e.message : 'Failed to load student info.')
      } finally {
        if (!cancelled) setLoadingSelectedMember(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [isDrillInOpen, selectedMemberId, teacherOrAdmin])

  if (!teacherOrAdmin) {
    return <Navigate to={`/classes/${id}/my-group`} replace />;
  }

  const openMemberInfo = (memberId: number) => {
    setSearchParams({ member: String(memberId) })
  }

  const handleAddStudents = async () => {
    if (!id) return;
    if (!emailsText.trim()) {
      setStatusType('error');
      setStatusMessage('Please enter at least one email.');
      return;
    }

    try {
      setAdding(true);
      const result = await enrollStudentsByEmail(Number(id), emailsText);
      setStatusType('success');
      setStatusMessage(result.msg || 'Students added successfully!');
      setEmailsText("");
      setShowAddStudents(false);
      const refreshed = await listCourseMembers(id as string);
      setMembers(refreshed);
    } catch (error) {
      setStatusType('error');
      setStatusMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setAdding(false);
    }
  };

  const handleRemoveMember = async (userId: number) => {
    if (!id) return;

    if (confirmRemoveMemberId !== userId) {
      setConfirmRemoveMemberId(userId);
      setStatusType('error');
      setStatusMessage('Click Remove again to confirm.');
      return;
    }

    try {
      setStatusMessage('');
      setRemovingMemberId(userId);
      await removeCourseMember(Number(id), userId);
      setMembers((prev) => prev.filter((m) => m.id !== userId));
      setConfirmRemoveMemberId(null);
      setStatusType('success');
      setStatusMessage('Student removed.');
    } catch (error) {
      setStatusType('error');
      setStatusMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setRemovingMemberId(null);
    }
  };

  return (
    <div className="Page">
      <BackArrow to={isDrillInOpen && id ? `/classes/${id}/members` : undefined} />
      <div className="ClassHeader">
        <div className="ClassHeaderLeft">
          <h2>
            <HeaderTitle title={className} loading={loadingHeader} fallback="Class" />
          </h2>
        </div>

        <div className="ClassHeaderRight">
          {isTeacher() ? (
            <>
              <Button
                onClick={() =>
                  importCSV(id as string, {
                    onSuccess: (msg) => {
                      setStatusType('success');
                      setStatusMessage(msg);
                      void listCourseMembers(id as string).then(setMembers);
                    },
                    onError: (msg) => {
                      setStatusType('error');
                      setStatusMessage(msg);
                    },
                  })
                }
              >
                Add Students via CSV
              </Button>
              <Button
                type="secondary"
                onClick={() => setShowAddStudents((v) => !v)}
                disabled={adding}
              >
                {showAddStudents ? "Cancel" : "Add Students by Email"}
              </Button>
            </>
          ) : null}
        </div>
      </div>

      <StatusMessage message={statusMessage} type={statusType} />

      {isTeacher() && showAddStudents ? (
        <div className="AddStudentsPanel">
          <label className="AddStudentsLabel">
            Student emails (comma / space / newline separated)
            <textarea
              className="AddStudentsTextarea"
              rows={4}
              value={emailsText}
              onChange={(e) => setEmailsText(e.target.value)}
              placeholder="student1@example.com, student2@example.com"
              disabled={adding}
            />
          </label>

          <div className="AddStudentsActions">
            <Button onClick={handleAddStudents} disabled={adding}>
              {adding ? "Adding..." : "Add"}
            </Button>
          </div>
        </div>
      ) : null}

      <TabNavigation
        tabs={[
          {
            label: "Assignments",
            path: `/classes/${id}/home`,
          },
          {
            label: "Members",
            path: `/classes/${id}/members`,
          },
          {
            label: "Groups",
            path: `/classes/${id}/groups`,
          },
          ...(isTeacher() || isAdmin()
            ? [{ label: "Gradebook", path: `/classes/${id}/gradebook` }]
            : []),
        ]}
      />

      {isDrillInOpen ? (
        <>
          <div className="MembersPanel">
            <h3 style={{ margin: 0 }}>Student Info</h3>
            {selectedMemberError ? <StatusMessage message={selectedMemberError} type="error" /> : null}

            <div className="MembersInfoRow">
              <div className="MembersInfoLabel">Full Name</div>
              <div className="MembersInfoValue">
                {loadingSelectedMember ? 'Loading…' : String(selectedMemberInfo?.name || '—')}
              </div>
            </div>

            <div className="MembersInfoRow">
              <div className="MembersInfoLabel">Preferred Name</div>
              <div className="MembersInfoValue">
                {loadingSelectedMember
                  ? 'Loading…'
                  : String(selectedMemberInfo?.preferred_name || selectedMemberInfo?.name || '—')}
              </div>
            </div>

            <div className="MembersInfoRow">
              <div className="MembersInfoLabel">Preferred Pronouns</div>
              <div className="MembersInfoValue">
                {loadingSelectedMember
                  ? 'Loading…'
                  : String(selectedMemberInfo?.preferred_pronouns || 'Not specified')}
              </div>
            </div>

            <div className="MembersInfoRow">
              <div className="MembersInfoLabel">Email</div>
              <div className="MembersInfoValue">
                {loadingSelectedMember ? 'Loading…' : String(selectedMemberInfo?.email || '—')}
              </div>
            </div>

            <div className="MembersInfoRow">
              <div className="MembersInfoLabel">Group</div>
              <div className="MembersInfoValue">
                {(() => {
                  const groupName = groupNameByUserId[selectedMemberId]
                  return groupName ? groupName : '—'
                })()}
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="ClassMemberList">
          {members.map((member) => {
            const groupName = groupNameByUserId[member.id]
            return (
              <div key={member.id} className="Member">
                <button
                  type="button"
                  className="MemberName MemberNameButton"
                  onClick={() => openMemberInfo(member.id)}
                >
                  {member.name}
                  {groupName ? <span className="MemberGroup"> [{groupName}]</span> : null}
                </button>
                {isTeacher() ? (
                  <Button
                    type="secondary"
                    className="MemberRemoveBtn"
                    onClick={() => handleRemoveMember(member.id)}
                    disabled={removingMemberId === member.id}
                  >
                    {confirmRemoveMemberId === member.id ? 'Confirm Remove' : 'Remove'}
                  </Button>
                ) : null}
              </div>
            )
          })}
        </div>
      )}
    </div>
  );
}
