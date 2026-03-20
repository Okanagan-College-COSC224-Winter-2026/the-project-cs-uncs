import './Criteria.css';
import Criterion from '../components/Criterion';

interface props {
    questions: Array<string>;
    scoreMaxes: Array<number>;
    canComment: boolean;
    hasScores: Array<boolean>;
    onCriterionSelect: (row: number, column: number) => void;
    grades: number[];
    readOnly?: boolean;
}

export default function Criteria(props: props) {
    return (
        <div className="Criteria">
            <table className='criteriaTable'>
                {props.questions.map((question, i) => (
                    <Criterion 
                        key={i}
                        question={question} 
                        scoreMax={props.scoreMaxes[i]} 
                        hasScore={props.hasScores[i]}
                        onCriterionSelect={props.onCriterionSelect}
                        questionIndex={i}
                        grade={props.grades[i]}
                        readOnly={props.readOnly}
                    />
                ))}
            </table>
            {props.canComment && !props.readOnly ? <textarea className="criteriaText" /> : null}
        </div>
    )
}