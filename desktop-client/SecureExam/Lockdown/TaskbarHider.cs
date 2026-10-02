using System;
using System.Runtime.InteropServices;

namespace SecureExam.Lockdown
{
    public static class TaskbarHider
    {
        [DllImport("user32.dll")]
        private static extern IntPtr FindWindow(string lpClassName, string? lpWindowName);

        [DllImport("user32.dll")]
        private static extern int ShowWindow(IntPtr hwnd, int nCmdShow);

        private const int SW_HIDE = 0;
        private const int SW_SHOW = 5;

        public static void Hide()
        {
            IntPtr hwnd = FindWindow("Shell_TrayWnd", null);
            if (hwnd != IntPtr.Zero) ShowWindow(hwnd, SW_HIDE);
        }

        public static void Show()
        {
            IntPtr hwnd = FindWindow("Shell_TrayWnd", null);
            if (hwnd != IntPtr.Zero) ShowWindow(hwnd, SW_SHOW);
        }
    }
}