using System;
using System.Collections.Generic;
using System.Windows;
using System.Windows.Controls;
using SecureExam.Lockdown;
using SecureExam.Services;
using System.Windows.Threading;

namespace SecureExam.Views
{
    public partial class DashboardWindow : Window
    {
        private readonly DispatcherTimer syncTimer = new() { Interval = TimeSpan.FromSeconds(10) };
        public DashboardWindow()
        {
            InitializeComponent();
            UpdateThemeLabel();
            TxtWelcome.Text = $"Welcome, {ApiService.UserName ?? "Student"}!";
            _ = LoadTestsAsync();
            syncTimer.Tick += async (_, _) => await ApiService.CheckHealthAsync();
            syncTimer.Start();
            Closed += (_, _) => syncTimer.Stop();
        }

        private void Theme_Click(object sender, RoutedEventArgs e)
        {
            ThemeManager.Toggle();
            UpdateThemeLabel();
        }

        private void UpdateThemeLabel() => BtnTheme.Content = ThemeManager.IsDark ? "Light mode" : "Dark mode";

        private async Task LoadTestsAsync()
        {
            try
            {
                var tests = await ApiService.GetStudentAvailableTestsAsync();
                if (tests == null) return;
                var testList = new List<dynamic>();
                foreach (var t in tests)
                {
                    int durationMins = t["durationMinutes"]?.ToObject<int>() ?? 0;
                    testList.Add(new
                    {
                        id = t["id"]?.ToString(),
                        title = t["title"]?.ToString(),
                        description = t["description"]?.ToString() ?? "No description provided",
                        durationStr = $"Duration: {durationMins} Mins",
                        canStart = t["canStart"]?.ToObject<bool>() ?? false
                    });
                }
                LstTests.ItemsSource = testList;
            }
            catch (Exception ex)
            {
                System.Windows.MessageBox.Show($"Unable to refresh exams: {ex.Message}", "Refresh", MessageBoxButton.OK, MessageBoxImage.Warning);
            }
        }

        private async void Refresh_Click(object sender, RoutedEventArgs e)
        {
            var refreshButton = sender as System.Windows.Controls.Button;
            if (refreshButton is not null) refreshButton.IsEnabled = false;
            try { await LoadTestsAsync(); }
            finally { if (refreshButton is not null) refreshButton.IsEnabled = true; }
        }

        private async void ResultsTab_Loaded(object sender, RoutedEventArgs e)
        {
            try
            {
                await ResultsWebView.EnsureCoreWebView2Async();
                var token = Uri.EscapeDataString(ApiService.Token ?? string.Empty);
                ResultsWebView.Source = new Uri($"http://127.0.0.1:5173/student/results?token={token}");
            }
            catch (Exception ex)
            {
                System.Windows.MessageBox.Show($"Unable to open student results: {ex.Message}", "Results", MessageBoxButton.OK, MessageBoxImage.Warning);
            }
        }

        private async void BtnStartExam_Click(object sender, RoutedEventArgs e)
        {
            if (sender is System.Windows.Controls.Button btn && btn.Tag != null)
            {
                string testId = btn.Tag.ToString()!;

                var (passes, reason) = KioskManager.PerformPreCheck();
                if (!passes)
                {
                    System.Windows.MessageBox.Show($"Security Check Failed:\n\n{reason}", "Lockdown System Check", MessageBoxButton.OK, MessageBoxImage.Warning);
                    return;
                }

                btn.IsEnabled = false;

                var (success, studentTestId, error, maxViolations) = await ApiService.StartExamAsync(testId);
                if (success && !string.IsNullOrEmpty(studentTestId))
                {
                    ExamWindow examWindow = new ExamWindow(testId, studentTestId, maxViolations);
                    examWindow.Show();
                    this.Close();
                }
                else
                {
                    System.Windows.MessageBox.Show(error ?? "Unable to launch exam session.", "Error", MessageBoxButton.OK, MessageBoxImage.Error);
                    btn.IsEnabled = true;
                }
            }
        }

        private void Logout_Click(object sender, RoutedEventArgs e)
        {
            ApiService.Token = null;
            ApiService.UserRole = null;
            ApiService.UserId = null;
            ApiService.UserName = null;
            LoginWindow login = new LoginWindow();
            login.Show();
            this.Close();
        }
    }
}
