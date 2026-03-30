import { useEffect, useState, type ReactNode } from 'react';
import Criteria from './Criteria';
import { getCriteria } from '../util/api_client/rubrics';
import './RubricDisplay.css';

interface RubricDisplayProps {
    rubricId: number | null;
    criteriaOverride?: Criterion[];
    onCriterionSelect?: (row: number, column: number) => void;
    grades: number[];
    readOnly?: boolean;
    title?: string;
    headerActions?: ReactNode;
}

export default function RubricDisplay({
    rubricId,
    criteriaOverride,
    onCriterionSelect,
    grades,
    readOnly,
    title = 'Rubric',
    headerActions,
}: RubricDisplayProps) {
    const [criteria, setCriteria] = useState<Criterion[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const questions: string[] = [];
    const scoreMaxes: number[] = [];

    const effectiveCriteria = Array.isArray(criteriaOverride) ? criteriaOverride : criteria;

    useEffect(() => {
        // If the parent already loaded criteria, render them directly.
        if (Array.isArray(criteriaOverride)) {
            setError(null);
            setLoading(false);
            return;
        }

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
                    setError(err instanceof Error ? err.message : 'Failed to load rubric criteria');
                } finally {
                    setLoading(false);
                }
            } else {
                setLoading(false);
            }
        };
        loadData();
    }, [rubricId, criteriaOverride]);

    effectiveCriteria.forEach((crit) => {
        questions.push(crit.question);
        scoreMaxes.push(crit.scoreMax);
    });

    return (
        <div className="RubricDisplay">
            <div className="RubricDisplayHeader">
                <h3>{title}</h3>
                {headerActions ? (
                    <div className="RubricDisplayHeaderActions">{headerActions}</div>
                ) : null}
            </div>

            <div className="RubricDisplayBody">
                {loading ? (
                    <p>Loading rubric...</p>
                ) : error ? (
                    <p className="error">{error}</p>
                ) : !rubricId || effectiveCriteria.length === 0 ? (
                    <p>No rubric available yet</p>
                ) : (
                    <Criteria
                        questions={questions}
                        scoreMaxes={scoreMaxes}
                        canComment={false}
                        onCriterionSelect={onCriterionSelect ?? (() => {})}
                        grades={grades}
                        readOnly={readOnly}
                    />
                )}
            </div>
        </div>
    );
}
