using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.Linq;

namespace SecureExam.Lockdown;

public static class ScreenshotCapturer
{
    private const int MaxWidth = 1280;

    public static string? CapturePrimaryScreenBase64()
    {
        try
        {
            var bounds = System.Windows.Forms.Screen.PrimaryScreen?.Bounds;
            if (bounds is null || bounds.Value.Width <= 0 || bounds.Value.Height <= 0)
                return null;

            var source = bounds.Value;
            var scale = Math.Min(1d, MaxWidth / (double)source.Width);
            var width = Math.Max(1, (int)(source.Width * scale));
            var height = Math.Max(1, (int)(source.Height * scale));
            using var bitmap = new Bitmap(source.Width, source.Height);
            using (var graphics = Graphics.FromImage(bitmap))
            {
                graphics.CopyFromScreen(source.Location, Point.Empty, source.Size);
            }

            using var output = new Bitmap(width, height);
            using (var graphics = Graphics.FromImage(output))
            {
                graphics.InterpolationMode = System.Drawing.Drawing2D.InterpolationMode.HighQualityBicubic;
                graphics.DrawImage(bitmap, 0, 0, width, height);
            }

            using var stream = new MemoryStream();
            var encoder = ImageCodecInfo.GetImageEncoders().First(codec => codec.MimeType == "image/jpeg");
            using var parameters = new EncoderParameters(1);
            parameters.Param[0] = new EncoderParameter(System.Drawing.Imaging.Encoder.Quality, 55L);
            output.Save(stream, encoder, parameters);
            return Convert.ToBase64String(stream.ToArray());
        }
        catch
        {
            return null;
        }
    }
}
