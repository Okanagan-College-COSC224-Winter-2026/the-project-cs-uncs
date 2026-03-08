# User Stories

<!-- markdownlint-disable MD024 -->

## US1 – Student Peer Review Access — **✅ COMPLETED**

**As a student, I want to be able to access a set number of assignments assigned by my instructor, so that I can provide feedback on my classmates' work.**

### Assumptions and Details

- User is signed in with valid credentials  
- User is enrolled in a class that uses the peer review system  
- Instructor has created the assignment  
- Instructor has assigned peer reviews to this student  
- Review window is currently open  

### Capabilities and Acceptance Criteria

- [x] Student can view a list of peer assignments to review  
- [x] Number of visible assignments matches what was assigned  
- [x] Student cannot open unassigned submissions  
- [x] Opening an assigned submission shows the content and review interface  
- [x] Submitted feedback marks that review as complete  
- [x] If the review period has ended, the student cannot submit feedback and is notified  

**Implementation**: See `docs/US1_COMPLETE.md` and `docs/US1_IMPLEMENTATION.md` for full details.  
**Tests**: 19 tests passing (100% coverage)  
**Date Completed**: February 22, 2026

---

## US2 – Group Contribution Evaluation — **Backlog**

**As a student, I want to evaluate my peers' contributions in group projects, so that individual efforts are recognized fairly.**

### Assumptions and Details

- User is signed in with valid credentials  
- User is part of a group assignment  
- Instructor has enabled peer evaluation for this project  
- Review period is active  

### Capabilities and Acceptance Criteria

- [ ] Student can see a list of group members  
- [ ] Student can submit ratings and comments for each group member  
- [ ] Submitted feedback is stored and visible to the instructor  
- [ ] Once submitted, an evaluation cannot be edited  
- [ ] If the review period is closed, submission is blocked  

---

## US3 – Anonymous Peer Review Process — **Backlog**

**As an instructor, I want the peer review process to be fair and anonymous, so that the system promotes collaboration, accountability, and skill development among students.**

### Assumptions and Details

- Instructor is signed in  
- Instructor has at least one class with enrolled students  
- Peer reviews have been generated and assigned  
- System supports anonymous display of reviewer and reviewee  

### Capabilities and Acceptance Criteria

- [ ] Students cannot see the names of their reviewers  
- [ ] Students cannot see the names of the students they reviewed after submission  
- [ ] Instructor can see who reviewed whom  
- [ ] Instructor can view completion status for all assigned peer reviews  

---

## US4 – Class and Assignment Creation — **Complete**

**As an instructor, I want to be able to create classes and associated assignments with evaluation events, so that I can provide my students with evaluation and review materials.**

### Assumptions and Details

- Instructor is signed in  
- Instructor has permission to create or manage classes  

### Capabilities and Acceptance Criteria

- [ ] Instructor can create a class  
- [ ] Instructor can create an assignment under that class  
- [ ] Students in that class can see the assignment  
- [ ] Instructor can edit or delete the assignment before its start or due date  

---

## US5 – Student Progress Dashboard — **Backlog**

**As an instructor, I want a comprehensive view of student progress, so that I can effectively assess both individual and group performances.**

### Assumptions and Details

- Instructor is signed in  
- Students have submitted assignments and/or peer reviews  
- There is at least one active assignment in the class  

### Capabilities and Acceptance Criteria

- [ ] Instructor can see per-student submission status  
- [ ] Instructor can see per-assignment submission status  
- [ ] Instructor can see per-student review completion status  

---

## US6 – System Maintenance and Management — **Complete**

**As an administrator, I want the ability to maintain and manage the system, so that I can ensure it remains stable and updated.**

### Assumptions and Details

- Admin is signed in with admin privileges  
- System is running  

### Capabilities and Acceptance Criteria

- [ ] Admin can view all user accounts  
- [ ] Admin can view system logs  
- [ ] Admin-only options are not visible to non-admin users  
- [ ] Admin has access to project files  

---

## US7 – User Registration — **Complete**

**As a user, I want to create an account using my name, email, and password so that I can securely log in to the peer review platform.**

### Assumptions and Details

- User is on the registration page  
- Email address is not already in use  
- Network connection is available  

### Capabilities and Acceptance Criteria

- [ ] Registration form requires name, email, and password  
- [ ] System validates email format and password strength  
- [ ] On success, the user is created in the system  
- [ ] User can log in afterward with those credentials  

---

## US8 – Cross-Platform Accessibility — **In-Progress**

