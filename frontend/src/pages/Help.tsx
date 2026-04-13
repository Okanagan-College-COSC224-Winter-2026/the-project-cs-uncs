import { useState } from 'react';
import { getUserRole } from '../util/login';
import './Help.css';

type Role = 'student' | 'teacher' | 'admin';

type FAQItem = {
  id: string;
  roles: Role[];
  q: string;
  a: string;
};

export default function Help() {
  const userRole = getUserRole() as Role;
  const activeRole = userRole;
  const [openFAQs, setOpenFAQs] = useState<Set<string>>(new Set());

  const faqItems: FAQItem[] = [
    {
      id: 'faq-1',
      roles: ['student', 'teacher', 'admin'],
      q: 'What do I need to use PeerLens?',
      a: 'Just a device with an internet browser and an active internet connection. No installation required.'
    },
    {
      id: 'faq-2',
      roles: ['student', 'teacher', 'admin'],
      q: 'I was registered by my school. Do I need to create an account?',
      a: 'No. Log in with the credentials your administrator or teacher provided. You\'ll be prompted to change your password on first login.'
    },
    {
      id: 'faq-3',
      roles: ['student'],
      q: 'I registered but I can\'t see any classes. What do I do?',
      a: 'Contact your teacher or administrator to have them enroll you. Students cannot self-enroll in classes.'
    },
    {
      id: 'faq-4',
      roles: ['student', 'teacher', 'admin'],
      q: 'I didn\'t receive a registration email. What should I do?',
      a: 'Check your spam or junk folder first. If it\'s not there, contact your teacher or administrator to confirm they used the correct email address.'
    },
    {
      id: 'faq-5',
      roles: ['student'],
      q: 'Can I update my name, email, or profile photo?',
      a: 'Yes. Navigate to the My Info tab in the sidebar to update your name, email address, and profile photo at any time.'
    },
    {
      id: 'faq-6',
      roles: ['student'],
      q: 'What happens if two students try to submit a peer evaluation at the same time?',
      a: 'Only the first submission is accepted. The assignment is then automatically marked complete for all remaining group members.'
    },
    {
      id: 'faq-7',
      roles: ['student'],
      q: 'Will my peers know I wrote a specific review about them?',
      a: 'No. All peer feedback is fully anonymous. Peers can see the scores and comments, but the system never reveals who submitted them.'
    },
    {
      id: 'faq-8',
      roles: ['student'],
      q: 'I completed all rubrics but the assignment still shows as incomplete. Why?',
      a: 'Completing the rubrics alone is not enough. You must also click the final Submit button. Filling in rubrics saves your responses, but does not mark the assignment as done.'
    },
    {
      id: 'faq-9',
      roles: ['teacher', 'admin'],
      q: 'Can I add students after a class is already created?',
      a: 'Yes. Go to the Class Details page and use either Add Students via CSV or Add Students by Email at any time.'
    },
    {
      id: 'faq-10',
      roles: ['admin'],
      q: 'Can I change a user\'s role?',
      a: 'Yes. Go to Admin Dashboard -> Manage Users, click Edit next to the user, and select a new role from the dropdown, then click Save.'
    },
    {
      id: 'faq-11',
      roles: ['admin'],
      q: 'Can an administrator delete their own account?',
      a: 'No. The Delete button is intentionally disabled for the currently logged-in administrator to prevent accidental self-deletion.'
    },
    {
      id: 'faq-12',
      roles: ['student', 'teacher', 'admin'],
      q: 'Can I change my password whenever I want?',
      a: 'Yes. Go to the Change Password tab in the sidebar and enter your current password followed by your new one.'
    }
  ];

  const visibleFaqs = faqItems.filter((faq) => faq.roles.includes(activeRole));

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
        <h1>Toodle User Guide</h1>
        <p>Learn how to make the most of peer evaluation and feedback</p>
      </div>

      {/* Role Header */}
      <div className="role-header">
        <span className="role-badge" data-role={userRole}>
          {userRole.charAt(0).toUpperCase() + userRole.slice(1)} Guide
        </span>
      </div>

      {activeRole === 'student' && (
        <section className="role-section active">
          <div className="help-section">
            <h2>Registration</h2>
            <div className="section-divider"></div>
            <div className="help-content">
              <p>When you first visit the site, you'll land on the login/register page. There are two ways to get access:</p>
              <ul className="help-list">
                <li><strong>Pre-registered by your school:</strong> If your administrator has already set up your account, simply log in with the email and password they provided. No registration needed.</li>
                <li><strong>Self-registration:</strong> Click the Register button and fill in your name, email, and a password. As long as your email is not already in the system, your account will be created and you'll be taken straight to the student dashboard.</li>
              </ul>
            </div>
          </div>

          <div className="help-section">
            <h2>Change Password</h2>
            <div className="section-divider"></div>
            <div className="help-content">
              <p>If your school administration registered you with a temporary password, you will be prompted to change it immediately upon first login.</p>
              <div className="callout info">
                <span className="callout-icon">ℹ️</span>
                <span>You can update your password at any time by navigating to the Change Password tab in the sidebar. Enter your current password, then type and confirm your new one.</span>
              </div>
            </div>
          </div>

          <div className="help-section">
            <h2>Student Dashboard</h2>
            <div className="section-divider"></div>
            <div className="help-content">
              <p>After logging in, you'll arrive at your Student Dashboard — a grid of all the classes you're currently enrolled in. Click any class card to open it.</p>
              <div className="callout warn">
                <span className="callout-icon">⚠️</span>
                <span>If you don't see any classes, you haven't been enrolled yet. Contact your teacher or administrator — students cannot self-enroll.</span>
              </div>
            </div>
          </div>

          <div className="help-section">
            <h2>My Info</h2>
            <div className="section-divider"></div>
            <div className="help-content">
              <p>The My Info tab, accessible from the sidebar, lets you personalize your profile. From here you can:</p>
              <ul className="help-list">
                <li>Edit your full name</li>
                <li>Update your email address</li>
                <li>Upload or change a profile photo</li>
              </ul>
              <p>Click the Edit button next to any field to make changes.</p>
            </div>
          </div>

          <div className="help-section">
            <h2>Class View</h2>
            <div className="section-divider"></div>
            <div className="help-content">
              <p>Clicking into a class shows you all assignments created by your teacher. Assignments are split into two sections:</p>
              <ul className="help-list">
                <li><strong>To-do:</strong> Incomplete assignments, displayed with their due dates and urgency labels such as Overdue or Due in 3 days.</li>
                <li><strong>Done:</strong> Assignments you have already submitted, moved here automatically.</li>
              </ul>
              <p>Click the My Group tab at the top to see your group name and fellow members, if your teacher has assigned you to one.</p>
            </div>
          </div>

          <div className="help-section">
            <h2>Assignment Types</h2>
            <div className="section-divider"></div>
            <div className="help-content">
              <p>Your teacher can create three kinds of assignments:</p>
              <div className="type-cards">
                <div className="type-card">
                  <div className="type-card-icon">📄</div>
                  <div className="type-card-name">Standard</div>
                  <div className="type-card-desc">Upload and submit a file. Teacher can download and check if it was on time.</div>
                </div>
                <div className="type-card">
                  <div className="type-card-icon">👤</div>
                  <div className="type-card-name">Individual Peer Eval</div>
                  <div className="type-card-desc">Rate each of your group members individually using a teacher rubric.</div>
                </div>
                <div className="type-card">
                  <div className="type-card-icon">👥</div>
                  <div className="type-card-name">Group Peer Eval</div>
                  <div className="type-card-desc">Your group evaluates every other group in the class using a shared rubric.</div>
                </div>
              </div>
            </div>
          </div>

          <div className="help-section">
            <h2>Completing a Standard Assignment</h2>
            <div className="section-divider"></div>
            <div className="help-content">
              <p>Open the assignment to see its description, any teacher attachments, and the due date. When your work is ready:</p>
              <ul className="help-list">
                <li>Click Choose Files and select your file(s).</li>
                <li>Click Submit to upload. A confirmation banner will appear.</li>
                <li>To replace your submission, upload a new file and click Submit again.</li>
              </ul>
              <div className="callout tip">
                <span className="callout-icon">💡</span>
                <span>The due date area will show how early or late your submission was made, such as Submitted 10 days, 4 hours early.</span>
              </div>
            </div>
          </div>

          <div className="help-section">
            <h2>Completing an Individual Peer Evaluation</h2>
            <div className="section-divider"></div>
            <div className="help-content">
              <p>Navigate to the Peer Review tab. You'll see a list of your group members, each marked Pending.</p>
              <ul className="help-list">
                <li>Click a group member's name to open their rubric.</li>
                <li>Rate them on each criterion and add optional comments.</li>
                <li>Click Submit Review.</li>
                <li>Repeat for all group members.</li>
                <li>Once all rubrics are done, click the final Submit button to complete the assignment.</li>
              </ul>
              <div className="callout warn">
                <span className="callout-icon">⚠️</span>
                <span><strong>Only one group member may submit.</strong> Once submitted, the assignment is automatically marked complete for all other members.</span>
              </div>
              <p>Your feedback is fully anonymous. Peers can view scores and comments in their My Feedback tab, but will never see who wrote them.</p>
            </div>
          </div>

          <div className="help-section">
            <h2>Completing a Group Peer Evaluation</h2>
            <div className="section-divider"></div>
            <div className="help-content">
              <p>Navigate to the Peer Review tab. Your group must evaluate every other group your teacher included in the assignment.</p>
              <ul className="help-list">
                <li>Complete the rubric for each listed group.</li>
                <li>Once all groups are rated, click Submit Peer Evaluation.</li>
              </ul>
              <div className="callout warn">
                <span className="callout-icon">⚠️</span>
                <span>As with individual evaluations, <strong>only one group member</strong> may submit. The rest are automatically marked complete.</span>
              </div>
              <p>Reviewed groups can see your feedback in their My Feedback tab, anonymously.</p>
            </div>
          </div>
        </section>
      )}

      {activeRole === 'teacher' && (
        <section className="role-section active">
          <div className="help-section">
            <h2>Create a Class / Course</h2>
            <div className="section-divider"></div>
            <div className="help-content">
              <p>From the Teacher Dashboard, you'll see all classes assigned to you along with a Create Class tile.</p>
              <ul className="help-list">
                <li>Click Create Class to open the class creation page.</li>
                <li>Type a name into the Class Name field.</li>
                <li>Click Submit.</li>
                <li>A confirmation notification will appear. Return to the dashboard to see your new class.</li>
              </ul>
            </div>
          </div>

          <div className="help-section">
            <h2>Navigate to a Class Details Page</h2>
            <div className="section-divider"></div>
            <div className="help-content">
              <p>Click any class card on the Teacher Dashboard to open its Class Details page. From here you can manage assignments, students, and groups across three tabs: Assignments, Members, and Groups.</p>
            </div>
          </div>

          <div className="help-section">
            <h2>Create an Assignment</h2>
            <div className="section-divider"></div>
            <div className="help-content">
              <ul className="help-list">
                <li>Go to the Assignments tab on the Class Details page.</li>
                <li>Click Create Assignment.</li>
                <li>Fill in the form: select an Assignment Type, enter a Title, optional description, due date, and attachment.</li>
                <li>Click Create to finalize.</li>
              </ul>
              <div className="callout info">
                <span className="callout-icon">ℹ️</span>
                <span>For peer evaluation types, you'll also define the rubric criteria students will use to rate one another.</span>
              </div>
            </div>
          </div>

          <div className="help-section">
            <h2>Delete an Assignment</h2>
            <div className="section-divider"></div>
            <div className="help-content">
              <p>In the Assignments tab, find the assignment you want to remove and click the Delete button next to it.</p>
            </div>
          </div>

          <div className="help-section">
            <h2>Adding Students to a Class</h2>
            <div className="section-divider"></div>
            <div className="help-content">
              <p>From the Class Details page, use one of the top-right buttons:</p>
              <ul className="help-list">
                <li><strong>Add Students via CSV</strong> - Upload a CSV file. Each row must follow the format: id, name, email.</li>
                <li><strong>Add Students by Email</strong> - Enter one or more email addresses directly.</li>
              </ul>
              <div className="callout tip">
                <span className="callout-icon">💡</span>
                <span>Students not already in the system will automatically receive a welcome email with their login credentials.</span>
              </div>
            </div>
          </div>

          <div className="help-section">
            <h2>Removing Students from a Class</h2>
            <div className="section-divider"></div>
            <div className="help-content">
              <p>Go to the Members tab on the Class Details page. Click the Remove button next to the student you want to unenroll.</p>
            </div>
          </div>

          <div className="help-section">
            <h2>Adding a Group</h2>
            <div className="section-divider"></div>
            <div className="help-content">
              <ul className="help-list">
                <li>Go to the Groups tab on the Class Details page.</li>
                <li>Click Create New Group in the top-right corner.</li>
                <li>Enter a group name and check the students to include. Only enrolled students will appear.</li>
                <li>Click Save Group.</li>
              </ul>
            </div>
          </div>

          <div className="help-section">
            <h2>Edit a Group</h2>
            <div className="section-divider"></div>
            <div className="help-content">
              <p>In the Groups tab, click the group name to open its management panel. From here:</p>
              <ul className="help-list">
                <li>To remove a student, click Remove next to their name.</li>
                <li>To add a student, use the Add Student dropdown, select the student, and click Add. The student must already be enrolled in the class.</li>
              </ul>
            </div>
          </div>

          <div className="help-section">
            <h2>Delete a Group</h2>
            <div className="section-divider"></div>
            <div className="help-content">
              <p>In the Groups tab, click the Delete button next to the group you want to remove.</p>
            </div>
          </div>
        </section>
      )}

      {activeRole === 'admin' && (
        <section className="role-section active">
          <div className="help-section">
            <h2>Admin Dashboard</h2>
            <div className="section-divider"></div>
            <div className="help-content">
              <p>After logging in as an administrator, you'll be taken to the Admin Dashboard. From here you can see an overview of all visible classes and assignments, and access two key areas:</p>
              <ul className="help-list">
                <li><strong>Manage Users</strong> - Create, edit, and delete user accounts across all roles.</li>
                <li><strong>Browse Classes</strong> - Inspect any class on the platform.</li>
              </ul>
            </div>
          </div>

          <div className="help-section">
            <h2>Creating a New User</h2>
            <div className="section-divider"></div>
            <div className="help-content">
              <p>From Admin Dashboard, click Manage Users. At the top of the page you'll find the Create new user form.</p>
              <ul className="help-list">
                <li>Enter the user's Name, Email, and a Password.</li>
                <li>Select a role from the dropdown: Student, Teacher, or Administrator.</li>
                <li>Click Create.</li>
              </ul>
              <div className="callout tip">
                <span className="callout-icon">💡</span>
                <span>Assigning a temporary password and letting the user change it on first login is a good security practice.</span>
              </div>
            </div>
          </div>

          <div className="help-section">
            <h2>Editing an Existing User</h2>
            <div className="section-divider"></div>
            <div className="help-content">
              <ul className="help-list">
                <li>In Manage Users, locate the user in the Existing Users table.</li>
                <li>Click Edit next to their row. The row becomes editable inline.</li>
                <li>Update the name, email, or role as needed.</li>
                <li>Click Save.</li>
              </ul>
            </div>
          </div>

          <div className="help-section">
            <h2>Deleting a User</h2>
            <div className="section-divider"></div>
            <div className="help-content">
              <p>In Manage Users, click the Delete button beside the user you want to remove.</p>
              <div className="callout warn">
                <span className="callout-icon">⚠️</span>
                <span>Administrators cannot delete their own account. The Delete button is disabled for the currently logged-in admin to prevent accidental self-deletion.</span>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* GLOSSARY */}
      <div id="glossary" className="help-section">
        <h2>Glossary of Terms</h2>
        <div className="section-divider"></div>
        <div className="glossary-grid">
          <div className="glossary-item">
            <div className="glossary-term">Student</div>
            <div className="glossary-def">A user role with the lowest access level. Can view classes, complete assignments, and submit peer evaluations.</div>
          </div>
          <div className="glossary-item">
            <div className="glossary-term">Teacher</div>
            <div className="glossary-def">Can create and manage classes, assignments, and groups. Can also add or remove students from their classes.</div>
          </div>
          <div className="glossary-item">
            <div className="glossary-term">Administrator</div>
            <div className="glossary-def">Highest access level. Can manage all users, browse all classes, and view anything on the platform.</div>
          </div>
          <div className="glossary-item">
            <div className="glossary-term">Assignment</div>
            <div className="glossary-def">A task created by a teacher within a class. Types: Standard, Individual Peer Evaluation, or Group Peer Evaluation.</div>
          </div>
          <div className="glossary-item">
            <div className="glossary-term">Class / Course</div>
            <div className="glossary-def">A virtual classroom created by a teacher. Students are enrolled by a teacher or administrator.</div>
          </div>
          <div className="glossary-item">
            <div className="glossary-term">Group</div>
            <div className="glossary-def">A subset of students within a class, created and managed by the teacher.</div>
          </div>
          <div className="glossary-item">
            <div className="glossary-term">Rubric</div>
            <div className="glossary-def">A scoring template created by the teacher when setting up a peer evaluation. Students rate peers across defined criteria.</div>
          </div>
          <div className="glossary-item">
            <div className="glossary-term">My Feedback</div>
            <div className="glossary-def">A tab in evaluation assignments where students see anonymous feedback submitted about them by peers.</div>
          </div>
          <div className="glossary-item">
            <div className="glossary-term">Peer Review</div>
            <div className="glossary-def">A tab in evaluation assignments where students complete and submit rubric-based reviews of peers and other groups.</div>
          </div>
          <div className="glossary-item">
            <div className="glossary-term">Temporary Password</div>
            <div className="glossary-def">A password assigned by an administrator during account creation. Must be changed on first login.</div>
          </div>
          <div className="glossary-item">
            <div className="glossary-term">CSV</div>
            <div className="glossary-def">A plain text file format used to bulk-upload students. Each row: id, name, email.</div>
          </div>
          <div className="glossary-item">
            <div className="glossary-term">Standard Assignment</div>
            <div className="glossary-def">Students upload and submit a file. Teachers can download submissions and check timeliness.</div>
          </div>
        </div>
      </div>

      <div id="faq" className="help-section">
        <h2>Frequently Asked Questions</h2>
        <div className="section-divider"></div>
        {visibleFaqs.map((faq) => (
          <div key={faq.id} className={`faq-item ${openFAQs.has(faq.id) ? 'open' : ''}`}>
            <div className="faq-q" onClick={() => toggleFAQ(faq.id)}>
              <span>{faq.q}</span>
              <span className="chevron">▼</span>
            </div>
            <div className="faq-a">{faq.a}</div>
          </div>
        ))}
      </div>

      <div id="permissions" className="help-section">
        <h2>Role Permissions Summary</h2>
        <div className="section-divider"></div>
        <p className="help-content">The table below summarizes what each role is permitted to do within the PeerLens platform.</p>
        <table className="perm-table">
          <thead>
            <tr>
              <th>Action</th>
              <th>Student</th>
              <th>Teacher</th>
              <th>Admin</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Register / log in</td>
              <td><span className="perm-yes">✓</span></td>
              <td><span className="perm-yes">✓</span></td>
              <td><span className="perm-yes">✓</span></td>
            </tr>
            <tr>
              <td>Update own name, email, and profile photo</td>
              <td><span className="perm-yes">✓</span></td>
              <td><span className="perm-yes">✓</span></td>
              <td><span className="perm-yes">✓</span></td>
            </tr>
            <tr>
              <td>Change own password</td>
              <td><span className="perm-yes">✓</span></td>
              <td><span className="perm-yes">✓</span></td>
              <td><span className="perm-yes">✓</span></td>
            </tr>
            <tr>
              <td>View related classes and assignments</td>
              <td><span className="perm-yes">✓</span></td>
              <td><span className="perm-yes">✓</span></td>
              <td><span className="perm-yes">✓</span></td>
            </tr>
            <tr>
              <td>Submit files</td>
              <td><span className="perm-yes">✓</span></td>
              <td><span className="perm-yes">✓</span></td>
              <td><span className="perm-yes">✓</span></td>
            </tr>
            <tr>
              <td>View received peer feedback</td>
              <td><span className="perm-yes">✓</span></td>
              <td><span className="perm-yes">✓</span></td>
              <td><span className="perm-yes">✓</span></td>
            </tr>
            <tr>
              <td>Create and manage classes</td>
              <td><span className="perm-no">—</span></td>
              <td><span className="perm-yes">✓</span></td>
              <td><span className="perm-yes">✓</span></td>
            </tr>
            <tr>
              <td>Create, edit, and delete assignments</td>
              <td><span className="perm-no">—</span></td>
              <td><span className="perm-yes">✓</span></td>
              <td><span className="perm-yes">✓</span></td>
            </tr>
            <tr>
              <td>Add and remove students from a class</td>
              <td><span className="perm-no">—</span></td>
              <td><span className="perm-yes">✓</span></td>
              <td><span className="perm-yes">✓</span></td>
            </tr>
            <tr>
              <td>Create and manage groups</td>
              <td><span className="perm-no">—</span></td>
              <td><span className="perm-yes">✓</span></td>
              <td><span className="perm-yes">✓</span></td>
            </tr>
            <tr>
              <td>Create and manage all users</td>
              <td><span className="perm-no">—</span></td>
              <td><span className="perm-no">—</span></td>
              <td><span className="perm-yes">✓</span></td>
            </tr>
            <tr>
              <td>Browse and inspect all classes</td>
              <td><span className="perm-no">—</span></td>
              <td><span className="perm-no">—</span></td>
              <td><span className="perm-yes">✓</span></td>
            </tr>
            <tr>
              <td>Edit any user's name, email, or role</td>
              <td><span className="perm-no">—</span></td>
              <td><span className="perm-no">—</span></td>
              <td><span className="perm-yes">✓</span></td>
            </tr>
            <tr>
              <td>Delete any user account</td>
              <td><span className="perm-no">—</span></td>
              <td><span className="perm-no">—</span></td>
              <td><span className="perm-yes">✓</span></td>
            </tr>
          </tbody>
        </table>
      </div>

    </div>
  );
}
