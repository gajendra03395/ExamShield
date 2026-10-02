using System.Windows.Forms;

namespace SecureExam.Lockdown
{
    public static class ScreenMonitor
    {
        public static bool IsSingleMonitor()
        {
            return Screen.AllScreens.Length == 1;
        }
    }
}