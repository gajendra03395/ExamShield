using System;
using System.Diagnostics;
using System.Runtime.InteropServices;

namespace SecureExam.Lockdown
{
    public static class KeyboardHook
    {
        private const int WH_KEYBOARD_LL = 13;
        private const int WM_KEYDOWN = 0x0100;
        private const int WM_SYSKEYDOWN = 0x0104;

        public static event Action<string>? OnBlockedKey;
        public static bool IsRunning => _hookID != IntPtr.Zero;
        public static int LastError { get; private set; }

        private static IntPtr _hookID = IntPtr.Zero;
        private static LowLevelKeyboardProc? _proc;

        public static void Start()
        {
            if (IsRunning) return;
            LastError = 0;
            _proc = HookCallback;
            using var curProcess = Process.GetCurrentProcess();
            using var curModule = curProcess.MainModule;
            var moduleHandle = GetModuleHandle(null);
            if (moduleHandle == IntPtr.Zero && curModule != null)
            {
                moduleHandle = GetModuleHandle(curModule.ModuleName);
            }
            _hookID = SetWindowsHookEx(WH_KEYBOARD_LL, _proc, moduleHandle, 0);
            if (_hookID == IntPtr.Zero)
            {
                LastError = Marshal.GetLastWin32Error();
                // Some hosted dotnet processes accept a null module handle for a low-level hook.
                _hookID = SetWindowsHookEx(WH_KEYBOARD_LL, _proc, IntPtr.Zero, 0);
                if (_hookID == IntPtr.Zero) LastError = Marshal.GetLastWin32Error();
            }
        }

        public static void Stop()
        {
            if (_hookID != IntPtr.Zero)
            {
                UnhookWindowsHookEx(_hookID);
                _hookID = IntPtr.Zero;
            }
        }

        private delegate IntPtr LowLevelKeyboardProc(int nCode, IntPtr wParam, IntPtr lParam);

        private static IntPtr HookCallback(int nCode, IntPtr wParam, IntPtr lParam)
        {
            if (nCode >= 0 && (wParam == (IntPtr)WM_KEYDOWN || wParam == (IntPtr)WM_SYSKEYDOWN))
            {
                int vkCode = Marshal.ReadInt32(lParam);
                bool altPressed = (GetKeyState(0x12) & 0x8000) != 0;
                bool ctrlPressed = (GetKeyState(0x11) & 0x8000) != 0;
                bool shiftPressed = (GetKeyState(0x10) & 0x8000) != 0;

                // Block Alt+Tab, Alt+F4, Win key, PrintScreen, Ctrl+Escape
                if ((altPressed && vkCode == 0x09) || // Alt+Tab
                    (altPressed && vkCode == 0x73) || // Alt+F4
                    vkCode == 0x5B || vkCode == 0x5C || // Win keys
                    vkCode == 0x2C ||                 // PrintScreen
                    (ctrlPressed && vkCode == 0x1B) || // Ctrl+Esc
                    (ctrlPressed && vkCode is 0x43 or 0x56 or 0x58) || // Ctrl+C/V/X
                    (ctrlPressed && vkCode == 0x2D) || // Ctrl+Insert
                    (shiftPressed && vkCode == 0x2D)) // Shift+Insert
                {
                    try { OnBlockedKey?.Invoke($"Blocked shortcut: 0x{vkCode:X2}"); } catch { }
                    return (IntPtr)1; // Block key
                }
            }
            return CallNextHookEx(_hookID, nCode, wParam, lParam);
        }

        [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
        private static extern IntPtr SetWindowsHookEx(int idHook, LowLevelKeyboardProc lpfn, IntPtr hMod, uint dwThreadId);

        [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
        [return: MarshalAs(UnmanagedType.Bool)]
        private static extern bool UnhookWindowsHookEx(IntPtr hhk);

        [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
        private static extern IntPtr CallNextHookEx(IntPtr hhk, int nCode, IntPtr wParam, IntPtr lParam);

        [DllImport("kernel32.dll", CharSet = CharSet.Auto, SetLastError = true)]
        private static extern IntPtr GetModuleHandle(string? lpModuleName);

        [DllImport("user32.dll")]
        private static extern short GetKeyState(int nVirtKey);
    }
}
