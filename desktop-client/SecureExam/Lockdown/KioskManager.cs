using System;
using System.Windows;
using System.Windows.Threading;
using System.Threading;

namespace SecureExam.Lockdown
{
    public static class KioskManager
    {
        private static DispatcherTimer? monitorTimer;

        public static bool IsLockedDown { get; private set; } = false;
        public static string? LastStartFailure { get; private set; }
        private static int violationCount;
        private static int terminationRaised;
        private static bool multipleScreensDetected;
        public static int ViolationCount => Volatile.Read(ref violationCount);
        public static int MaxViolationsAllowed { get; set; } = 3;

        public static event Action<string, string>? ViolationDetected;
        public static event Action? MaxViolationsExceeded;
        private static readonly Action<string> KeyboardHandler = detail => RegisterViolation("KEYBOARD_LOCK", detail);
        private static readonly Action<string> UsbHandler = detail => RegisterViolation("USB_CONNECTED", detail);
        private static readonly Action<string> ProcessHandler = detail => RegisterViolation("UNAUTHORIZED_PROCESS", detail);
        private static readonly Action<string> FocusHandler = detail => RegisterViolation("FOCUS_LOST", detail);

        public static bool StartLockdown(Window examWindow, int maxViolations = 3)
        {
            StopLockdown();
            LastStartFailure = null;
            MaxViolationsAllowed = maxViolations;
            Interlocked.Exchange(ref violationCount, 0);
            Interlocked.Exchange(ref terminationRaised, 0);
            multipleScreensDetected = false;
            IsLockedDown = true;

            KeyboardHook.OnBlockedKey += KeyboardHandler;
            USBMonitor.OnUsbInserted += UsbHandler;
            ProcessMonitor.OnBlockedProcess += ProcessHandler;
            WindowMonitor.OnFocusLost += FocusHandler;

            KeyboardHook.Start();
            if (!KeyboardHook.IsRunning)
            {
                LastStartFailure = $"Keyboard hook installation failed (Windows error {KeyboardHook.LastError}).";
                StopLockdown();
                return false;
            }
            TaskbarHider.Hide();
            USBMonitor.Start();
            ProcessMonitor.Start();
            if (!USBMonitor.IsRunning || !ProcessMonitor.IsRunning)
            {
                LastStartFailure = !USBMonitor.IsRunning
                    ? "USB monitoring could not be started."
                    : "Process monitoring could not be started.";
                StopLockdown();
                return false;
            }
            WindowMonitor.Start(examWindow);

            monitorTimer = new DispatcherTimer { Interval = TimeSpan.FromSeconds(3) };
            monitorTimer.Tick += (s, e) =>
            {
                if (!ScreenMonitor.IsSingleMonitor())
                {
                    if (!multipleScreensDetected) RegisterViolation("MULTIPLE_MONITORS", "Secondary display or screen capture device attached.");
                    multipleScreensDetected = true;
                }
                else multipleScreensDetected = false;
            };
            monitorTimer.Start();
            return true;
        }

        public static void StopLockdown()
        {
            IsLockedDown = false;

            monitorTimer?.Stop();
            monitorTimer = null;
            KeyboardHook.OnBlockedKey -= KeyboardHandler;
            USBMonitor.OnUsbInserted -= UsbHandler;
            ProcessMonitor.OnBlockedProcess -= ProcessHandler;
            WindowMonitor.OnFocusLost -= FocusHandler;
            KeyboardHook.Stop();
            TaskbarHider.Show();
            USBMonitor.Stop();
            ProcessMonitor.Stop();
            WindowMonitor.Stop();
        }

        public static void RegisterViolation(string type, string detail)
        {
            if (!IsLockedDown) return;

            var count = Interlocked.Increment(ref violationCount);
            ViolationDetected?.Invoke(type, detail);

            if (count >= MaxViolationsAllowed && Interlocked.Exchange(ref terminationRaised, 1) == 0)
            {
                MaxViolationsExceeded?.Invoke();
            }
        }

        public static (bool passes, string? reason) PerformPreCheck()
        {
            if (VMDetector.IsVirtualMachine())
            {
                return (false, "ExamShield cannot run inside a Virtual Machine environment.");
            }

            if (!ScreenMonitor.IsSingleMonitor())
            {
                return (false, "Multiple monitors detected. Please disconnect extra displays before starting.");
            }

            return (true, null);
        }
    }
}
