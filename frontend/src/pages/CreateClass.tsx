import { useState } from 'react'
import BackArrow from '../components/BackArrow'
import Button from '../components/Button'
import Textbox from '../components/Textbox'
import StatusMessage from '../components/StatusMessage'
import './CreateClass.css'
import { createClass } from '../util/api'

export default function CreateClass() {
  const [name, setName] = useState('')
  const [statusMessage, setStatusMessage] = useState('')
  const [statusType, setStatusType] = useState<'error' | 'success'>('error')

  const attemptCreateClass = async () => {
    try {
      setStatusMessage('');
      const response = await createClass(name);
      
      if (!response.ok) {
        throw new Error('Failed to create class');
      }

      setStatusType('success');
      setStatusMessage('Class created successfully!');
      setName(''); // Clear the input
    } catch (error) {
      console.error('Error creating class:', error);
      setStatusType('error');
      setStatusMessage('Error creating class.');
    }
  };

  return (
    <div className="CreateClass">
      <BackArrow />
      <h1>Create Class</h1>

      <StatusMessage message={statusMessage} type={statusType} />

      <h2>Class Name</h2>
      <Textbox onInput={setName} />
      
      <Button onClick={() => {
        // Send API req
        attemptCreateClass()
      }}>
        Submit
      </Button>
    </div>
  )
}

