using System;
using System.Diagnostics;
using System.Linq;
using System.Collections.Generic;
using System.Threading;

namespace SecureExam.Lockdown
{
    public static class ProcessMonitor
    {
        private static System.Threading.Timer? pollTimer;
        private static readonly object sync = new();
        private static readonly HashSet<int> observedProcessIds = new();
        public static event Action<string>? OnBlockedProcess;
        public static bool IsRunning => pollTimer != null;

        private static readonly string[] Blacklist = new[]
        {
            "discord", "telegram", "whatsapp", "anydesk", "teamviewer", "obs64", "obs32",
            "snagit", "camtasia", "vlc", "chrome", "firefox", "msedge", "cmd", "powershell"
        };

        public static void Start()
        {
            if (pollTimer != null) return;
            lock (sync) observedProcessIds.Clear();
            // Polling avoids requiring WMI event-subscription permissions. Existing processes
            // are allowed when the exam starts; only processes launched during the exam report.
            ScanForNewBlockedProcesses(false);
            pollTimer = new System.Threading.Timer(_ => ScanForNewBlockedProcesses(true), null, TimeSpan.FromSeconds(2), TimeSpan.FromSeconds(2));
        }

        public static void Stop()
        {
            pollTimer?.Dispose();
            pollTimer = null;
            lock (sync) observedProcessIds.Clear();
        }

        private static void ScanForNewBlockedProcesses(bool reportNew)
        {
            try
            {
                var currentIds = new HashSet<int>();
                foreach (var name in Blacklist)
                {
                    foreach (var process in Process.GetProcessesByName(name))
                    {
                        try
                        {
                            currentIds.Add(process.Id);
                            var isNew = false;
                            lock (sync) isNew = observedProcessIds.Add(process.Id);
                            if (isNew && reportNew) OnBlockedProcess?.Invoke(process.ProcessName);
                        }
                        catch { }
                        finally { process.Dispose(); }
                    }
                }
                lock (sync) observedProcessIds.RemoveWhere(id => !currentIds.Contains(id));
            }
            catch { }
        }

        public static string[] FindRunningBlockedProcesses() => Blacklist
            .SelectMany(name => Process.GetProcessesByName(name).Select(process =>
            {
                try { return process.ProcessName; }
                finally { process.Dispose(); }
            }))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();
    }
}