**As a user, I want to be able to access the system on both desktop and mobile, so that I can use whatever device I have available to me.**

### Assumptions and Details

- User has valid credentials  
- User has internet access  
- Application has a responsive UI  

### Capabilities and Acceptance Criteria

- [ ] UI renders correctly on common desktop resolutions  
- [ ] UI renders correctly on common mobile resolutions  
- [ ] Core actions work on both form factors  

---

## US9 – Assignment Management Interface — **In-Progress**

**As an instructor, I want a simple interface for managing assignments and reviews, so that I can use the system easily and save time.**

### Assumptions and Details

- Instructor is signed in  
- Instructor already has at least one class  
- There are assignments to manage  

### Capabilities and Acceptance Criteria

- [ ] Instructor can view all assignments for a class in one place  
- [ ] Instructor can open an assignment and view its peer review settings  
- [ ] Instructor can edit or delete an assignment from the same interface  
- [ ] Actions provide clear success or error messages  

---

## US10 – Data Privacy and Security — **Complete**

**As a system administrator, I want to ensure student data is protected by clear privacy guidelines, so that all users' information remains secure.**

### Assumptions and Details

- Admin is signed in  
- System has role-based access control  
- Organization has a privacy and security policy  

### Capabilities and Acceptance Criteria

- [ ] Sensitive data is only visible to authorized roles  
- [ ] Data in transit is protected  

---

## US11 – Rubric Creation — **In-Progress**

**As an instructor, I want to be able to create a rubric, so that students have a set of criteria to mark against.**

### Assumptions and Details

- Instructor is signed in  
- Instructor has an assignment to attach the rubric to  
- Rubric builder UI is available  

### Capabilities and Acceptance Criteria

- [ ] Instructor can add multiple rubric criteria  
- [ ] Instructor can set scale or score for each criterion  
- [ ] Instructor can save the rubric and attach it to an assignment  
- [ ] Students see that rubric when performing a peer review  

---

## US12 – Student Feedback Viewing — **Backlog**

**As a student, I want to be able to view the feedback I receive from my peers, so that I can understand how to improve my work.**

### Assumptions and Details

- Student is signed in  
- Student has submitted an assignment that was peer reviewed  

### Capabilities and Acceptance Criteria

- [ ] Student can open an assignment and see received feedback  
- [ ] Feedback shows rubric scores and comments  
- [ ] Feedback remains available after viewing  

---

## US13 – Teacher Change Password — **Backlog**

**As a teacher, I want to change my password so that I can update my login information.**

### Assumptions and Details

- Teacher has a current password  
- A workflow to change the password exists  

### Capabilities and Acceptance Criteria

- [ ] Given the teacher has a current password, when they submit a password change, the system updates it successfully  
- [ ] Teacher receives confirmation that the password change occurred  
- [ ] Updated credentials allow the teacher to log in immediately  

---

## US14 – Teacher Dashboard Visibility — **In-Progress**

**As a teacher, I want to see my dashboard so that I can view my teaching-related items.**

### Assumptions and Details

- A dashboard exists for teachers  
- Teacher has at least one teaching-related item  

### Capabilities and Acceptance Criteria

- [ ] Given the teacher has accessed the system, when they open the dashboard, the expected widgets appear  
- [ ] Dashboard reflects real-time data for the teacher’s classes and assignments  
- [ ] Access to the dashboard respects teacher permissions  

---

## US15 – Course Page Shows Assignments — **In-Progress**

**As a teacher, I want my dashboard to show my courses and their assignments so that I can see what I have created.**

### Assumptions and Details

- Courses exist  
- Assignments exist for those courses  

### Capabilities and Acceptance Criteria

- [ ] Given the teacher has created courses and assignments, the dashboard lists each course  
- [ ] Each course entry shows the assignments associated with it  
- [ ] Assignment listings include key metadata such as due dates or status  

---

## US16 – Student Login After Roster Upload — **Complete**

**As a student, I want to log in after my teacher uploads the roster so that I can access the system.**

### Assumptions and Details

- Student is included on a roster  
- Logging in is possible  

### Capabilities and Acceptance Criteria

- [ ] Given the student is on the roster, when they log in, the system authenticates them successfully  
- [ ] Student gains access to the courses tied to that roster  
- [ ] Student receives guidance if they are missing from the roster  

---

## US17 – Student Course Search — **Backlog**

**As a student, I want to search for my course so that I can find it easily.**

### Assumptions and Details

- A course exists to be found  
- Search UI is available  

### Capabilities and Acceptance Criteria

