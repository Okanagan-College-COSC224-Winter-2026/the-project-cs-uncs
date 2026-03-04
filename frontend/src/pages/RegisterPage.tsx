import { useState } from 'react';
import './RegisterPage.css';
import Textbox from '../components/Textbox';
import Button from '../components/Button';
import StatusMessage from '../components/StatusMessage';
import { tryRegister } from '../util/api';
import { useNavigate } from 'react-router-dom';

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const navigate = useNavigate();
  const [error, setError] = useState('');

  
  const attemptRegister = async () => {
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (await tryRegister(name, email, password)) {
      navigate('/');
    }
  }

  return (
    <div className="RegisterPage">
      {error && <StatusMessage message={error} type="error" className="RegisterError" />}
      <div className="RegisterBlock">
        <h1>Register</h1>

        <div className="RegisterInner">
          <div className="RegisterInputs">
            <div className="RegisterInputChunk">
              <label htmlFor="register-name">Name</label>
              <Textbox
                id='register-name'
                placeholder='Name...'
                onInput={setName}
                className='RegisterInput'
              />
            </div>

            <div className="RegisterInputChunk">
              <label htmlFor="register-email">Email</label>
              <Textbox
                id='register-email'
                type='email'
                placeholder='Email...'
                onInput={setEmail}
                className='RegisterInput'
              />
            </div>

            <div className="RegisterInputChunk">
              <label htmlFor="register-password">Password</label>
              <Textbox
                id='register-password'
                type='password'
                placeholder='Password...'
                onInput={setPassword}
                className='RegisterInput'
              />
            </div>

            <div className="RegisterInputChunk">
              <label htmlFor="register-confirm-password">Confirm Password</label>
              <Textbox
                id='register-confirm-password'
                type='password'
                placeholder='Confirm Password...'
                onInput={setConfirmPassword}
                className='RegisterInput'
              />
            </div>

          </div>

        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <Button
            onClick={()=> attemptRegister()}
            children="Register"
          />
          <Button
            onClick={() => navigate('/')}
            type='secondary'
            children="Login"
          />
        </div>

      </div>
    </div>
  );
}