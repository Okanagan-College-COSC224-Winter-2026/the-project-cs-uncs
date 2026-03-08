import { useEffect, useState, ChangeEvent } from "react";
import { useParams, useNavigate } from "react-router-dom";
import "./Assignment.css";
import RubricCreator from "../components/RubricCreator";
import RubricDisplay from "../components/RubricDisplay";
import TabNavigation from "../components/TabNavigation";
import { isTeacher } from "../util/login";

import { 
  listStuGroup,
  getUserId,
  createReview,
  createCriterion,
  getReview
} from "../util/api";

interface SelectedCriterion {
  row: number;
  column: number;
}

export default function Assignment() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [stuGroup, setStuGroup] = useState<StudentGroups[]>([]);
  const [revieweeID, setRevieweeID] = useState<number>(0);
  const [stuID, setStuID] = useState<number>(0);
  const [selectedCriteria, setSelectedCriteria] = useState<SelectedCriterion[]>([]);
  const [review, setReview] = useState<number[]>([]);

  useEffect(() => {
      (async () => {
        try {
          const stuID = await getUserId();
          setStuID(stuID);

          try {
            const stus = await listStuGroup(Number(id), stuID);
            setStuGroup(stus);
          } catch (error) {
            console.log('Group list not available:', error);
            setStuGroup([]);
          }

          if (revieweeID) {
            try {
              const reviewResponse = await getReview(Number(id), stuID, revieweeID);
              const reviewData = await reviewResponse.json();
              setReview(reviewData.grades);
              console.log("Review data:", reviewData);
            } catch (error) {
              console.log('Review not available:', error);
            }
          }
        } catch (error) {
          console.error('Error in Assignment page:', error);
        }
      })();
  }, [revieweeID, id]);

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

  function handleRadioChange(event: ChangeEvent<HTMLInputElement>): void {
    const selectedID = Number(event.target.value);
    setRevieweeID(selectedID);
    console.log(`Selected group member ID: ${selectedID}`);
  }

  return (
    <>
      <div className="AssignmentHeader">
        <h2>Assignment {id}</h2>
        {!isTeacher() && (
          <button
            className="peer-reviews-btn"
            onClick={() => navigate(`/assignment/${id}/reviews`)}
          >
            View Peer Reviews
          </button>
        )}
      </div>

      <TabNavigation
        tabs={[
          {
            label: "Home",
            path: `/assignment/${id}`,
          },
          {
            label: "Group",
            path: `/assignment/${id}/group`,
          }
        ]}
      />

      <div className='assignmentRubricDisplay'>
        <RubricDisplay rubricId={Number(id)} onCriterionSelect={handleCriterionSelect} grades={review} />
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

