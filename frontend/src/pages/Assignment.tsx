import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import "./Assignment.css";
import RubricCreator from "../components/RubricCreator";
import RubricDisplay from "../components/RubricDisplay";
import TabNavigation from "../components/TabNavigation";
import { isTeacher } from "../util/login";

import { 
  getUserId
} from "../util/api";

interface SelectedCriterion {
  row: number;
  column: number;
}

export default function Assignment() {
  const { id } = useParams();
  const [selectedCriteria, setSelectedCriteria] = useState<SelectedCriterion[]>([]);

  useEffect(() => {
      (async () => {
        try {
          const stuID = await getUserId();
          // Review data is now handled in the PeerReviews component
          // This is just a placeholder for future use
          console.log('Current user ID:', stuID);
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
    tabs.push({
      label: "My Feedback",
      path: `/assignment/${id}/feedback`,
    });
  }

  return (
    <>
      <div className="AssignmentHeader">
        <h2>Assignment {id}</h2>
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

