import { useEffect, useState } from 'react';
import Criteria from './Criteria';
import { getCriteria } from '../util/api';
import './RubricDisplay.css';

interface RubricDisplayProps {
    rubricId: number | null;
    onCriterionSelect?: (row: number, column: number) => void;
    grades: number[];
    readOnly?: boolean;
}

export default function RubricDisplay({ rubricId, onCriterionSelect, grades, readOnly }: RubricDisplayProps) {
    const [criteria, setCriteria] = useState<Criterion[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const questions: string[] = [];
    const scoreMaxes: number[] = [];
    const hasScores: boolean[] = [];

    useEffect(() => {
        const loadData = async () => {
            if (rubricId) {
                try {
                    setLoading(true);
                    setError(null);
                    // getCriteria now accepts assignment ID
                    const criteriaResp = await getCriteria(rubricId);

                    if (Array.isArray(criteriaResp)) {
                        setCriteria(criteriaResp);
                    } else if (criteriaResp && Array.isArray(criteriaResp.criteria)) {
                        setCriteria(criteriaResp.criteria);
                    } else {
                        console.warn('Unexpected criteria response format:', criteriaResp);
                        setCriteria([]);
                    }
                } catch (err) {
                    console.error('Error loading criteria:', err);
                    setError('Failed to load rubric criteria');
                } finally {
                    setLoading(false);
                }
            } else {
                setLoading(false);
            }
        };
        loadData();
    }, [rubricId]);

    criteria.forEach((crit) => {
        questions.push(crit.question);
        scoreMaxes.push(crit.scoreMax);
        hasScores.push(crit.hasScore);
    });

    if (loading) {
        return (
            <div className="RubricDisplay">
                <p>Loading rubric...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="RubricDisplay">
                <p className="error">{error}</p>
            </div>
        );
    }

    if (!rubricId || criteria.length === 0) {
        return (
            <div className="RubricDisplay">
                <p>No rubric available yet</p>
            </div>
        );
    }

    return (
        <div className="RubricDisplay">
            <h2>Rubric</h2>
            <Criteria
                questions={questions}
                scoreMaxes={scoreMaxes}
                canComment={true}
                hasScores={hasScores}
                onCriterionSelect={onCriterionSelect ?? (() => {})}
                grades={grades}
                readOnly={readOnly}
            />
        </div>
    );
}
