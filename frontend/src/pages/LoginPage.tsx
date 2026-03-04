import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './LoginPage.css';
import Textbox from '../components/Textbox';
import Button from '../components/Button';
import StatusMessage from '../components/StatusMessage';
import { tryLogin } from '../util/api';

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const attemptLogin = async () => {
    try {
      const result = await tryLogin(email, password);
      if (result) {
        // Check if user must change password
        if (result.must_change_password) {
          navigate('/change-password');
        } else {
          navigate('/home');
        }
      } else {
        setError('Invalid email or password');
      }
    } catch {
      setError('Invalid email or password');
    }
  }

  return (
    <div className="LoginPage">
      {error && <StatusMessage message={error} type="error" className="LoginError" />}
      <div className="LoginBlock">  
        <h1>Login</h1>

        <div className="LoginInner">
          <div className="LoginInputs">
            <div className="LoginInputChunk">
              <label>Email</label>
              <Textbox
                placeholder='Email...'
                onInput={setEmail}
                className='LoginInput'
              />
            </div>

            <div className="LoginInputChunk">
              <label>Password</label>
              <Textbox
                type='password'
                placeholder='Password...'
                onInput={setPassword}
                className='LoginInput'
              />
            </div>
          </div>

        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Button
            onClick={()=> attemptLogin()}
            children="Login"
          />
          <Button
            onClick={() => navigate('/register')}
            type='secondary'
            children="Register"
          />
        </div>
      </div>
    </div>
  );
}
