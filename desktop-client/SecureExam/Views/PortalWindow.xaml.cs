using System;
using System.Windows;
using System.Windows.Controls;
using SecureExam.Services;

namespace SecureExam.Views
{
    public partial class PortalWindow : Window
    {
        private bool loggingOut;
        public PortalWindow()
        {
            InitializeComponent();
            UpdateThemeLabel();
            Title = "ExamShield Portal";
            FacultyNavigation.Visibility = Visibility.Visible;
            AdminNavigation.Visibility = ApiService.UserRole == "ADMIN" ? Visibility.Visible : Visibility.Collapsed;
            Loaded += async (_, _) =>
            {
                await WebView.EnsureCoreWebView2Async();
                WebView.CoreWebView2.Settings.AreDevToolsEnabled = false;
                WebView.Source = new Uri($"http://127.0.0.1:5173/faculty?token={Uri.EscapeDataString(ApiService.Token ?? string.Empty)}");
            };
            Closed += (_, _) => { if (!loggingOut) System.Windows.Application.Current.Shutdown(); };
        }

        private void Theme_Click(object sender, RoutedEventArgs e)
        {
            ThemeManager.Toggle();
            UpdateThemeLabel();
        }

        private void UpdateThemeLabel() => BtnTheme.Content = ThemeManager.IsDark ? "Light mode" : "Dark mode";

        private void Navigate_Click(object sender, RoutedEventArgs e)
        {
            if (sender is System.Windows.Controls.Button { Tag: string path } && WebView.CoreWebView2 is not null)
            {
                var separator = path.Contains('?') ? "&" : "?";
                WebView.CoreWebView2.Navigate($"http://127.0.0.1:5173{path}{separator}token={Uri.EscapeDataString(ApiService.Token ?? string.Empty)}");
            }
        }

        private void Logout_Click(object sender, RoutedEventArgs e)
        {
            loggingOut = true;
            ApiService.Token = null;
            ApiService.UserRole = null;
            ApiService.UserId = null;
            ApiService.UserName = null;
            new LoginWindow().Show();
            Close();
        }
    }
}
