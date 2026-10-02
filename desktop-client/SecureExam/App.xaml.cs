using System;
using System.Windows;

namespace SecureExam
{
    public partial class App : System.Windows.Application
    {
        protected override void OnStartup(StartupEventArgs e)
        {
            Services.ThemeManager.Initialize();
            base.OnStartup(e);
        }

        protected override void OnExit(ExitEventArgs e)
        {
            SecureExam.Lockdown.KioskManager.StopLockdown();
            base.OnExit(e);
        }
    }
}
