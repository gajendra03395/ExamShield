using System;
using System.Management;
using System.Security.Cryptography;
using System.Text;

namespace SecureExam.Helpers
{
    public static class MachineIdentifier
    {
        public static string GetMachineId()
        {
            try
            {
                string raw = $"{GetCpuId()}-{GetBoardSerial()}-{Environment.MachineName}";
                using var sha = SHA256.Create();
                var hash = sha.ComputeHash(Encoding.UTF8.GetBytes(raw));
                return BitConverter.ToString(hash).Replace("-", "").Substring(0, 32);
            }
            catch
            {
                return Environment.MachineName + "-" + Environment.UserName;
            }
        }

        private static string GetCpuId()
        {
            try
            {
                using var mc = new ManagementClass("Win32_Processor");
                foreach (ManagementObject mo in mc.GetInstances())
                    return mo.Properties["ProcessorId"]?.Value?.ToString() ?? "CPU";
            }
            catch { }
            return "CPU";
        }

        private static string GetBoardSerial()
        {
            try
            {
                using var mc = new ManagementClass("Win32_BaseBoard");
                foreach (ManagementObject mo in mc.GetInstances())
                    return mo.Properties["SerialNumber"]?.Value?.ToString() ?? "BOARD";
            }
            catch { }
            return "BOARD";
        }
    }
}