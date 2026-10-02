using System;
using System.Net.Http;
using System.Text;
using System.Threading.Tasks;
using System.Collections.Generic;
using System.IO;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using SecureExam.Lockdown;

namespace SecureExam.Services
{
    public static class ApiService
    {
        private static readonly HttpClient client = new HttpClient { BaseAddress = new Uri("http://127.0.0.1:5000"), Timeout = TimeSpan.FromSeconds(8) };
        private static readonly System.Threading.SemaphoreSlim healthCheckLock = new(1, 1);

        public static string? Token { get; set; }
        public static string? UserRole { get; set; }
        public static string? UserId { get; set; }
        public static string? UserName { get; set; }

        public static event Action<string, string>? ViolationLogged;
        public static event Action<bool>? ConnectivityChanged;
        private static readonly string PendingPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "ExamShield", "pending-violations.json");

        public static async Task<bool> CheckHealthAsync()
        {
            if (!await healthCheckLock.WaitAsync(0)) return false;
            try
            {
                using var response = await client.GetAsync("/api/health");
                ConnectivityChanged?.Invoke(response.IsSuccessStatusCode);
                if (response.IsSuccessStatusCode) await FlushPendingViolationsAsync();
                return response.IsSuccessStatusCode;
            }
            catch { ConnectivityChanged?.Invoke(false); return false; }
            finally { healthCheckLock.Release(); }
        }

        private static async Task FlushPendingViolationsAsync()
        {
            try
            {
                if (!File.Exists(PendingPath)) return;
                var records = JsonConvert.DeserializeObject<List<PendingViolation>>(await File.ReadAllTextAsync(PendingPath)) ?? new();
                var unsent = new List<PendingViolation>();
                foreach (var item in records)
                {
                    if (!await SendViolationAsync(item)) unsent.Add(item);
                }
                Directory.CreateDirectory(Path.GetDirectoryName(PendingPath)!);
                await File.WriteAllTextAsync(PendingPath, JsonConvert.SerializeObject(unsent));
            }
            catch { }
        }

        private sealed class PendingViolation { public string clientEventId { get; set; } = Guid.NewGuid().ToString("N"); public string studentTestId { get; set; } = ""; public string type { get; set; } = ""; public string details { get; set; } = ""; public string? screenshotBase64 { get; set; } }

        public static async Task<(bool success, string message)> LoginAsync(string identifier, string password, string role = "STUDENT")
        {
            try
            {
                var body = JsonConvert.SerializeObject(new { identifier, password, role });
                var content = new StringContent(body, Encoding.UTF8, "application/json");

                var response = await client.PostAsync("/api/auth/login", content);
                var responseString = await response.Content.ReadAsStringAsync();

                if (string.IsNullOrWhiteSpace(responseString) || (!responseString.Trim().StartsWith("{") && !responseString.Trim().StartsWith("[")))
                {
                    return (false, "Backend server not responding properly. Please start backend:\ncd D:\\ExamShield\\backend && npm run dev");
                }

                if (!response.IsSuccessStatusCode)
                {
                    var err = JsonConvert.DeserializeObject<dynamic>(responseString);
                    return (false, err?.error?.ToString() ?? "Login failed");
                }

                var data = JsonConvert.DeserializeObject<dynamic>(responseString);
                Token = data?.token?.ToString();
                UserRole = data?.user?.role?.ToString();
                UserId = data?.user?.id?.ToString();
                UserName = data?.user?.name?.ToString();

                return (true, "Login successful");
            }
            catch (Exception ex)
            {
                return (false, $"Connection error: {ex.Message}");
            }
        }

        public static async Task<JArray?> GetStudentAvailableTestsAsync()
        {
            try
            {
                var request = new HttpRequestMessage(HttpMethod.Get, "/api/exam/available");
                request.Headers.Add("Authorization", $"Bearer {Token}");

                var response = await client.SendAsync(request);
                var str = await response.Content.ReadAsStringAsync();

                if (!response.IsSuccessStatusCode || (!str.Trim().StartsWith("[") && !str.Trim().StartsWith("{")))
                    return null;

                var payload = JObject.Parse(str);
                return payload["data"] as JArray;
            }
            catch
            {
                return null;
            }
        }

        public static async Task<(bool success, string? studentTestId, string? error, int maxViolations)> StartExamAsync(string testId)
        {
            try
            {
                var request = new HttpRequestMessage(HttpMethod.Post, $"/api/exam/start/{testId}");
                request.Headers.Add("Authorization", $"Bearer {Token}");
                request.Content = new StringContent("{}", Encoding.UTF8, "application/json");

                var response = await client.SendAsync(request);
                var str = await response.Content.ReadAsStringAsync();

                if (!response.IsSuccessStatusCode || !str.Trim().StartsWith("{"))
                {
                    var errObj = JsonConvert.DeserializeObject<dynamic>(str);
                return (false, null, errObj?.error?.ToString() ?? errObj?.message?.ToString() ?? "Could not start exam", 3);
                }

                var data = JsonConvert.DeserializeObject<dynamic>(str);
                return (true, data?.data?.studentTestId?.ToString(), null, data?.data?.test?.maxViolations?.ToObject<int>() ?? 3);
            }
            catch (Exception ex)
            {
                return (false, null, ex.Message, 3);
            }
        }

        public static async Task ReportViolationAsync(string studentTestId, string violationType, string details)
        {
            var record = new PendingViolation { clientEventId = Guid.NewGuid().ToString("N"), studentTestId = studentTestId, type = violationType, details = details, screenshotBase64 = ScreenshotCapturer.CapturePrimaryScreenBase64() };
            try
            {
                if (await SendViolationAsync(record)) ViolationLogged?.Invoke(violationType, details);
                else await QueueViolationAsync(record);
            }
            catch
            {
                await QueueViolationAsync(record);
            }
        }

        private static async Task<bool> SendViolationAsync(PendingViolation item)
        {
            using var request = new HttpRequestMessage(HttpMethod.Post, "/api/exam/violation");
            request.Headers.Add("Authorization", $"Bearer {Token}");
            request.Content = new StringContent(JsonConvert.SerializeObject(item), Encoding.UTF8, "application/json");
            using var response = await client.SendAsync(request);
            return response.IsSuccessStatusCode;
        }

        private static async Task QueueViolationAsync(PendingViolation item)
        {
            try
            {
                Directory.CreateDirectory(Path.GetDirectoryName(PendingPath)!);
                var records = File.Exists(PendingPath) ? JsonConvert.DeserializeObject<List<PendingViolation>>(await File.ReadAllTextAsync(PendingPath)) ?? new() : new();
                records.Add(item);
                await File.WriteAllTextAsync(PendingPath, JsonConvert.SerializeObject(records));
            }
            catch { }
        }
    }
}
