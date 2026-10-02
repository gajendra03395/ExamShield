using System;
using System.IO;
using System.Windows;
using System.Windows.Media;
using WpfApplication = System.Windows.Application;
using WpfColor = System.Windows.Media.Color;
using WpfColorConverter = System.Windows.Media.ColorConverter;

namespace SecureExam.Services;

public static class ThemeManager
{
    public static bool IsDark { get; private set; } = true;
    private static readonly string PreferencePath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "ExamShield", "theme.txt");

    public static void Initialize()
    {
        try { Apply(!string.Equals(File.ReadAllText(PreferencePath).Trim(), "light", StringComparison.OrdinalIgnoreCase)); }
        catch { Apply(true); }
    }

    public static void Toggle() => Apply(!IsDark);

    public static void Apply(bool dark)
    {
        IsDark = dark;
        try { Directory.CreateDirectory(Path.GetDirectoryName(PreferencePath)!); File.WriteAllText(PreferencePath, dark ? "dark" : "light"); } catch { }
        Set("WindowBackgroundBrush", dark ? "#07111F" : "#EEF4F7");
        Set("SurfaceBrush", dark ? "#102035" : "#FFFFFF");
        Set("RaisedSurfaceBrush", dark ? "#1F3A52" : "#DCE9EE");
        Set("TextPrimaryBrush", dark ? "#F3F8FC" : "#13283A");
        Set("TextMutedBrush", dark ? "#94A8BD" : "#5D7182");
        Set("BorderBrush", dark ? "#29445C" : "#C5D6DE");
        Set("AccentBrush", dark ? "#62C4C9" : "#247E88");
        Set("AccentTextBrush", dark ? "#07111F" : "#FFFFFF");
        Set("DangerBrush", dark ? "#E58B87" : "#B84D52");
    }

    private static void Set(string key, string hex)
    {
        if (WpfApplication.Current is null) return;
        WpfApplication.Current.Resources[key] = new SolidColorBrush((WpfColor)WpfColorConverter.ConvertFromString(hex));
    }
}
