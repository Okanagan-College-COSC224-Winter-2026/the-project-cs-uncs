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

  const looksLikeEmail = (value: string) => {
    // Intentionally simple: just enough to catch obvious typos.
    return /^\S+@\S+\.\S+$/.test(value)
  }

  const attemptLogin = async () => {
    try {
      setError('')

      const trimmedEmail = email.trim()
      const trimmedPassword = password.trim()

      if (!trimmedEmail) {
        setError('Please enter your email address.')
        return
      }

      if (!looksLikeEmail(trimmedEmail)) {
        setError('Please enter a valid email address (example: name@school.edu).')
        return
      }

      if (!trimmedPassword) {
        setError('Please enter your password.')
        return
      }

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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    }
  }

  return (
    <div className="LoginPage">
      {error && <StatusMessage message={error} type="error" className="LoginError" />}
      <div className="InputBlock">
        <h1>Login</h1>

        <form
          className="LoginForm"
          onSubmit={(e) => {
            e.preventDefault();
            attemptLogin();
          }}
        >
          <div className="LoginInner">
            <div className="LoginInputs">
              <div className="LoginInputChunk">
                <label htmlFor="login-email">Email</label>
                <Textbox
                  id='login-email'
                  placeholder='Email...'
                  onInput={setEmail}
                  className='LoginInput'
                />
              </div>

              <div className="LoginInputChunk">
                <label htmlFor="login-password">Password</label>
                <Textbox
                  id='login-password'
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
              htmlType="submit"
              children="Login"
            />
            <Button
              htmlType="button"
              onClick={() => navigate('/register')}
              type='secondary'
              children="Register"
            />
          </div>
        </form>
      </div>
    </div>
  );
}
