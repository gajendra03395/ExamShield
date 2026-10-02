using System;
using System.Windows;
using Microsoft.Web.WebView2.Core;
using SecureExam.Lockdown;
using SecureExam.Services;
using SocketIOClient;
using System.Text.Json;
using System.Windows.Threading;

namespace SecureExam.Views
{
    public partial class ExamWindow : Window
    {
        private readonly string testId;
        private readonly string studentTestId;
        private readonly int maxViolations;
        private SocketIO? socketClient;
        private readonly DispatcherTimer healthTimer = new() { Interval = TimeSpan.FromSeconds(10) };

        public ExamWindow(string testId, string studentTestId, int maxViolations = 3)
        {
            InitializeComponent();
            this.testId = testId;
            this.studentTestId = studentTestId;
            this.maxViolations = Math.Clamp(maxViolations, 1, 100);

            this.Loaded += ExamWindow_Loaded;
            this.Closed += ExamWindow_Closed;
        }

        private async void ExamWindow_Loaded(object sender, RoutedEventArgs e)
        {
            if (!KioskManager.StartLockdown(this, maxViolations))
            {
                System.Windows.MessageBox.Show($"{KioskManager.LastStartFailure ?? "The required lockdown services could not be started."} The exam cannot start on this device.", "Security setup failed", MessageBoxButton.OK, MessageBoxImage.Error);
                Close();
                return;
            }
            KioskManager.ViolationDetected += OnViolationDetected;
            KioskManager.MaxViolationsExceeded += OnMaxViolationsExceeded;
            healthTimer.Tick += async (_, _) =>
            {
                var healthy = await ApiService.CheckHealthAsync();
                ConnectionBanner.Visibility = healthy ? Visibility.Collapsed : Visibility.Visible;
                if (healthy && socketClient is not null && socketClient.Connected == false)
                {
                    try { await socketClient.ConnectAsync(); } catch { }
                }
            };
            healthTimer.Start();

            socketClient = new SocketIO(new Uri("http://127.0.0.1:5000"), new SocketIOOptions
            {
                Auth = new Dictionary<string, string> { ["token"] = ApiService.Token ?? string.Empty }
            });
            socketClient.On("warning:received", response =>
            {
                var payload = response.GetValue<JsonElement>(0);
                var message = payload.TryGetProperty("message", out var value) ? value.GetString() : null;
                Dispatcher.Invoke(() =>
                {
                    ViolationBanner.Visibility = Visibility.Visible;
                    TxtViolationNotice.Text = $"FACULTY WARNING: {message ?? "Please follow the exam rules."}";
                });
                return Task.CompletedTask;
            });
            socketClient.On("exam:terminated", response => HandleRemoteTermination(response.GetValue<JsonElement>(0)));
            socketClient.On("exam:force_submitted", response => HandleRemoteTermination(response.GetValue<JsonElement>(0)));
            await socketClient.ConnectAsync();

            await WebView.EnsureCoreWebView2Async(null);

            var settings = WebView.CoreWebView2.Settings;
            settings.AreDefaultContextMenusEnabled = false;
            settings.AreDevToolsEnabled = false;
            settings.IsStatusBarEnabled = false;
            settings.AreHostObjectsAllowed = false;
            WebView.CoreWebView2.NavigationStarting += (_, eventArgs) =>
            {
                if (!Uri.TryCreate(eventArgs.Uri, UriKind.Absolute, out var destination) || destination.Scheme != Uri.UriSchemeHttp || destination.Host != "127.0.0.1" || destination.Port != 5173)
                    eventArgs.Cancel = true;
            };
            WebView.CoreWebView2.NewWindowRequested += (_, eventArgs) => eventArgs.Handled = true;
            WebView.CoreWebView2.WebMessageReceived += (_, eventArgs) =>
            {
                if (eventArgs.TryGetWebMessageAsString() == "exam-submitted") Dispatcher.BeginInvoke(Close);
            };

            string url = $"http://127.0.0.1:5173/exam/{Uri.EscapeDataString(studentTestId)}?token={Uri.EscapeDataString(ApiService.Token ?? string.Empty)}&embedded=1";
            WebView.Source = new Uri(url);
        }

        private Task HandleRemoteTermination(JsonElement payload)
        {
            var message = payload.TryGetProperty("message", out var value) ? value.GetString() : null;
            Dispatcher.Invoke(async () =>
            {
                try
                {
                    await WebView.ExecuteScriptAsync("window.autoSubmitExam && window.autoSubmitExam('VIOLATION_LIMIT');");
                }
                catch { }

                KioskManager.StopLockdown();
                this.Title = message ?? "Exam submitted";
                this.Close();
            });
            return Task.CompletedTask;
        }

        private async void OnViolationDetected(string type, string detail)
        {
            Dispatcher.Invoke(() =>
            {
                ViolationBanner.Visibility = Visibility.Visible;
                TxtViolationNotice.Text = $"SECURITY VIOLATION ({KioskManager.ViolationCount}/{KioskManager.MaxViolationsAllowed}): {detail}";
            });

            await ApiService.ReportViolationAsync(studentTestId, type, detail);
        }

        private void OnMaxViolationsExceeded()
        {
            Dispatcher.Invoke(async () =>
            {
                System.Windows.MessageBox.Show("Maximum security violations exceeded. Your exam is being automatically submitted.", 
                                "Exam Terminated", MessageBoxButton.OK, MessageBoxImage.Stop);

                try
                {
                    await WebView.ExecuteScriptAsync("window.autoSubmitExam && window.autoSubmitExam('VIOLATION_LIMIT');");
                }
                catch { }

                this.Close();
            });
        }

        private void ExamWindow_Closed(object? sender, EventArgs e)
        {
            KioskManager.ViolationDetected -= OnViolationDetected;
            KioskManager.MaxViolationsExceeded -= OnMaxViolationsExceeded;
            KioskManager.StopLockdown();
            healthTimer.Stop();
            if (socketClient is not null)
            {
                _ = socketClient.DisconnectAsync();
                socketClient.Dispose();
                socketClient = null;
            }

            DashboardWindow dashboard = new DashboardWindow();
            dashboard.Show();
        }
    }
}
