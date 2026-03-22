USE cosc471;

-- Create all tables without foreign keys
CREATE TABLE User (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    hash_pass VARCHAR(128) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'teacher', 'admin'))
);

CREATE TABLE Course (
    id SERIAL PRIMARY KEY,
    teacherID INT NOT NULL,
    name VARCHAR(255)
);

CREATE TABLE Assignment (
    id SERIAL PRIMARY KEY,
    courseID INT,
    name VARCHAR(255),
    rubric VARCHAR(255),
    due_date TIMESTAMP NULL
);

CREATE TABLE CourseGroup (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255),
    assignmentID INT NOT NULL
);

CREATE TABLE Submission (
    id SERIAL PRIMARY KEY,
    path VARCHAR(255),
    studentID INT NOT NULL,
    assignmentID INT NOT NULL
);

CREATE TABLE Group_Members (
    groupID INT,
    userID INT,
    assignmentID INT,
    PRIMARY KEY (userID, groupID)
);

CREATE TABLE User_Courses (
    courseID INT,
    userID INT,
    PRIMARY KEY (userID, courseID)
);

CREATE TABLE Review (
    id SERIAL PRIMARY KEY,
    assignmentID INT NOT NULL,
    reviewerID INT NOT NULL,
    revieweeID INT NOT NULL
);

CREATE TABLE Criterion (
    id SERIAL PRIMARY KEY,
    reviewID INT NOT NULL,
    criterionRowID INT NOT NULL,
    grade INT,
    comments VARCHAR(255)
);

