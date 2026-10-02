using System.Windows;
using SecureExam.Services;

namespace SecureExam.Views
{
    public partial class LoginWindow : Window
    {
        public LoginWindow()
        {
            InitializeComponent();
            UpdateThemeLabel();
            CmbRole.SelectionChanged += (_, _) => TxtIdentifierLabel.Text = SelectedRole() == "STUDENT" ? "Enrollment No / Email" : "Email";
        }

        private void Theme_Click(object sender, RoutedEventArgs e)
        {
            ThemeManager.Toggle();
            UpdateThemeLabel();
        }

        private void UpdateThemeLabel() => BtnTheme.Content = ThemeManager.IsDark ? "Light mode" : "Dark mode";

        private string SelectedRole() => (CmbRole.SelectedItem as System.Windows.Controls.ComboBoxItem)?.Tag?.ToString() ?? "STUDENT";

        private async void BtnLogin_Click(object sender, RoutedEventArgs e)
        {
            TxtError.Text = "";
            BtnLogin.IsEnabled = false;

            string id = TxtIdentifier.Text.Trim();
            string pass = TxtPassword.Password;

            if (string.IsNullOrEmpty(id) || string.IsNullOrEmpty(pass))
            {
                TxtError.Text = "Please fill in all fields.";
                BtnLogin.IsEnabled = true;
                return;
            }

            var (success, message) = await ApiService.LoginAsync(id, pass, SelectedRole());

            if (success)
            {
                if (ApiService.UserRole == "STUDENT") new DashboardWindow().Show();
                else new PortalWindow().Show();
                this.Close();
            }
            else
            {
                TxtError.Text = message;
                BtnLogin.IsEnabled = true;
            }
        }
    }
}
