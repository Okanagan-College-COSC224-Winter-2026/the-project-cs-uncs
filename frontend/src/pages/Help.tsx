import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getUserRole } from '../util/login';
import './Help.css';

type Role = 'student' | 'teacher' | 'admin';

export default function Help() {
  const navigate = useNavigate();
  const userRole = getUserRole() as Role;
  const [activeRole, setActiveRole] = useState<Role>(userRole);
  const [openFAQs, setOpenFAQs] = useState<Set<string>>(new Set());

  useEffect(() => {
    setActiveRole(userRole);
  }, [userRole]);

  const toggleFAQ = (id: string) => {
    const newOpen = new Set(openFAQs);
    if (newOpen.has(id)) {
      newOpen.delete(id);
    } else {
      newOpen.add(id);
    }
    setOpenFAQs(newOpen);
  };

  return (
    <div className="Help-container">
      {/* Hero Section */}
      <div className="help-hero">
        <h1>PeerLens User Guide</h1>
        <p>Learn how to make the most of peer evaluation and feedback</p>
      </div>

      {/* Role Header */}
      <div className="role-header">
        <span className="role-badge" data-role={userRole}>
          {userRole.charAt(0).toUpperCase() + userRole.slice(1)} Guide
        </span>
      </div>

      {/* Quick Navigation */}

      {/* STUDENT SECTION */}
      <section className={`role-section ${activeRole === 'student' ? 'active' : ''}`}>
        <div id="getting-started" className="help-section">
          <h2>Getting Started as a Student</h2>
          <div className="section-divider"></div>
          <div className="help-content">
            <h3>Your Dashboard</h3>
            <p>
              When you log in, you'll see your Student Dashboard with all your enrolled classes.
              Each class shows upcoming assignments and active reviews.
            </p>

            <h3>Joining a Class</h3>
            <p>
              Your teacher will provide you with a class code. Use this code to join the class
              and gain access to all course materials and assignments.
            </p>

            <div className="callout info">
              <span className="callout-icon">ℹ️</span>
              <span>You can only join classes using the enrollment code provided by your instructor.</span>
            </div>
          </div>
        </div>

        <div id="assignments" className="help-section">
          <h2>Completing Assignments</h2>
          <div className="section-divider"></div>
          <div className="help-content">
            <h3>View Assignment Details</h3>
            <p>Click on an assignment to see:</p>
            <ul className="help-list">
              <li>Due dates and deadlines</li>
              <li>Assignment description</li>
              <li>Evaluation criteria (rubric)</li>
              <li>Submission requirements</li>
            </ul>

            <h3>Submit Your Work</h3>
            <p>Upload your assignment files before the deadline. You can submit multiple files and
               edit your submission until the deadline passes.</p>

            <div className="callout warn">
              <span className="callout-icon">⚠️</span>
              <span>Make sure to submit before the deadline. Late submissions may not be accepted.</span>
            </div>
          </div>
        </div>

        <div id="reviews" className="help-section">
          <h2>Peer Reviews</h2>
          <div className="section-divider"></div>
          <div className="help-content">
            <h3>Understanding the Review Process</h3>
            <p>After submitting your work, you'll be assigned peers to review and will receive
               reviews from your classmates. The review process helps everyone learn from
               different perspectives.</p>

            <h3>How to Review</h3>
            <ul className="help-list">
              <li>Click on a review assignment to open it</li>
              <li>Read the submission carefully</li>
              <li>Complete the evaluation criteria with honest feedback</li>
              <li>Add constructive comments to explain your ratings</li>
              <li>Submit your review before the deadline</li>
            </ul>

            <h3>Receiving Feedback</h3>
            <p>Visit the Received Feedback section to see all reviews from your peers. Consider
               this feedback to improve future work.</p>
          </div>
        </div>
      </section>

      {/* TEACHER SECTION */}
      <section className={`role-section ${activeRole === 'teacher' ? 'active' : ''}`}>
        <div id="getting-started" className="help-section">
          <h2>Getting Started as a Teacher</h2>
          <div className="section-divider"></div>
          <div className="help-content">
            <h3>Create a Class</h3>
            <p>Click "Create Class" to set up a new course. You'll receive a unique class code
               to share with students for enrollment.</p>

            <h3>Manage Class Enrollment</h3>
            <p>View and manage all students enrolled in your class. You can see their enrollment
               status and participation in assignments and reviews.</p>

            <div className="callout info">
              <span className="callout-icon">ℹ️</span>
              <span>Share your class code securely with students. Anyone with the code can enroll.</span>
            </div>
          </div>
        </div>

        <div id="assignments" className="help-section">
          <h2>Creating Assignments</h2>
          <div className="section-divider"></div>
          <div className="help-content">
            <h3>Create an Assignment</h3>
            <p>Click "Create Assignment" to start building peer evaluation activities.</p>

            <h3>Assignment Types</h3>
            <div className="type-cards">
              <div className="type-card">
                <div className="type-card-icon">📝</div>
                <div className="type-card-name">Written Submission</div>
                <div className="type-card-desc">Students submit written work for peer review</div>
              </div>
              <div className="type-card">
                <div className="type-card-icon">📊</div>
                <div className="type-card-name">Presentation</div>
                <div className="type-card-desc">Students present work and receive feedback</div>
              </div>
              <div className="type-card">
                <div className="type-card-icon">💭</div>
                <div className="type-card-name">Project</div>
                <div className="type-card-desc">Group or individual project with peer evaluation</div>
              </div>
            </div>

            <h3>Set Evaluation Criteria</h3>
            <p>Create a rubric with specific criteria that students will use to evaluate their peers.
               Each criterion can have multiple rating levels.</p>
          </div>
        </div>

        <div id="reviews" className="help-section">
          <h2>Managing Reviews</h2>
          <div className="section-divider"></div>
          <div className="help-content">
            <h3>Review Dashboard</h3>
            <p>Monitor the review process with the Teacher Review Dashboard. Track which students
               have submitted reviews and which are pending.</p>

            <h3>Configure Review Groups</h3>
            <p>Assign students to review groups. You can configure automatic grouping or manually
               assign review pairs/groups.</p>

            <div className="callout tip">
              <span className="callout-icon">💡</span>
              <span>Consider staggering review deadlines to give students time between submission and review phases.</span>
            </div>
          </div>
        </div>
      </section>

      {/* ADMIN SECTION */}
      <section className={`role-section ${activeRole === 'admin' ? 'active' : ''}`}>
        <div id="getting-started" className="help-section">
          <h2>Admin Dashboard</h2>
          <div className="section-divider"></div>
          <div className="help-content">
            <h3>User Management</h3>
            <p>Manage all system users including students, teachers, and admins. You can:</p>
            <ul className="help-list">
              <li>View all user accounts</li>
              <li>Assign or modify user roles</li>
              <li>Enable or disable accounts</li>
              <li>Reset user passwords</li>
            </ul>

            <h3>System Overview</h3>
            <p>Access the admin panel to monitor system health, view statistics, and manage
               platform-wide settings.</p>

            <div className="callout info">
              <span className="callout-icon">ℹ️</span>
              <span>Admin accounts have access to all system functions and user data.</span>
            </div>
          </div>
        </div>

        <div id="assignments" className="help-section">
          <h2>System Management</h2>
          <div className="section-divider"></div>
          <div className="help-content">
            <h3>Monitor Classes</h3>
            <p>View all classes, assignments, and reviews in the system. Admins can access any
               class or assignment for moderation purposes.</p>

            <h3>User Support</h3>
            <p>Help resolve user issues including password resets, account access problems, and
               technical questions about the platform.</p>
          </div>
        </div>
      </section>

      {/* GLOSSARY */}
      <div id="glossary" className="help-section">
        <h2>Glossary</h2>
        <div className="section-divider"></div>
        <div className="glossary-grid">
          <div className="glossary-item">
            <div className="glossary-term">Assignment</div>
            <div className="glossary-def">A learning activity assigned by an instructor that students complete and can be evaluated by peers.</div>
          </div>
          <div className="glossary-item">
            <div className="glossary-term">Peer Review</div>
            <div className="glossary-def">The process where students evaluate and provide feedback on work submitted by their classmates.</div>
          </div>
          <div className="glossary-item">
            <div className="glossary-term">Rubric</div>
            <div className="glossary-def">A set of criteria and scoring guidelines used to evaluate student work consistently.</div>
          </div>
          <div className="glossary-item">
            <div className="glossary-term">Criterion</div>
            <div className="glossary-def">An individual dimension or category used to evaluate work as part of a rubric.</div>
          </div>
          <div className="glossary-item">
            <div className="glossary-term">Submission</div>
            <div className="glossary-def">The work or files that a student uploads for an assignment before the deadline.</div>
          </div>
          <div className="glossary-item">
            <div className="glossary-term">Review Group</div>
            <div className="glossary-def">A set of students assigned to review each other's work for a particular assignment.</div>
          </div>
        </div>
      </div>

      {/* FAQ */}
      <div id="faq" className="help-section">
        <h2>Frequently Asked Questions</h2>
        <div className="section-divider"></div>
        {[
          {
            id: 'faq-1',
            q: 'How do I join a class?',
            a: 'Get the class enrollment code from your teacher and enter it in your dashboard. Then click "Enroll" and you\'ll be added to the class immediately.'
          },
          {
            id: 'faq-2',
            q: 'Can I change my peer review after submitting?',
            a: 'Once a review is submitted, you cannot edit it. Make sure to review your feedback carefully before submitting.'
          },
          {
            id: 'faq-3',
            q: 'What happens if I miss the assignment deadline?',
            a: 'Missing deadlines may result in not being able to submit your work or complete reviews. Speak with your instructor if you need an extension.'
          },
          {
            id: 'faq-4',
            q: 'How is my grade determined?',
            a: 'Grading depends on your assignment\'s rubric. Your teacher will explain how peer reviews and submissions factor into your final grade.'
          },
          {
            id: 'faq-5',
            q: 'Can I see who reviewed my work?',
            a: 'You can read the feedback from your peers. Reviews may be anonymous depending on your teacher\'s settings.'
          }
        ].map((faq) => (
          <div key={faq.id} className={`faq-item ${openFAQs.has(faq.id) ? 'open' : ''}`}>
            <div className="faq-q" onClick={() => toggleFAQ(faq.id)}>
              <span>{faq.q}</span>
              <span className="chevron">▼</span>
            </div>
            <div className="faq-a">{faq.a}</div>
          </div>
        ))}
      </div>

      {/* PERMISSIONS */}
      <div id="permissions" className="help-section">
        <h2>Role Permissions</h2>
        <div className="section-divider"></div>
        <table className="perm-table">
          <thead>
            <tr>
              <th>Feature</th>
              <th>Student</th>
              <th>Teacher</th>
              <th>Admin</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Join Classes</td>
              <td><span className="perm-yes">✓</span></td>
              <td><span className="perm-no">—</span></td>
              <td><span className="perm-no">—</span></td>
            </tr>
            <tr>
              <td>Submit Assignments</td>
              <td><span className="perm-yes">✓</span></td>
              <td><span className="perm-no">—</span></td>
              <td><span className="perm-no">—</span></td>
            </tr>
            <tr>
              <td>Complete Peer Reviews</td>
              <td><span className="perm-yes">✓</span></td>
              <td><span className="perm-no">—</span></td>
              <td><span className="perm-no">—</span></td>
            </tr>
            <tr>
              <td>Create Classes</td>
              <td><span className="perm-no">—</span></td>
              <td><span className="perm-yes">✓</span></td>
              <td><span className="perm-yes">✓</span></td>
            </tr>
            <tr>
              <td>Create Assignments</td>
              <td><span className="perm-no">—</span></td>
              <td><span className="perm-yes">✓</span></td>
              <td><span className="perm-yes">✓</span></td>
            </tr>
            <tr>
              <td>Manage Reviews</td>
              <td><span className="perm-no">—</span></td>
              <td><span className="perm-yes">✓</span></td>
              <td><span className="perm-yes">✓</span></td>
            </tr>
            <tr>
              <td>Manage Users</td>
              <td><span className="perm-no">—</span></td>
              <td><span className="perm-no">—</span></td>
              <td><span className="perm-yes">✓</span></td>
            </tr>
            <tr>
              <td>Manage System Settings</td>
              <td><span className="perm-no">—</span></td>
              <td><span className="perm-no">—</span></td>
              <td><span className="perm-yes">✓</span></td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Back to Home */}
      <div className="help-footer">
        <button className="back-home-btn" onClick={() => navigate('/')}>
          ← Back to Dashboard
        </button>
      </div>
    </div>
  );
}
