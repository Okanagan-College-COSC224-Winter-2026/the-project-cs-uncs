import { useState } from 'react';
import './RegisterPage.css';
import Textbox from '../components/Textbox';
import Button from '../components/Button';
import StatusMessage from '../components/StatusMessage';
import { joinRosterCourse, tryRegister } from '../util/api';
import { useNavigate } from 'react-router-dom';

interface AvailableCourse {
  id: number;
  name: string;
  teacher_name: string;
}

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [statusType, setStatusType] = useState<'error' | 'success'>('error');
  const [isRegistered, setIsRegistered] = useState(false);
  const [availableCourses, setAvailableCourses] = useState<AvailableCourse[]>([]);
  const [selectedCourses, setSelectedCourses] = useState<number[]>([]);
  const [isJoining, setIsJoining] = useState(false);
  const navigate = useNavigate();

  const looksLikeEmail = (value: string) => {
    // Intentionally simple: just enough to catch obvious typos.
    return /^\S+@\S+\.\S+$/.test(value)
  }

  const handleRegister = async () => {
    setStatusType('error')
    setStatusMessage('')

    const trimmedName = name.trim()
    const trimmedEmail = email.trim()
    const trimmedPassword = password.trim()
    const trimmedConfirmPassword = confirmPassword.trim()

    if (!trimmedName) {
      setStatusMessage('Please enter your name.')
      return
    }

    if (!trimmedEmail) {
      setStatusMessage('Please enter your email address.')
      return
    }

    if (!looksLikeEmail(trimmedEmail)) {
      setStatusMessage('Please enter a valid email address (example: name@school.edu).')
      return
    }

    if (!trimmedPassword) {
      setStatusMessage('Please create a password.')
      return
    }

    if (!trimmedConfirmPassword) {
      setStatusMessage('Please confirm your password.')
      return
    }

    if (password !== confirmPassword) {
      setStatusMessage("Passwords don't match. Please try again.")
      return
    }

    try {
      const response = await tryRegister(trimmedName, trimmedEmail, trimmedPassword);

      // Check for available courses in response
      if (response.available_courses && response.available_courses.length > 0) {
        setAvailableCourses(response.available_courses);
        setIsRegistered(true);
        setStatusType('success');
        setStatusMessage('Registration successful! You can now join your courses.');
      } else {
        // No courses available, redirect to dashboard
        setStatusType('success');
        setStatusMessage('Registration successful!');
        setTimeout(() => navigate('/home'), 2000);
      }
    } catch (error) {
      setStatusType('error');
      setStatusMessage(error instanceof Error ? error.message : 'Registration failed');
    }
  };

  const handleJoinCourses = async () => {
    if (selectedCourses.length === 0) {
      setStatusType('error');
      setStatusMessage('Please select at least one course');
      return;
    }

    setIsJoining(true);
    try {
      // Join each selected course
      for (const courseId of selectedCourses) {
        await joinRosterCourse(courseId)
      }

      setStatusType('success');
      setStatusMessage('Successfully joined courses!');
      setTimeout(() => navigate('/home'), 2000);
    } catch (error) {
      setStatusType('error');
      setStatusMessage(error instanceof Error ? error.message : 'Failed to join courses');
    } finally {
      setIsJoining(false);
    }
  };

  if (isRegistered && availableCourses.length > 0) {
    return (
      <div className="RegisterPage">
        {statusMessage && <StatusMessage message={statusMessage} type={statusType} className="RegisterError" />}
        <div className="RegisterContainer">
          <h1>Join Your Courses</h1>
          <p>Your email appears on the roster for these courses. Select which ones you'd like to join:</p>

          <div className="CourseList">
            {availableCourses.map((course) => (
              <label key={course.id} className="CourseCheckbox">
                <input
                  type="checkbox"
                  checked={selectedCourses.includes(course.id)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedCourses([...selectedCourses, course.id]);
                    } else {
                      setSelectedCourses(selectedCourses.filter(id => id !== course.id));
                    }
                  }}
                />
                <span>
                  <strong>{course.name}</strong>
                  <br/>
                  <small>Instructor: {course.teacher_name}</small>
                </span>
              </label>
            ))}
          </div>

          <div className="ButtonGroup">
            <Button
              onClick={handleJoinCourses}
              disabled={isJoining || selectedCourses.length === 0}
            >
              {isJoining ? 'Joining...' : 'Join Selected Courses'}
            </Button>
            <Button
              type="secondary"
              onClick={() => navigate('/home')}
              disabled={isJoining}
            >
              Skip for Now
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="RegisterPage">
      {statusMessage && <StatusMessage message={statusMessage} type={statusType} className="RegisterError" />}
      <div className="RegisterBlock">
        <h1>Register</h1>

        <div className="RegisterInner">
          <form
            className="RegisterForm"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              handleRegister();
            }}
          >
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

            <div style={{ display: 'flex', gap: '8px' }}>
              <Button
                htmlType="submit"
              >
                Register
              </Button>
              <Button
                htmlType="button"
                type="secondary"
                onClick={() => navigate('/')}
              >
                Login
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
