import { Navigate, useParams } from "react-router-dom";
import BackArrow from "../components/BackArrow";
import TabNavigation from "../components/TabNavigation";
import { useEffect, useState } from "react";
import Button from "../components/Button";
import { importCSV } from "../util/csv";
import { enrollStudentsByEmail, listCourseMembers, listClasses, removeCourseMember } from "../util/api";
import HeaderTitle from "../components/HeaderTitle";

import './ClassMembers.css'
import { isAdmin, isTeacher } from "../util/login";

export default function ClassMembers() {
  const { id } = useParams()

  if (!(isTeacher() || isAdmin())) {
    return <Navigate to={`/classes/${id}/my-group`} replace />;
  }

  const [members, setMembers] = useState<User[]>([])
  const [className, setClassName] = useState<string | null>(null);
  const [loadingHeader, setLoadingHeader] = useState(true);
  const [showAddStudents, setShowAddStudents] = useState(false);
  const [emailsText, setEmailsText] = useState("");
  const [adding, setAdding] = useState(false);
  const [removingMemberId, setRemovingMemberId] = useState<number | null>(null);

  useEffect(() => {
    ;(async () => {
      setLoadingHeader(true);
      const members = await listCourseMembers(id as string)
      const classes = await listClasses();
      const currentClass = classes.find((c: { id: number }) => c.id === Number(id));
      setMembers(members)
      setClassName(currentClass?.name || null);
      setLoadingHeader(false);
    })()
  }, [id])  

  const handleAddStudents = async () => {
    if (!id) return;
    if (!emailsText.trim()) {
      alert("Please enter at least one email.");
      return;
    }

    try {
      setAdding(true);
      const result = await enrollStudentsByEmail(Number(id), emailsText);
      alert(result.msg || "Students added successfully!");
      setEmailsText("");
      setShowAddStudents(false);
      const refreshed = await listCourseMembers(id as string);
      setMembers(refreshed);
    } catch (error) {
      alert("Error: " + error);
    } finally {
      setAdding(false);
    }
  };

  const handleRemoveMember = async (userId: number) => {
    if (!id) return;
    if (!window.confirm('Remove this student from the class?')) return;

    try {
      setRemovingMemberId(userId);
      await removeCourseMember(Number(id), userId);
      setMembers((prev) => prev.filter((m) => m.id !== userId));
    } catch (error) {
      alert('Error: ' + error);
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
          {isTeacher() ? (
            <>
              <Button onClick={() => importCSV(id as string)}>Add Students via CSV</Button>
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
        ]}
      />

      <div className="ClassMemberList">
        {
          members.map(member => {
            return (
              <div key={member.id} className="Member">
                <div className="MemberName">{member.name}</div>
                {isTeacher() ? (
                  <Button
                    type="secondary"
                    className="MemberRemoveBtn"
                    onClick={() => handleRemoveMember(member.id)}
                    disabled={removingMemberId === member.id}
                  >
                    Remove
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