CREATE TABLE Rubric (
    id SERIAL PRIMARY KEY,
    assignmentID INT NOT NULL,
    canComment BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE Criteria_Description (
    id SERIAL PRIMARY KEY,
    rubricID INT NOT NULL,
    question VARCHAR(255),
    scoreMax INT
);

-- TEST VALUES
-- Credentials: test / 1234
INSERT INTO User (id, name, email, role, hash_pass)
  VALUES (1, 'test', 'test@test.com', 'student', 'd404559f602eab6fd602ac7680dacbfaadd13630335e951f097af3900e9de176b6db28512f2e000b9d04fba5133e8b1c6e8df59db3a8ab9d60be4b97cc9e81db'),
         (2, 'test2', 'test2@test.com', 'teacher', 'd404559f602eab6fd602ac7680dacbfaadd13630335e951f097af3900e9de176b6db28512f2e000b9d04fba5133e8b1c6e8df59db3a8ab9d60be4b97cc9e81db'),
         (3, 'admin', 'admin@test.com', 'admin', 'd404559f602eab6fd602ac7680dacbfaadd13630335e951f097af3900e9de176b6db28512f2e000b9d04fba5133e8b1c6e8df59db3a8ab9d60be4b97cc9e81db');
INSERT INTO Assignment(id, courseID, name, rubric)
    VALUES (1, 1, 'test', 'test-rubric');

-- Insert dummy Users (Students and Teachers)
-- actually make them hashed passwords, these wont login the dummy users (itll de-hash "hashedpassword2" instead of husidhgjashkjyh;y23421g)
INSERT INTO User (name, email, hash_pass, role)
VALUES 
    ('JDoe', 'john.doe@example.com', '639675e26fc7399c0a1d61ee59eebfd5dab73fad055999f83105790758713af02ea6cb1afbc1be9f6f3ca2ea48327026218383713c8e0e18530b52c9dc147a1b', 'student'),
    ('Jane Smith', 'jane.smith@example.com', 'hashedpassword2', 'student'),
    ('Robert Brown', 'robert.brown@example.com', 'hashedpassword3', 'student'),
    ('Mary Johnson', 'mary.johnson@example.com', 'hashedpassword4', 'student'),
    ('William Harris', 'william.harris@example.com', 'hashedpassword5', 'teacher'),
    ('Emily White', 'emily.white@example.com', 'hashedpassword6', 'student'),
    ('James Clark', 'james.clark@example.com', 'hashedpassword7', 'student'),
    ('Linda Lewis', 'linda.lewis@example.com', 'hashedpassword8', 'teacher'),
    ('Michael Walker', 'michael.walker@example.com', 'hashedpassword9', 'student'),
    ('Sarah Hall', 'sarah.hall@example.com', 'hashedpassword10', 'student');

-- Insert dummy Courses
INSERT INTO Course (teacherID, name)
VALUES
    (5, 'Introduction to Computer Science'),
    (5, 'Data Structures'),
    (6, 'Databases 101'),
    (6, 'Software Engineering'),
    (5, 'Computer Networks');

-- Insert dummy Assignments
INSERT INTO Assignment (courseID, name, rubric)
VALUES
    (1, 'Assignment 1', 'Basic Programming Concepts'),
    (1, 'Assignment 2', 'OOP Principles'),
    (2, 'Assignment 1', 'Arrays and Linked Lists'),
    (2, 'Assignment 2', 'Stacks and Queues'),
    (3, 'Assignment 1', 'SQL Basics'),
    (3, 'Assignment 2', 'Advanced Queries'),
    (4, 'Assignment 1', 'Software Design Patterns'),
    (4, 'Assignment 2', 'Agile Methodology'),
    (5, 'Assignment 1', 'TCP/IP Basics'),
    (5, 'Assignment 2', 'Routing Protocols');

-- Insert dummy CourseGroups
INSERT INTO CourseGroup (name, assignmentID)
VALUES
    ('Group A', 1),
    ('Group B', 1),
    ('Group B', 2),
    ('Group C', 3),
    ('Group D', 4),
    ('Group E', 5);

-- Insert dummy Submissions
INSERT INTO Submission (path, studentID, assignmentID)
VALUES
    ('/submissions/john_doe/assignment1.pdf', 1, 1),
    ('/submissions/jane_smith/assignment2.pdf', 2, 2),
    ('/submissions/robert_brown/assignment1.pdf', 3, 3),
    ('/submissions/mary_johnson/assignment2.pdf', 4, 4),
    ('/submissions/william_harris/assignment1.pdf', 5, 5);

-- Insert dummy Group_Members
INSERT INTO Group_Members (groupID, userID, assignmentID)
VALUES
    (1, 1, 1),
    (1, 2, 1),
    (1, 3, 1),
    (2, 4, 1),
    (2, 5, 1);


-- Insert dummy User_Courses
INSERT INTO User_Courses (courseID, userID)
VALUES
    (1, 1),
    (1, 2),
    (1, 3),
    (1, 4),
    (1, 5);

-- Insert dummy Reviews
/* INSERT INTO Review (assignmentID, reviewerID, revieweeID)
VALUES
    (1, 1, 2),
    (2, 3, 4),
    (3, 5, 1),
    (4, 2, 3),
    (5, 4, 5); */

-- Insert dummy Criterion rows
/* INSERT INTO Criterion (reviewID, grade, comments)
VALUES
    (1, 85, 'Good job!'),
    (2, 90, 'Excellent work!'),
    (3, 75, 'Needs improvement'),
    (4, 88, 'Well done!'),
    (5, 92, 'Great submission!');
 */
-- Insert dummy Rubrics
/* INSERT INTO Rubric (assignmentID)
VALUES
    (1),
    (2),
    (3),
    (4),
    (5); */

-- Insert dummy Criteria_Description rows
/* INSERT INTO Criteria_Description (rubricID, question, scoreMax)
VALUES
    (1, 'Overall contribution', 100),
    (1, 'Communication', 100),
    (2, 'Timeliness', 100),
    (2, 'Technical quality', 100),
    (3, 'Peer support', 100); */
-- -- Add foreign key constraints
-- ALTER TABLE Assignment
--     ADD CONSTRAINT fk_assignment_course
--     FOREIGN KEY (courseID) REFERENCES Course(id);

-- ALTER TABLE CourseGroup
--     ADD CONSTRAINT fk_coursegroup_assignment
--     FOREIGN KEY (assignmentID) REFERENCES Assignment(id);

-- ALTER TABLE Submission
--     ADD CONSTRAINT fk_submission_student
--     FOREIGN KEY (studentID) REFERENCES User(id),
--     ADD CONSTRAINT fk_submission_assignment
--     FOREIGN KEY (assignmentID) REFERENCES Assignment(id);

-- ALTER TABLE Group_Members
--     ADD CONSTRAINT fk_groupmembers_user
--     FOREIGN KEY (userID) REFERENCES User(id),
--     ADD CONSTRAINT fk_groupmembers_group
--     FOREIGN KEY (groupID) REFERENCES CourseGroup(id);

-- ALTER TABLE User_Courses
--     ADD CONSTRAINT fk_usercourses_user
--     FOREIGN KEY (userID) REFERENCES User(id),
--     ADD CONSTRAINT fk_usercourses_course
--     FOREIGN KEY (courseID) REFERENCES Course(id);

-- ALTER TABLE Review
--     ADD CONSTRAINT fk_review_assignment
--     FOREIGN KEY (assignmentID) REFERENCES Assignment(id),
--     ADD CONSTRAINT fk_review_reviewer
--     FOREIGN KEY (reviewerID) REFERENCES User(id),
--     ADD CONSTRAINT fk_review_reviewee
--     FOREIGN KEY (revieweeID) REFERENCES User(id);

-- ALTER TABLE Criterion
--     ADD CONSTRAINT fk_criteria_review
--     FOREIGN KEY (reviewID) REFERENCES Review(id);

-- ALTER TABLE Rubric
--     ADD CONSTRAINT fk_rubric_assignment
--     FOREIGN KEY (assignmentID) REFERENCES Assignment(id);