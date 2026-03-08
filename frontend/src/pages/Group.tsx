import { useEffect, useState } from "react";
import {
  createGroup,
  getNextGroupID,
  getUserId,
  listCourseMembers,
  listGroupMembers,
  listGroups,
  listStuGroup,
  listUnassignedGroups,
  saveGroups,
  deleteGroup,
} from "../util/api";
import { useParams } from "react-router-dom";
import "./Group.css";
import TabNavigation from "../components/TabNavigation";
import StatusMessage from "../components/StatusMessage";
import { isTeacher } from "../util/login";
import Textbox from "../components/Textbox";

function fisherYates<T>(array: T[]): T[] {
  let m = array.length, t, i;

  while (m) {
    i = Math.floor(Math.random() * m--);

    t = array[m];
    array[m] = array[i];
    array[i] = t;
  }

  return array;
}

export default function Group() {
  const { id } = useParams();
  const [classMembers, setclassMembers] = useState<User[]>([]);
  const [stuGroup, setStuGroup] = useState<StudentGroups[]>([]);
  const [groups, setGroups] = useState<CourseGroup[]>([]);
  const [groupTable, setGroupTable] = useState<GroupTable>({});
  const [selectedGroup, setSelectedGroup] = useState<number>(-1);
  const [memberTable, setMemberTable] = useState<GroupTable>({});
  const [groupName, setGroupName] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [statusType, setStatusType] = useState<'error' | 'success'>('error');

  const nameFromId = (id: number) => {
    return classMembers.find((mem) => mem.id === id)?.name || 'N/A';
  };

  const randomize = () => {
    // remove every member from every group, save them
    const members = []

    for (const group of Object.values(groupTable)) {
      for (const member of group) {
        const n = { ...member }
        n.groupID = -1

        members.push(n)
      }
    }

    // Also grab the members from the unassigned table
    if (memberTable[-1]) {
      for (const member of memberTable[-1]) {
        const n = { ...member }
        n.groupID = -1

        members.push(n)
      }
    }

    const membersPerGroup = members.length / Object.keys(groupTable).length
    const gIds = Object.keys(groupTable)
    // Shuffle the array, then sequentially add them to groups
    const shuffled = fisherYates(members)
    const newTable: GroupTable = {}

    let i = 0
    for (const group of gIds) {
      for (let j = 0; j < membersPerGroup; j++) {
        const g = Number(group)
        const member = shuffled[i]
        i++

        // This will make a false entry if the amount of total people is uneven
        if (!member) break

        const n = { ...member }
        n.groupID = Number(group)

        newTable[g] = newTable[g] || []
        newTable[g].push(n)
      }
    }

    setGroupTable(newTable)
    setMemberTable({})
  }

  useEffect(() => {
    (async () => {
      const classMembers = await listCourseMembers(String(id));
      setclassMembers(classMembers);
      const groups = await listGroups(Number(id));
      setGroups(groups);
      const ua = await listUnassignedGroups(Number(id));
      const stuId = await getUserId();
      const stus = await listStuGroup(Number(id), stuId);
      setStuGroup(stus);

      const groupMembers: {
        [key: number]: GroupTableValue[];
      } = {};
      for (const g of groups) {
        const members = await listGroupMembers(Number(id), g.id);
        groupMembers[g.id] = members;
      }

      const grLocal: GroupTable = {};
      //build a table of group names and students
      for (const gr of groups) {
        grLocal[gr.id] = [];
        for (const stu of groupMembers[gr.id]) {
          if (stu.groupID === gr.id) {
            grLocal[gr.id].push(stu);
          }
        }
      }
      setGroupTable(grLocal);

      //build a table for unassigned students
      const memLocal: GroupTable = {};
      memLocal[-1] = [];
      for (const stu of ua) {
        memLocal[-1].push(stu);
      }
      setMemberTable(memLocal);
    })();
  }, []);

  // Build tabs array based on user role
  const tabs = [
    {
      label: "Home",
      path: `/assignment/${id}`,
    },
    {
      label: "Group",
      path: `/assignment/${id}/group`,
    }
  ];

  // Add role-specific review tab
  if (isTeacher()) {
    tabs.push({
      label: "Peer Reviews",
      path: `/assignment/${id}/teacher-reviews`,
    });
  } else {
    tabs.push({
      label: "Peer Review",
      path: `/assignment/${id}/reviews`,
    });
  }

  return (
    <>
      <div className="AssignmentHeader">
        <h2>Assignment {id}</h2>
      </div>

      <TabNavigation tabs={tabs} />

      <StatusMessage message={statusMessage} type={statusType} />

      <div className="AssignmentPage">
        {isTeacher() ? (
          <>
            <div className="assignmentTables">
              <table className="table">
                <tr>
                  <th>Unassigned</th>
                </tr>
                {memberTable[-1]
                  ? memberTable[-1].map((ua) => {
                      return (
                        <tr>
                          <span className="StudentName">{nameFromId(ua.userID)}</span>
                          <button
                            onClick={() => {
                              // These need to be deep copies, or it won't update properly
                              const localMember = { ...memberTable };
                              const localGroup = { ...groupTable };
                              const memObj = localMember[-1].find(
                                (mem) => ua.userID == mem.userID
                              );

                              if (memObj == undefined || selectedGroup == -1)
                                return;

                              localMember[-1] = localMember[-1].filter(
                                (g) => memObj?.userID != g.userID
                              );
                              memObj.groupID = selectedGroup;

                              if (memObj)
                                localGroup[selectedGroup].push(memObj);
                              else console.log("no unassigned users");

                              setMemberTable(localMember);
                              setGroupTable(localGroup);
                            }}
                          >
                            Move
                          </button>
                        </tr>
                      );
                    })
                  : null}
              </table>

              <table className="table">
                <tr>
                  <th>Groups</th>
                </tr>
                {Object.keys(groupTable).map((gId) => {
                  return (
                    <>
                      <tr
                        className={
                          "groupNames " +
                          (Number(gId) == selectedGroup ? "selected" : "")
                        }
                        onClick={() => setSelectedGroup(Number(gId))}
                      >
                        <div className="GroupArrow">
                          <img src="/icons/arrow.svg" alt="arrow" />
                        </div>
                        {groups.find((gr) => gr.id === Number(gId))?.name}
                      </tr>

                      {selectedGroup !== -1 && selectedGroup == Number(gId)
                        ? groupTable[selectedGroup].map((stu) => {
                            return (
                              <tr>
                                <span className="StudentName">
                                  {nameFromId(stu.userID)}
                                </span>
                                <button
                                  onClick={() => {
                                    // These need to be deep copies, or it won't update properly
                                    const localMember = { ...memberTable };
                                    const localGroup = { ...groupTable };
                                    const memObj = localGroup[
                                      selectedGroup
                                    ].find((mem) => stu.userID == mem.userID);

                                    if (memObj == undefined) return;

                                    localGroup[selectedGroup] = localGroup[
                                      selectedGroup
                                    ].filter((g) => memObj?.userID != g.userID);
                                    memObj.groupID = -1;

                                    if (memObj) localMember[-1].push(memObj);
                                    else console.log("shouldn't happen?");

                                    setMemberTable(localMember);
                                    setGroupTable(localGroup);
                                  }}
                                >
                                  Move
                                </button>
                              </tr>
                            );
                          })
                        : null}
                    </>
                  );
                })}
              </table>
            </div>
            <div>
            <button
              onClick={() => {
                const groupMems = Object.values(groupTable);
                const uaMems = Object.values(memberTable);
                for (const group of groupMems) {
                  for (const mem of group) {
                    saveGroups(mem.groupID, mem.userID, mem.assignmentID);
                  }
                }
                for (const group of uaMems) {
                  for (const mem of group) {
                    saveGroups(mem.groupID, mem.userID, mem.assignmentID);
                  }
                }

                setStatusType('success');
                setStatusMessage('Changes saved!');
              }}
            >
              Confirm Changes
            </button>

            <button
              style={{ backgroundColor: "var(--background-tertiary)" }}
              onClick={randomize}
            >
              Randomize
            </button>
            <button
              onClick={() => {
                if (selectedGroup == -1) return;
                const localGroup = { ...groupTable}
                delete localGroup[selectedGroup];
                setGroupTable(localGroup);
                deleteGroup(selectedGroup);
                setStatusType('success');
                setStatusMessage('Group deleted!');
              }}>
              Delete Selected Group
              </button>
            </div>

            <div>
              <button
                onClick={() =>{
                  const nextGid = Number(getNextGroupID) + 1 ;
                  createGroup(Number(id), groupName, Number(nextGid))           
                }}
                >
                  Create New Group
              </button>
              <Textbox
                placeholder="group name"
                onInput={setGroupName}
                className="groupNameInput"
                >
              </Textbox>
            </div>
          </>
        ) : (
          <div className="assignment">
            <table className="studentTable">
              <tr>
                <th>My group</th>
              </tr>
              {stuGroup.map((stus) => {
                return <tr>{stus.userID}</tr>;
              })}
            </table>
          </div>
        )}
      </div>
    </>
  );
}
