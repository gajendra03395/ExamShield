using System;
using System.Windows;
using System.Windows.Threading;

namespace SecureExam.Lockdown
{
    public static class WindowMonitor
    {
        private static DispatcherTimer? timer;
        private static Window? targetWindow;
        private static bool focusWasLost;
        public static event Action<string>? OnFocusLost;

        public static void Start(Window window)
        {
            targetWindow = window;
            focusWasLost = false;
            timer = new DispatcherTimer { Interval = TimeSpan.FromMilliseconds(500) };
            timer.Tick += CheckFocus;
            timer.Start();
        }

        public static void Stop()
        {
            timer?.Stop();
            timer = null;
            targetWindow = null;
            focusWasLost = false;
        }

        private static void CheckFocus(object? sender, EventArgs e)
        {
            if (targetWindow == null) return;
            if (targetWindow.IsActive)
            {
                focusWasLost = false;
                return;
            }
            if (!focusWasLost) OnFocusLost?.Invoke("Window focus lost or user tried to switch apps");
            focusWasLost = true;
            targetWindow.Topmost = true;
            targetWindow.Activate();
        }
    }
}
