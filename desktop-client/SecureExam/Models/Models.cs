using System;
using System.Collections.Generic;

namespace SecureExam.Models
{
    public class LoginRequest
    {
        public string identifier { get; set; } = string.Empty;
        public string password { get; set; } = string.Empty;
    }

    public class UserData
    {
        public string id { get; set; } = string.Empty;
        public string name { get; set; } = string.Empty;
        public string email { get; set; } = string.Empty;
        public string enrollmentNo { get; set; } = string.Empty;
        public string batch { get; set; } = string.Empty;
        public string division { get; set; } = string.Empty;
        public string role { get; set; } = string.Empty;
    }

    public class LoginResponse
    {
        public string token { get; set; } = string.Empty;
        public UserData user { get; set; } = new UserData();
    }

    public class ExamTestItem
    {
        public string id { get; set; } = string.Empty;
        public string title { get; set; } = string.Empty;
        public string subject { get; set; } = string.Empty;
        public string facultyName { get; set; } = string.Empty;
        public int duration { get; set; }
        public int totalMarks { get; set; }
        public string status { get; set; } = string.Empty;
    }
}