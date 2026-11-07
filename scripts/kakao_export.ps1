param([string]$RoomsFile, [string]$OutDir, [string]$ResultFile)
# RamTalk: 카톡 PC 단톡방 대화를 자동으로 내보내기(Ctrl+S) 하는 스크립트
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName UIAutomationClient, UIAutomationTypes, System.Windows.Forms
Add-Type @"
using System; using System.Runtime.InteropServices; using System.Text; using System.Collections.Generic;
public class W32 {
  public delegate bool EnumProc(IntPtr h, IntPtr l);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc f, IntPtr l);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetClassName(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint p);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int c);
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint f, uint dx, uint dy, uint d, UIntPtr e);
  [DllImport("user32.dll")] public static extern uint GetDpiForWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr h, uint m, IntPtr w, IntPtr l);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L, T, R, B; }
  public static List<string[]> List() {
    var r = new List<string[]>();
    EnumWindows((h, l) => { uint p; GetWindowThreadProcessId(h, out p);
      var t = new StringBuilder(512); GetWindowText(h, t, 512); var c = new StringBuilder(256); GetClassName(h, c, 256);
      r.Add(new string[] { h.ToInt64().ToString(), p.ToString(), t.ToString(), c.ToString(), IsWindowVisible(h) ? "1" : "0" }); return true; }, IntPtr.Zero);
    return r; }
  [DllImport("user32.dll")] public static extern void keybd_event(byte vk, byte sc, uint f, UIntPtr e);
  public static void Fg(IntPtr h) { keybd_event(0x12,0,0,UIntPtr.Zero); keybd_event(0x12,0,2,UIntPtr.Zero); ShowWindow(h, 9); SetForegroundWindow(h); }
  public static void CtrlS() { keybd_event(0x11,0,0,UIntPtr.Zero); keybd_event(0x53,0,0,UIntPtr.Zero); System.Threading.Thread.Sleep(60); keybd_event(0x53,0,2,UIntPtr.Zero); keybd_event(0x11,0,2,UIntPtr.Zero); }
  [DllImport("user32.dll")] public static extern bool EnumChildWindows(IntPtr p, EnumProc f, IntPtr l);
  [DllImport("user32.dll")] public static extern int GetDlgCtrlID(IntPtr h);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern IntPtr SendMessage(IntPtr h, uint m, IntPtr w, string l);
  [DllImport("user32.dll")] public static extern IntPtr SendMessage(IntPtr h, uint m, IntPtr w, IntPtr l);
  public static IntPtr Child(IntPtr dlg, int id, string cls) { IntPtr found = IntPtr.Zero;
    EnumChildWindows(dlg, (h, l) => { var c = new StringBuilder(64); GetClassName(h, c, 64);
      if (GetDlgCtrlID(h) == id && (cls == null || c.ToString() == cls)) { found = h; return false; } return true; }, IntPtr.Zero);
    return found; }
  // 저장 창: 파일 이름 칸(Edit, 1001 또는 ComboBox 안 Edit)에 경로 넣고 [저장](1) 누르기 — 마우스·키보드 없이 즉시
  public static bool SaveAs(IntPtr dlg, string path) {
    IntPtr edit = Child(dlg, 1001, "Edit");
    if (edit == IntPtr.Zero) { IntPtr cb = Child(dlg, 1148, null); if (cb != IntPtr.Zero) edit = Child(cb, 1001, "Edit"); }
    if (edit == IntPtr.Zero) return false;
    SendMessage(edit, 0x000C, IntPtr.Zero, path);            // WM_SETTEXT
    IntPtr ok = Child(dlg, 1, "Button"); if (ok == IntPtr.Zero) return false;
    SendMessage(ok, 0x00F5, IntPtr.Zero, IntPtr.Zero);        // BM_CLICK
    return true; }
  public static void Click(int x, int y) { SetCursorPos(x, y); mouse_event(2,0,0,0,UIntPtr.Zero); mouse_event(4,0,0,0,UIntPtr.Zero); }
  public static void DClick(int x, int y) { Click(x, y); System.Threading.Thread.Sleep(80); Click(x, y); }
}
"@
$AE = [System.Windows.Automation.AutomationElement]
$TS = [System.Windows.Automation.TreeScope]
$result = @{ saved = @(); errors = @() }
function Done { $result | ConvertTo-Json -Depth 4 | Out-File $ResultFile -Encoding utf8; exit }

