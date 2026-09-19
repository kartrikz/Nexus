# NexusMind Windows Desktop Automation Helper
param(
    [Parameter(Mandatory=$true)][string]$Action,
    [string]$Arg1,
    [string]$Arg2,
    [string]$Arg3
)

$ProgressPreference = 'SilentlyContinue'

if (-not ([System.Management.Automation.PSTypeName]'NexusDesktop').Type) {
    Add-Type -TypeDefinition @"
using System;
using System.Collections.Generic;
using System.Text;
using System.Drawing;
using System.Windows.Forms;
using System.Runtime.InteropServices;

public static class NexusDesktop {
    [DllImport("user32.dll")]
    public static extern bool SetProcessDPIAware();

    [DllImport("user32.dll")]
    public static extern int GetSystemMetrics(int nIndex);

    [DllImport("user32.dll")]
    public static extern bool SetCursorPos(int x, int y);

    [DllImport("user32.dll")]
    public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint dwData, int dwExtraInfo);

    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Auto)]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

    [DllImport("user32.dll")]
    public static extern IntPtr GetDesktopWindow();

    [DllImport("user32.dll")]
    public static extern IntPtr GetWindowDC(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern IntPtr GetDC(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern int ReleaseDC(IntPtr hWnd, IntPtr hDC);

    [DllImport("gdi32.dll")]
    public static extern IntPtr CreateCompatibleDC(IntPtr hdc);

    [DllImport("gdi32.dll")]
    public static extern IntPtr CreateCompatibleBitmap(IntPtr hdc, int nWidth, int nHeight);

    [DllImport("gdi32.dll")]
    public static extern IntPtr SelectObject(IntPtr hdc, IntPtr hgdiobj);

    [DllImport("gdi32.dll")]
    public static extern bool BitBlt(IntPtr hdcDest, int nXDest, int nYDest, int nWidth, int nHeight, IntPtr hdcSrc, int nXSrc, int nYSrc, uint dwRop);

    [DllImport("gdi32.dll")]
    public static extern bool DeleteDC(IntPtr hdc);

    [DllImport("gdi32.dll")]
    public static extern bool DeleteObject(IntPtr hObject);

    private const uint SRCCOPY = 0x00CC0020;

    [StructLayout(LayoutKind.Sequential)]
    public struct INPUT {
        public uint type;
        public InputUnion u;
    }

    [StructLayout(LayoutKind.Explicit)]
    public struct InputUnion {
        [FieldOffset(0)] public MOUSEINPUT mi;
        [FieldOffset(0)] public KEYBDINPUT ki;
        [FieldOffset(0)] public HARDWAREINPUT hi;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct KEYBDINPUT {
        public ushort wVk;
        public ushort wScan;
        public uint dwFlags;
        public uint time;
        public IntPtr dwExtraInfo;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct MOUSEINPUT {
        public int dx;
        public int dy;
        public uint mouseData;
        public uint dwFlags;
        public uint time;
        public IntPtr dwExtraInfo;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct HARDWAREINPUT {
        public uint uMsg;
        public ushort wParamL;
        public ushort wParamH;
    }

    [DllImport("user32.dll", SetLastError = true)]
    public static extern uint SendInput(uint nInputs, INPUT[] pInputs, int cbSize);

    private const uint INPUT_KEYBOARD = 1;
    private const uint KEYEVENTF_KEYUP = 0x0002;
    private const uint KEYEVENTF_UNICODE = 0x0004;

    private const uint MOUSEEVENTF_LEFTDOWN = 0x0002;
    private const uint MOUSEEVENTF_LEFTUP = 0x0004;
    private const uint MOUSEEVENTF_RIGHTDOWN = 0x0008;
    private const uint MOUSEEVENTF_RIGHTUP = 0x0010;
    private const uint MOUSEEVENTF_MIDDLEDOWN = 0x0020;
    private const uint MOUSEEVENTF_MIDDLEUP = 0x0040;
    private const uint MOUSEEVENTF_WHEEL = 0x0800;

    static NexusDesktop() {
        try { SetProcessDPIAware(); } catch {}
    }

    public static string GetMetrics() {
        int w = GetSystemMetrics(0);
        int h = GetSystemMetrics(1);
        return w + "," + h;
    }

    public static string GetActiveWindowTitle() {
        IntPtr handle = GetForegroundWindow();
        if (handle == IntPtr.Zero) return "";
        StringBuilder sb = new StringBuilder(256);
        GetWindowText(handle, sb, 256);
        return sb.ToString();
    }

    public static void MoveMouse(int x, int y) {
        SetCursorPos(x, y);
    }

    public static void ClickMouse(int x, int y, string button) {
        SetCursorPos(x, y);
        System.Threading.Thread.Sleep(20);
        if (button == "right") {
            mouse_event(MOUSEEVENTF_RIGHTDOWN, 0, 0, 0, 0);
            System.Threading.Thread.Sleep(20);
            mouse_event(MOUSEEVENTF_RIGHTUP, 0, 0, 0, 0);
        } else if (button == "middle") {
            mouse_event(MOUSEEVENTF_MIDDLEDOWN, 0, 0, 0, 0);
            System.Threading.Thread.Sleep(20);
            mouse_event(MOUSEEVENTF_MIDDLEUP, 0, 0, 0, 0);
        } else {
            mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, 0);
            System.Threading.Thread.Sleep(20);
            mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, 0);
        }
    }

    public static void DoubleClickMouse(int x, int y) {
        ClickMouse(x, y, "left");
        System.Threading.Thread.Sleep(80);
        ClickMouse(x, y, "left");
    }

    public static void Scroll(int amount) {
        uint dwData = unchecked((uint)(-amount * 120));
        mouse_event(MOUSEEVENTF_WHEEL, 0, 0, dwData, 0);
    }

    public static bool CaptureScreen(string filePath) {
        try {
            int w = GetSystemMetrics(0);
            int h = GetSystemMetrics(1);
            if (w <= 0 || h <= 0) { w = 1920; h = 1080; }

            IntPtr hDesk = GetDesktopWindow();
            IntPtr hdcSrc = GetWindowDC(hDesk);
            if (hdcSrc == IntPtr.Zero) hdcSrc = GetDC(IntPtr.Zero);

            IntPtr hdcDest = CreateCompatibleDC(hdcSrc);
            IntPtr hBitmap = CreateCompatibleBitmap(hdcSrc, w, h);
            IntPtr hOld = SelectObject(hdcDest, hBitmap);

            BitBlt(hdcDest, 0, 0, w, h, hdcSrc, 0, 0, SRCCOPY);

            SelectObject(hdcDest, hOld);
            DeleteDC(hdcDest);
            ReleaseDC(hDesk, hdcSrc);

            using (Bitmap bmp = Image.FromHbitmap(hBitmap)) {
                bmp.Save(filePath, System.Drawing.Imaging.ImageFormat.Png);
            }
            DeleteObject(hBitmap);
            return true;
        } catch {
            return false;
        }
    }

    public static void SendText(string text) {
        if (string.IsNullOrEmpty(text)) return;
        int inputSize = Marshal.SizeOf(typeof(INPUT));
        INPUT[] inputs = new INPUT[text.Length * 2];
        for (int i = 0; i < text.Length; i++) {
            char c = text[i];
            inputs[i * 2] = new INPUT {
                type = INPUT_KEYBOARD,
                u = new InputUnion {
                    ki = new KEYBDINPUT {
                        wVk = 0,
                        wScan = (ushort)c,
                        dwFlags = KEYEVENTF_UNICODE,
                        time = 0,
                        dwExtraInfo = IntPtr.Zero
                    }
                }
            };
            inputs[i * 2 + 1] = new INPUT {
                type = INPUT_KEYBOARD,
                u = new InputUnion {
                    ki = new KEYBDINPUT {
                        wVk = 0,
                        wScan = (ushort)c,
                        dwFlags = KEYEVENTF_UNICODE | KEYEVENTF_KEYUP,
                        time = 0,
                        dwExtraInfo = IntPtr.Zero
                    }
                }
            };
        }
        SendInput((uint)inputs.Length, inputs, inputSize);
    }

    public static ushort GetVirtualKey(string keyName) {
        if (string.IsNullOrEmpty(keyName)) return 0;
        string upper = keyName.Trim().ToUpperInvariant();
        switch (upper) {
            case "ENTER":
            case "RETURN": return 0x0D;
            case "TAB": return 0x09;
            case "ESCAPE":
            case "ESC": return 0x1B;
            case "BACKSPACE":
            case "BACK": return 0x08;
            case "SPACE": return 0x20;
            case "UP": return 0x26;
            case "DOWN": return 0x28;
            case "LEFT": return 0x25;
            case "RIGHT": return 0x27;
            case "DELETE":
            case "DEL": return 0x2E;
            case "HOME": return 0x24;
            case "END": return 0x23;
            case "PAGEUP": return 0x21;
            case "PAGEDOWN": return 0x22;
            case "INSERT": return 0x2D;
            case "F1": return 0x70;
            case "F2": return 0x71;
            case "F3": return 0x72;
            case "F4": return 0x73;
            case "F5": return 0x74;
            case "F6": return 0x75;
            case "F7": return 0x76;
            case "F8": return 0x77;
            case "F9": return 0x78;
            case "F10": return 0x79;
            case "F11": return 0x7A;
            case "F12": return 0x7B;
            case "CTRL":
            case "CONTROL": return 0x11;
            case "ALT":
            case "MENU": return 0x12;
            case "SHIFT": return 0x10;
            case "WIN": return 0x5B;
            default:
                if (upper.Length == 1) {
                    char ch = upper[0];
                    if (ch >= 'A' && ch <= 'Z') return (ushort)ch;
                    if (ch >= '0' && ch <= '9') return (ushort)ch;
                }
                return 0;
        }
    }

    public static void SendNamedKey(string keyName, string modifiersCsv) {
        ushort vk = GetVirtualKey(keyName);
        if (vk == 0) return;

        List<ushort> modVks = new List<ushort>();
        if (!string.IsNullOrEmpty(modifiersCsv)) {
            string[] parts = modifiersCsv.Split(new char[] { ',', '+', ' ' }, StringSplitOptions.RemoveEmptyEntries);
            foreach (string p in parts) {
                ushort modVk = GetVirtualKey(p);
                if (modVk != 0 && !modVks.Contains(modVk)) {
                    modVks.Add(modVk);
                }
            }
        }

        int modCount = modVks.Count;
        int totalInputs = (modCount * 2) + 2;
        INPUT[] inputs = new INPUT[totalInputs];
        int idx = 0;

        for (int i = 0; i < modCount; i++) {
            inputs[idx++] = new INPUT {
                type = INPUT_KEYBOARD,
                u = new InputUnion {
                    ki = new KEYBDINPUT {
                        wVk = modVks[i],
                        wScan = 0,
                        dwFlags = 0,
                        time = 0,
                        dwExtraInfo = IntPtr.Zero
                    }
                }
            };
        }

        inputs[idx++] = new INPUT {
            type = INPUT_KEYBOARD,
            u = new InputUnion {
                ki = new KEYBDINPUT {
                    wVk = vk,
                    wScan = 0,
                    dwFlags = 0,
                    time = 0,
                    dwExtraInfo = IntPtr.Zero
                }
            }
        };

        inputs[idx++] = new INPUT {
            type = INPUT_KEYBOARD,
            u = new InputUnion {
                ki = new KEYBDINPUT {
                    wVk = vk,
                    wScan = 0,
                    dwFlags = KEYEVENTF_KEYUP,
                    time = 0,
                    dwExtraInfo = IntPtr.Zero
                }
            }
        };

        for (int i = modCount - 1; i >= 0; i--) {
            inputs[idx++] = new INPUT {
                type = INPUT_KEYBOARD,
                u = new InputUnion {
                    ki = new KEYBDINPUT {
                        wVk = modVks[i],
                        wScan = 0,
                        dwFlags = KEYEVENTF_KEYUP,
                        time = 0,
                        dwExtraInfo = IntPtr.Zero
                    }
                }
            };
        }

        SendInput((uint)inputs.Length, inputs, Marshal.SizeOf(typeof(INPUT)));
    }
}
"@ -ReferencedAssemblies System.Windows.Forms, System.Drawing
}

switch ($Action.ToLower()) {
    "metrics" {
        [NexusDesktop]::GetMetrics()
    }
    "activewindow" {
        [NexusDesktop]::GetActiveWindowTitle()
    }
    "move" {
        [NexusDesktop]::MoveMouse([int]$Arg1, [int]$Arg2)
        "OK"
    }
    "click" {
        [NexusDesktop]::ClickMouse([int]$Arg1, [int]$Arg2, $Arg3)
        "OK"
    }
    "doubleclick" {
        [NexusDesktop]::DoubleClickMouse([int]$Arg1, [int]$Arg2)
        "OK"
    }
    "scroll" {
        [NexusDesktop]::Scroll([int]$Arg1)
        "OK"
    }
    "type" {
        if (-not [string]::IsNullOrEmpty($Arg1)) {
            $bytes = [System.Convert]::FromBase64String($Arg1)
            $text = [System.Text.Encoding]::UTF8.GetString($bytes)
            [NexusDesktop]::SendText($text)
        }
        if ($Arg2 -eq "1" -or $Arg2 -eq "true" -or $Arg2 -eq "True") {
            Start-Sleep -Milliseconds 30
            [NexusDesktop]::SendNamedKey("ENTER", "")
        }
        "OK"
    }
    "press" {
        [NexusDesktop]::SendNamedKey($Arg1, $Arg2)
        "OK"
    }
    "capture" {
        [NexusDesktop]::CaptureScreen($Arg1) | Out-Null
        "OK"
    }
    default {
        Write-Error "Unknown action: $Action"
        exit 1
    }
}
