import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import "./Assignment.css";
import BackArrow from "../components/BackArrow";
import RubricCreator from "../components/RubricCreator";
import RubricDisplay from "../components/RubricDisplay";
import TabNavigation from "../components/TabNavigation";
import { hasRole, isTeacher } from "../util/login";

import { 
  getAssignmentDetails,
} from "../util/api";

interface SelectedCriterion {
  row: number;
  column: number;
}

export default function Assignment() {
  const { id } = useParams();
  const [selectedCriteria, setSelectedCriteria] = useState<SelectedCriterion[]>([]);
  const [assignmentName, setAssignmentName] = useState<string | null>(null);

  const isTeacherOrAdmin = hasRole("teacher", "admin");

  useEffect(() => {
      (async () => {
        try {
          if (id) {
            const details = await getAssignmentDetails(Number(id));
            setAssignmentName(details?.name ?? null);
          }
        } catch (error) {
          console.error('Error in Assignment page:', error);
        }
      })();
  }, [id]);

  const handleCriterionSelect = (row: number, column: number) => {
    // Check if this criterion is already selected
    const existingIndex = selectedCriteria.findIndex(
      criterion => criterion.row === row && criterion.column === column
    );
    
    if (existingIndex >= 0) {
      // If already selected, remove it (toggle off)
      setSelectedCriteria(prev => 
        prev.filter((_, index) => index !== existingIndex)
      );
    } else {
      // Add the new criterion, removing any other selection in the same row
      setSelectedCriteria(prev => {
        // Remove any existing selection for this row
        const filteredCriteria = prev.filter(criterion => criterion.row !== row);
        // Add the new selection
        return [...filteredCriteria, { row, column }];
      });
    }
  };

  // Build tabs array based on user role
  const tabs = [
    {
      label: "Home",
      path: `/assignment/${id}`,
    },
    {
      label: "Details",
      path: `/assignment/${id}/details`,
    },
  ];

  if (isTeacherOrAdmin) {
    tabs.push({
      label: "Group Submissions",
      path: `/assignment/${id}/group-submissions`,
    });
  }

  // Add role-specific review tab
  if (isTeacherOrAdmin) {
    tabs.push({
      label: "Peer Reviews",
      path: `/assignment/${id}/teacher-reviews`,
    });
  } else {
    tabs.push({
      label: "Peer Review",
      path: `/assignment/${id}/reviews`,
    });
    tabs.push({
      label: "My Feedback",
      path: `/assignment/${id}/feedback`,
    });
  }

  return (
    <>
      <BackArrow />
      <div className="AssignmentHeader">
        <h2>{assignmentName ?? "Loading…"}</h2>
      </div>

      <TabNavigation tabs={tabs} />

      <div className='assignmentRubricDisplay'>
        <RubricDisplay rubricId={Number(id)} onCriterionSelect={handleCriterionSelect} grades={[]} />
      </div>
      {
        isTeacher() && 
          <div className='assignmentRubric'>
            <RubricCreator id={Number(id)}/>
          </div>
      }
    </>
  );
}

