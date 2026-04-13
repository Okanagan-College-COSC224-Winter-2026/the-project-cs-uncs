import { Navigate, useParams } from "react-router-dom";
import BackArrow from "../components/BackArrow";
import TabNavigation from "../components/TabNavigation";
import { useEffect, useState } from "react";
import Button from "../components/Button";
import { importCSV } from "../util/csv";
import { enrollStudentsByEmail, listCourseGroups, listCourseMembers, listClasses, removeCourseMember, type CourseGroup } from "../util/api";
import HeaderTitle from "../components/HeaderTitle";
import StatusMessage from "../components/StatusMessage";

import './ClassMembers.css'
import { isAdmin, isTeacher } from "../util/login";

export default function ClassMembers() {
  const { id } = useParams()

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

  if (!teacherOrAdmin) {
    return <Navigate to={`/classes/${id}/my-group`} replace />;
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
      <BackArrow />
      <div className="ClassHeader">
        <div className="ClassHeaderLeft">
          <h2>
            <HeaderTitle title={className} loading={loadingHeader} fallback="Class" />
          </h2>
        </div>

        <div className="ClassHeaderRight">
          {teacherOrAdmin ? (
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

      {teacherOrAdmin && showAddStudents ? (
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
        ]}
      />

      <div className="ClassMemberList">
        {
          members.map(member => {
            const groupName = groupNameByUserId[member.id]
            return (
              <div key={member.id} className="Member">
                <div className="MemberName">
                  {member.name}
                  {groupName ? <span className="MemberGroup"> [{groupName}]</span> : null}
                </div>
                {teacherOrAdmin ? (
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
          })
        }
      </div>
    </div>
  );
}