$rooms = Get-Content $RoomsFile -Raw -Encoding UTF8 | ConvertFrom-Json
$kakao = Get-Process KakaoTalk -ErrorAction SilentlyContinue
if (-not $kakao) { $result.errors += @{ room = ""; msg = "카카오톡 PC가 켜져 있지 않아요" }; Done }
$pids = @($kakao | ForEach-Object { $_.Id })
function KWins { [W32]::List() | Where-Object { $pids -contains [int]$_[1] -and $_[4] -eq "1" } }
function FindRoom($name) { KWins | Where-Object { $_[3] -ne "#32770" -and ($_[2] -eq $name) } | Select-Object -First 1 }
function Focus($h) { [W32]::Fg($h); Start-Sleep -Milliseconds 200 }
function Paste($text) { [System.Windows.Forms.Clipboard]::SetText($text); [System.Windows.Forms.SendKeys]::SendWait("^a"); Start-Sleep -Milliseconds 80; [System.Windows.Forms.SendKeys]::SendWait("^v") }

# 메인 창 기준 위치 (100% 배율 기준 좌표, 화면 배율에 맞춰 늘림)
function MainWin { KWins | Where-Object { $_[2] -eq "카카오톡" -and $_[3] -ne "#32770" } | Select-Object -First 1 }
function MainClick($rx, $ry, [switch]$Double) {
  $m = MainWin; if (-not $m) { return $false }
  $h = [IntPtr][long]$m[0]; Focus $h
  $r = New-Object W32+RECT; [W32]::GetWindowRect($h, [ref]$r) | Out-Null
  $s = [W32]::GetDpiForWindow($h) / 96.0; if ($s -le 0) { $s = 1 }
  $x = [int]($r.L + $rx * $s); $y = [int]($r.T + $ry * $s)
  if ($Double) { [W32]::DClick($x, $y) } else { [W32]::Click($x, $y) }
  Start-Sleep -Milliseconds 400; return $true
}
function TryOpen($name, $tabX) {
  MainClick 33 117 | Out-Null            # 왼쪽 채팅 아이콘
  MainClick $tabX 57 | Out-Null          # 채팅 / 오픈채팅 머리글
  MainClick 250 103 | Out-Null           # 검색칸
  Paste $name; Start-Sleep -Milliseconds 900
  [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
  for ($i = 0; $i -lt 8; $i++) { Start-Sleep -Milliseconds 250; $w = FindRoom $name; if ($w) { return $w } }
  MainClick 300 195 -Double | Out-Null   # 검색 결과 첫 줄
  for ($i = 0; $i -lt 8; $i++) { Start-Sleep -Milliseconds 250; $w = FindRoom $name; if ($w) { return $w } }
  return $null
}
function ClearSearch { if (MainWin) { MainClick 250 103 | Out-Null; [System.Windows.Forms.SendKeys]::SendWait("^a{BACKSPACE}{ESC}") } }

foreach ($room in $rooms) {
  $name = [string]$room
  if (-not $name.Trim()) { continue }
  try {
    $hit = FindRoom $name; $openedByMe = $false
    if (-not $hit) {
      $hit = TryOpen $name 105                 # 1) 채팅에서 찾기
      if (-not $hit) { ClearSearch; $hit = TryOpen $name 185 }   # 2) 오픈채팅에서 찾기
      ClearSearch
      if (-not $hit) { $result.errors += @{ room = $name; msg = "방을 찾지 못했어요(이름이 카톡 방 이름과 똑같은지 확인)" }; continue }
      $openedByMe = $true
    }
    $h = [IntPtr][long]$hit[0]; Focus $h
    $before = @(KWins | ForEach-Object { $_[0] })
    $r = New-Object W32+RECT; [W32]::GetWindowRect($h, [ref]$r) | Out-Null
    [W32]::Click([int](($r.L + $r.R) / 2), [int]($r.T + ($r.B - $r.T) * 0.35)); Start-Sleep -Milliseconds 200
    [W32]::CtrlS()
    $dlg = $null
    for ($i = 0; $i -lt 60 -and -not $dlg; $i++) {
      Start-Sleep -Milliseconds 100
      $d = KWins | Where-Object { $_[3] -eq "#32770" } | Select-Object -First 1
      if ($d) { $dlg = $AE::FromHandle([IntPtr][long]$d[0]) }
    }
    if (-not $dlg) { $result.errors += @{ room = $name; msg = "저장 창이 뜨지 않았어요" }; continue }
    $safe = ($name -replace '[\\/:*?"<>|]', '_')
    $path = Join-Path $OutDir ("KakaoTalk_{0}_{1}.txt" -f $safe, (Get-Date -Format "yyyyMMdd_HHmmss"))
    $dh = [IntPtr]$dlg.Current.NativeWindowHandle
    if (-not [W32]::SaveAs($dh, $path)) {
      Focus $dh
      $fn = $dlg.FindFirst($TS::Descendants, (New-Object System.Windows.Automation.PropertyCondition($AE::AutomationIdProperty, "1001")))
      if ($fn) { $fr = $fn.Current.BoundingRectangle; [W32]::Click([int]($fr.Left + $fr.Width / 2), [int]($fr.Top + $fr.Height / 2)); Start-Sleep -Milliseconds 150 }
      [System.Windows.Forms.Clipboard]::SetText($path)
      [System.Windows.Forms.SendKeys]::SendWait("^a{DEL}^v"); Start-Sleep -Milliseconds 200
      [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
    }
    # 내보내기 끝날 때까지(완료 창 또는 파일 크기 멈춤) 최대 4분
    $last = -1; $same = 0; $t0 = Get-Date; $popped = $false
    while (((Get-Date) - $t0).TotalSeconds -lt 240) {
      Start-Sleep -Milliseconds 250
      $pop = @(KWins | Where-Object { $before -notcontains $_[0] -and $_[3] -eq "EVA_Window_Dblclk" })
      $size = if (Test-Path $path) { (Get-Item $path).Length } else { -1 }
      if ($size -gt 0 -and $size -eq $last) { $same++ } else { $same = 0 }
      $last = $size
      if ($pop.Count -and $size -gt 0) { $popped = $true; break }
      if ($same -ge 8) { break }
    }
    Start-Sleep -Milliseconds 150
    # 완료 창 [확인]
    $pop = @(KWins | Where-Object { $before -notcontains $_[0] -and $_[3] -eq "EVA_Window_Dblclk" })
    if ($pop.Count) { foreach ($w in $pop) { Focus ([IntPtr][long]$w[0]); [System.Windows.Forms.SendKeys]::SendWait("{ENTER}") } }
    elseif (Test-Path $path) { Focus $h; [System.Windows.Forms.SendKeys]::SendWait("{ENTER}") }
    Start-Sleep -Milliseconds 400
    # 남은 저장·덮어쓰기 창은 취소
    foreach ($w in @(KWins | Where-Object { $_[3] -eq "#32770" })) { Focus ([IntPtr][long]$w[0]); [System.Windows.Forms.SendKeys]::SendWait("{ESC}"); Start-Sleep -Milliseconds 300 }
    if (Test-Path $path) { $result.saved += @{ room = $name; path = $path } }
    else { $result.errors += @{ room = $name; msg = "저장이 끝나지 않았어요(대화가 아주 많으면 다시 시도)" } }
    [W32]::PostMessage($h, 0x0010, [IntPtr]::Zero, [IntPtr]::Zero) | Out-Null   # 카톡방 닫기
    Start-Sleep -Milliseconds 400
  } catch { $result.errors += @{ room = $name; msg = $_.Exception.Message } }
}
Done
