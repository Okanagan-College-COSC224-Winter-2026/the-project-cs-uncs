import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../components/Button';
import Textbox from '../components/Textbox';
import StatusMessage from '../components/StatusMessage';
import { createTeacherAccount } from '../util/api';
import './LoginPage.css';

export default function CreateTeacher() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [createdTeacher, setCreatedTeacher] = useState<User | null>(null);

  const handleCreateTeacher = async () => {
    try {
      setError('');
      setSuccess(false);

      if (!name || !email || !password) {
        setError('All fields are required');
        return;
      }

      if (password.length < 6) {
        setError('Temporary password must be at least 6 characters');
        return;
      }

      const result = await createTeacherAccount(name, email, password);
      setCreatedTeacher(result.user);
      setSuccess(true);
      
      // Clear form
      setName('');
      setEmail('');
      setPassword('');
    } catch {
      setError('Failed to create teacher account');
    }
  };

  return (
    <div className="InputPage">
      <div className="InputBlock">
        <h1>Create Teacher Account</h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
          Create a new teacher account with a temporary password.
        </p>

        <StatusMessage message={error} type="error" />
        
        {success && createdTeacher && (
          <StatusMessage type="success">
            <div>
              <strong>Teacher account created successfully!</strong>
              <div style={{ marginTop: '8px', fontSize: '0.9rem' }}>
                <div><strong>Name:</strong> {createdTeacher.name}</div>
                <div><strong>Email:</strong> {createdTeacher.email}</div>
                <div><strong>Temporary Password:</strong> (provided by you)</div>
                <div style={{ marginTop: '8px', fontStyle: 'italic' }}>
                  The teacher will be prompted to change their password on first login.
                </div>
              </div>
            </div>
          </StatusMessage>
        )}

        <div className="LoginInner">
          <div className="LoginInputs">
            <div className="LoginInputChunk">
              <span>Teacher Name</span>
              <Textbox
                placeholder='Full name...'
                onInput={setName}
                className='LoginInput'
              />
            </div>

            <div className="LoginInputChunk">
              <span>Institutional Email</span>
              <Textbox
                type='email'
                placeholder='teacher@institution.edu...'
                onInput={setEmail}
                className='LoginInput'
              />
            </div>

            <div className="LoginInputChunk">
              <span>Temporary Password</span>
              <Textbox
                type='password'
                placeholder='Temporary password...'
                onInput={setPassword}
                className='LoginInput'
              />
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <Button onClick={handleCreateTeacher}>
            Create Teacher
          </Button>
          <Button onClick={() => navigate('/home')} type='secondary'>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
