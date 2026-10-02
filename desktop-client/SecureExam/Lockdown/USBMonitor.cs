using System;
using System.IO;
using System.Collections.Generic;
using System.Threading;

namespace SecureExam.Lockdown
{
    public static class USBMonitor
    {
        private static System.Threading.Timer? pollTimer;
        private static readonly object sync = new();
        private static readonly HashSet<string> knownDrives = new(StringComparer.OrdinalIgnoreCase);
        public static event Action<string>? OnUsbInserted;
        public static bool IsRunning => pollTimer != null;

        public static void Start()
        {
            if (pollTimer != null) return;
            lock (sync)
            {
                knownDrives.Clear();
                foreach (var drive in GetRemovableDrives()) knownDrives.Add(drive);
            }
            pollTimer = new System.Threading.Timer(_ => Scan(), null, TimeSpan.FromSeconds(2), TimeSpan.FromSeconds(2));
        }

        public static void Stop()
        {
            pollTimer?.Dispose();
            pollTimer = null;
            lock (sync) knownDrives.Clear();
        }

        private static void Scan()
        {
            try
            {
                var current = new HashSet<string>(GetRemovableDrives(), StringComparer.OrdinalIgnoreCase);
                var inserted = new List<string>();
                lock (sync)
                {
                    foreach (var drive in current)
                        if (knownDrives.Add(drive)) inserted.Add(drive);
                    knownDrives.RemoveWhere(drive => !current.Contains(drive));
                }
                foreach (var drive in inserted) OnUsbInserted?.Invoke($"USB drive connection detected ({drive})");
            }
            catch { }
        }

        private static IEnumerable<string> GetRemovableDrives()
        {
            foreach (var drive in DriveInfo.GetDrives())
            {
                var removable = false;
                try { removable = drive.DriveType == DriveType.Removable; } catch { }
                if (removable) yield return drive.Name;
            }
        }
    }
}
