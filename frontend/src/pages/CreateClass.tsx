import { useState } from 'react'
import BackArrow from '../components/BackArrow'
import Button from '../components/Button'
import Textbox from '../components/Textbox'
import StatusMessage from '../components/StatusMessage'
import './CreateClass.css'
import { createClass } from '../util/api_client/classes'

export default function CreateClass() {
  const [name, setName] = useState('')
  const [statusMessage, setStatusMessage] = useState('')
  const [statusType, setStatusType] = useState<'error' | 'success'>('error')

  const attemptCreateClass = async () => {
    if (!name.trim()) {
      setStatusType('error')
      setStatusMessage('Class name is required')
      return
    }

    try {
      setStatusMessage('');
      await createClass(name.trim());

      setStatusType('success');
      setStatusMessage('Class created successfully!');
      setName(''); // Clear the input
    } catch (error) {
      console.error('Error creating class:', error);
      setStatusType('error');
      setStatusMessage(error instanceof Error ? error.message : 'Error creating class.');
    }
  };

  return (
    <div className="CreateClass Page">
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
