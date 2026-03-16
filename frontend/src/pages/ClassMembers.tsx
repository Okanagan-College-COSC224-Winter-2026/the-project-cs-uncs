import { useParams } from "react-router-dom";
import TabNavigation from "../components/TabNavigation";
import { useEffect, useState } from "react";
import Button from "../components/Button";
import { importCSV } from "../util/csv";
import { listCourseMembers, listClasses } from "../util/api";

import './ClassMembers.css'
import { isTeacher } from "../util/login";

export default function ClassMembers() {
  const { id } = useParams()
  const [members, setMembers] = useState<User[]>([])
  const [className, setClassName] = useState<string | null>(null);

  useEffect(() => {
    ;(async () => {
      const members = await listCourseMembers(id as string)
      const classes = await listClasses();
      const currentClass = classes.find((c: { id: number }) => c.id === Number(id));
      setMembers(members)
      setClassName(currentClass?.name || null);
    })()
  }, [id])  

  return (
    <>
      <div className="ClassHeader">
        <div className="ClassHeaderLeft">
          <h2>{className}</h2>
        </div>

        <div className="ClassHeaderRight">
          {isTeacher() ? (
            <Button onClick={() => importCSV(id as string)}>Add Students via CSV</Button>
          ) : null}
        </div>
      </div>

      <TabNavigation
        tabs={[
          {
            label: "Home",
            path: `/classes/${id}/home`,
          },
          {
            label: "Members",
            path: `/classes/${id}/members`,
          },
        ]}
      />

      <div className="ClassMemberList">
        {
          members.map(member => {
            return (
              <div key={member.id} className="Member">
                {member.name} ({member.id})
              </div>
            )
          })
        }
      </div>
    </>
  );
}
