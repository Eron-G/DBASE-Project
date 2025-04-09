-- Active: 1743941951662@@127.0.0.1@3306
CREATE DATABASE FProject;
USE FProject;

CREATE TABLE Faculty (
    Faculty_ID INT PRIMARY KEY AUTO_INCREMENT,
    Faculty_Name VARCHAR(200) NOT NULL,
    Faculty_Status ENUM('Active', 'Inactive', 'Retired') NOT NULL,
    User_ID INT,
    Created_At TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    Updated_At TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX (Faculty_Status),
    FOREIGN KEY (User_ID) REFERENCES Account(User_ID) ON DELETE CASCADE
);


CREATE TABLE Development_Program (
    Program_ID INT PRIMARY KEY AUTO_INCREMENT,
    Program_Type VARCHAR(100) NOT NULL,
    Program_Title VARCHAR(255) NOT NULL,
    Program_Start_Date DATE NOT NULL,
    Program_End_Date DATE NOT NULL,
    Program_Start_Time TIME NOT NULL,
    Program_End_Time TIME NOT NULL,
    Program_Organizer VARCHAR(255) NOT NULL,
    Key_Takeaways TEXT,
    Created_At TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    Updated_At TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX (Program_Type),
    INDEX (Program_Start_Date),
    INDEX (Program_End_Date)
);
CREATE TABLE Faculty_Program (
    Faculty_ID INT NOT NULL,
    Program_ID INT NOT NULL,
    Participation_Status ENUM('Registered', 'Ongoing', 'Completed') DEFAULT 'Registered',
    Created_At TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    Updated_At TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (Faculty_ID) REFERENCES Faculty(Faculty_ID) ON DELETE CASCADE,
    FOREIGN KEY (Program_ID) REFERENCES Development_Program(Program_ID) ON DELETE CASCADE,
    INDEX (Participation_Status),
    INDEX (Faculty_ID),
    INDEX (Program_ID)
);

CREATE TABLE Account (
    User_ID INT PRIMARY KEY AUTO_INCREMENT,
    First_Name VARCHAR(100) NOT NULL,
    Last_Name VARCHAR(100) NOT NULL,
    Email VARCHAR(255) NOT NULL UNIQUE,
    Password_Hash VARCHAR(255) NOT NULL,
    Role ENUM('admin', 'faculty') NOT NULL DEFAULT 'faculty',
    Created_At TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    Updated_At TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);





