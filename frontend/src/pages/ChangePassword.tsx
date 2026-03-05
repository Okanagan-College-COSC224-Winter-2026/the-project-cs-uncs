import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../components/Button';
import Textbox from '../components/Textbox';
import StatusMessage from '../components/StatusMessage';
import { changePassword, getCurrentUser } from '../util/api';
import './LoginPage.css';

export default function ChangePassword() {
  const navigate = useNavigate();
  const [isForced, setIsForced] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    getCurrentUser()
      .then((user) => {
        setIsForced(user.must_change_password === true);
      })
      .catch(() => {
        // If we can't fetch user state, default to voluntary flow
        setIsForced(false);
      });
  }, []);

  const handleChangePassword = async () => {
    try {
      setError('');
      setSuccess(false);

      if (!currentPassword || !newPassword || !confirmPassword) {
        setError('All fields are required');
        return;
      }

      if (newPassword !== confirmPassword) {
        setError('New passwords do not match');
        return;
      }

      if (newPassword.length < 6) {
        setError('New password must be at least 6 characters');
        return;
      }

      await changePassword(currentPassword, newPassword);
      setSuccess(true);
      
      // Redirect to home after 2 seconds
      setTimeout(() => {
        navigate('/home');
      }, 2000);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message || 'Failed to change password');
      } else {
        setError('Failed to change password');
      }
    }
  };

  return (
    <div className="InputPage">
      <div className="InputBlock">
        <h1>Change Password</h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
          {isForced
            ? 'You must change your temporary password before continuing.'
            : 'Enter your current password and choose a new one.'}
        </p>

        <StatusMessage message={error} type="error" />
        {success && (
          <StatusMessage 
            message="Password changed successfully! Redirecting..." 
            type="success" 
          />
        )}

        <div className="LoginInner">
          <div className="LoginInputs">
            <div className="LoginInputChunk">
              <label htmlFor="cp-current-password">Current Password</label>
              <Textbox
                id='cp-current-password'
                type='password'
                placeholder='Current password...'
                onInput={setCurrentPassword}
                className='LoginInput'
              />
            </div>

            <div className="LoginInputChunk">
              <label htmlFor="cp-new-password">New Password</label>
              <Textbox
                id='cp-new-password'
                type='password'
                placeholder='New password...'
                onInput={setNewPassword}
                className='LoginInput'
              />
            </div>

            <div className="LoginInputChunk">
              <label htmlFor="cp-confirm-password">Confirm New Password</label>
              <Textbox
                id='cp-confirm-password'
                type='password'
                placeholder='Confirm new password...'
                onInput={setConfirmPassword}
                className='LoginInput'
              />
            </div>
          </div>
        </div>

        <div>
          <Button
            onClick={handleChangePassword}
            disabled={success}
          >
            Change Password
          </Button>
        </div>
      </div>
    </div>
  );
}
