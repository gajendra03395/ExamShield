using System.Management;

namespace SecureExam.Lockdown
{
    public static class VMDetector
    {
        public static bool IsVirtualMachine()
        {
            try
            {
                using var searcher = new ManagementObjectSearcher("SELECT * FROM Win32_ComputerSystem");
                foreach (var item in searcher.Get())
                {
                    string manufacturer = item["Manufacturer"]?.ToString()?.ToLower() ?? "";
                    string model = item["Model"]?.ToString()?.ToLower() ?? "";

                    if (manufacturer.Contains("vmware") || manufacturer.Contains("virtualbox") ||
                        manufacturer.Contains("qemu") || manufacturer.Contains("xen") || manufacturer.Contains("parallels") ||
                        manufacturer.Contains("bochs") || model.Contains("virtual") ||
                        (manufacturer.Contains("microsoft") && model.Contains("virtual machine")))
                    {
                        return true;
                    }
                }
            }
            catch { }
            return false;
        }
    }
}
