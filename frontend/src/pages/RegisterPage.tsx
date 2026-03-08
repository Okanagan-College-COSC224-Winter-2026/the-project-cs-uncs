import { useState } from 'react';
import './RegisterPage.css';
import Textbox from '../components/Textbox';
import Button from '../components/Button';
import StatusMessage from '../components/StatusMessage';
import { tryRegister } from '../util/api';
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
  const [statusMessage, setStatusMessage] = useState('');
  const [statusType, setStatusType] = useState<'error' | 'success'>('error');
  const [isRegistered, setIsRegistered] = useState(false);
  const [availableCourses, setAvailableCourses] = useState<AvailableCourse[]>([]);
  const [selectedCourses, setSelectedCourses] = useState<number[]>([]);
  const [isJoining, setIsJoining] = useState(false);
  const navigate = useNavigate();

  const handleRegister = async () => {
    if (!name.trim() || !email.trim() || !password.trim()) {
      setStatusType('error');
      setStatusMessage('All fields are required');
      return;
    }

    try {
      const response = await tryRegister(name, email, password);

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
        const response = await fetch('http://localhost:5000/class/join_course', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({ course_id: courseId })
        });

        if (!response.ok) {
          throw new Error(`Failed to join course ${courseId}`);
        }
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

          <StatusMessage message={statusMessage} type={statusType} />

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
      <div className="RegisterContainer">
        <h1>Create Account</h1>

        <div className="FormGroup">
          <label>Full Name</label>
          <Textbox
            placeholder="Enter your full name"
            onInput={setName}
            className="RegisterInput"
          />
        </div>

        <div className="FormGroup">
          <label>Email</label>
          <Textbox
            placeholder="Enter your email"
            onInput={setEmail}
            className="RegisterInput"
          />
        </div>

        <div className="FormGroup">
          <label>Password</label>
          <Textbox
            placeholder="Enter your password"
            onInput={setPassword}
            type="password"
            className="RegisterInput"
          />
        </div>

        <StatusMessage message={statusMessage} type={statusType} />

        <Button
          onClick={handleRegister}
          disabled={!name.trim() || !email.trim() || !password.trim()}
        >
          Register
        </Button>
      </div>
    </div>
  );
}