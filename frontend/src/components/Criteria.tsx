import './Criteria.css';
import Criterion from '../components/Criterion';

interface props {
    questions: Array<string>;
    scoreMaxes: Array<number>;
    canComment: boolean;
    onCriterionSelect: (row: number, column: number) => void;
    grades: number[];
    readOnly?: boolean;
}

export default function Criteria(props: props) {
    return (
        <div className="Criteria">
            <table className='criteriaTable'>
                <tbody>
                {props.questions.map((question, i) => {
                    return (
                        <Criterion
                            key={i}
                            question={question}
                            scoreMax={props.scoreMaxes[i]}
                            onCriterionSelect={props.onCriterionSelect}
                            questionIndex={i}
                            grade={props.grades[i]}
                            readOnly={props.readOnly}
                        />
                    );
                })}
                </tbody>
            </table>
            {props.canComment && !props.readOnly ? <textarea className="criteriaText" /> : null}
        </div>
    )
}