- [ ] Given a course exists, when the student searches by name or code, the course appears in the results  
- [ ] Search results include essential course metadata  
- [ ] Search handles no-result scenarios with clear messaging  

---

## US18 – Student Registration (Roster-Matched) — **Backlog**

**As a student, I want to register if my email is already part of the course roster so that I can join my course.**

### Assumptions and Details

- Student’s email appears in the roster  
- Registration is possible  

### Capabilities and Acceptance Criteria

- [ ] Given the student’s email is on the roster, when they register, the system links them to the course automatically  
- [ ] Student receives confirmation of successful registration  
- [ ] Duplicate registrations are prevented  

---

## US19 – Student Access Registered Courses — **In-Progress**

**As a student, I want to view courses I am registered for so that I can access course content.**

### Assumptions and Details

- Student is registered for courses  

### Capabilities and Acceptance Criteria

- [ ] Given the student is registered for courses, their dashboard lists those courses after login  
- [ ] Each course link opens the associated content  
- [ ] If no courses exist, the student sees a helpful empty state  

---

## US20 – Student Course Grade on Course Card — **Backlog**

**As a student, I want to see my total grade on each course card so that I know how I am performing.**

### Assumptions and Details

- Student has a total grade for the course  

### Capabilities and Acceptance Criteria

- [ ] Given the student has a total grade, the course card displays it prominently  
- [ ] Grade data updates as new scores are recorded  
- [ ] Course cards indicate when grade data is unavailable  

---

## US21 – Student Profile Viewing — **Complete**

**As a student, I want to see my profile information so that I can confirm my details.**

### Assumptions and Details

- Student has profile information stored  

### Capabilities and Acceptance Criteria

- [ ] Given the student has profile information, the profile page shows their details  
- [ ] Profile data includes name, email, and role  
- [ ] Students can request corrections if data is inaccurate  

---

## US22 – Student View Team Submissions — **Backlog**

**As a student, I want to see the submitted assignments from my team members so that I can review their work.**

### Assumptions and Details

- Student has team members  
- Team members have submitted assignments  

### Capabilities and Acceptance Criteria

- [ ] Given submitted assignments from team members exist, the student can view them in a single place  
- [ ] Access is limited to the student’s own team  
- [ ] Each submission shows status, timestamp, and attachments  

---

## US23 – Peer Review Team Members — **Backlog**

**As a student, I want to peer review my team members privately so that I can evaluate their contributions.**

### Assumptions and Details

- Student has team members  
- Peer reviews are allowed  

### Capabilities and Acceptance Criteria

- [ ] Given the student has team members, they can submit a private review for each member  
- [ ] Submitted reviews remain hidden from other students  
- [ ] Instructor can monitor completion of the peer reviews  

---

## US24 – Developer Documentation — **Complete**

**As a developer, I want instructions on how to start and test the project with mock credentials so that I can work on the system.**

### Assumptions and Details

- Documentation is provided  
- Mock credentials exist  

### Capabilities and Acceptance Criteria

- [ ] Given a developer needs to start and test the project, the documentation walks through setup  
- [ ] Developer can run the project locally with mock credentials  
- [ ] Documentation covers testing workflows and expected results  

---

## US25 – Teacher Account Provisioning — **Backlog**

**As an administrator, I want to create teacher accounts so that instructors can access the system with the correct permissions.**

### Assumptions and Details

- Admin is signed in with admin privileges  
- Teacher accounts require a name, institutional email, and temporary password  
- System enforces role-based access control  

### Capabilities and Acceptance Criteria

- [ ] Admin can create a teacher account with required fields  
- [ ] System prevents duplicate teacher emails  
- [ ] Newly created teachers receive the `teacher` role automatically  
- [ ] Admin receives confirmation that the account was created  
- [ ] Teacher can log in with the provided credentials and is prompted to change the temporary password  

---

## US26 – Admin User Management — **Backlog**

**As an administrator, I want to manage user accounts from the admin dashboard so that I can keep the user base accurate and up to date.**

### Assumptions and Details

- Admin is signed in and on the admin dashboard  
- System exposes CRUD operations over users via the frontend  
- Role-based access control enforces that only admins can perform these actions  

### Capabilities and Acceptance Criteria

- [ ] Admin can view a paginated or filterable list of all users  
- [ ] Admin can create a new user and assign an initial role  
- [ ] Admin can edit an existing user’s name, email, or role  
- [ ] Admin can deactivate or delete a user, with safeguards against self-deletion  
- [ ] Admin receives success or error feedback for each action  
- [ ] All actions go through the frontend admin page and persist to the backend

