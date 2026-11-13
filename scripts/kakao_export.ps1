param([string]$RoomsFile, [string]$OutDir, [string]$ResultFile, [string]$StopFile = "")
# RamTalk: 카톡 PC 단톡방 대화를 자동으로 내보내기(Ctrl+S) 하는 스크립트
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName UIAutomationClient, UIAutomationTypes, System.Windows.Forms, System.Drawing
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
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
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
  [DllImport("user32.dll")] public static extern bool AttachThreadInput(uint a, uint b, bool f);
  [DllImport("kernel32.dll")] public static extern uint GetCurrentThreadId();
  [DllImport("user32.dll")] public static extern bool BringWindowToTop(IntPtr h);
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr h);
  // Alt 키를 누르지 않고 앞으로 가져오기 (Alt를 누르면 카톡 창이 메뉴 모드가 돼서 다음 단축키가 씹힘)
  public static void Fg(IntPtr h) {
    if (IsIconic(h) || !IsWindowVisible(h)) ShowWindow(h, 9);
    IntPtr f = GetForegroundWindow(); if (f == h) return;
    uint p; uint ft = GetWindowThreadProcessId(f, out p); uint me = GetCurrentThreadId();
    if (ft != me) AttachThreadInput(me, ft, true);
    BringWindowToTop(h); SetForegroundWindow(h);
    if (ft != me) AttachThreadInput(me, ft, false);
    if (GetForegroundWindow() != h) { keybd_event(0x12,0,0,UIntPtr.Zero); SetForegroundWindow(h); keybd_event(0x12,0,2,UIntPtr.Zero); keybd_event(0x12,0,0,UIntPtr.Zero); keybd_event(0x12,0,2,UIntPtr.Zero); }
  }
  public static void CtrlKey(byte k) { keybd_event(0x11,0,0,UIntPtr.Zero); keybd_event(k,0,0,UIntPtr.Zero); System.Threading.Thread.Sleep(60); keybd_event(k,0,2,UIntPtr.Zero); keybd_event(0x11,0,2,UIntPtr.Zero); }
  public static void CtrlS() { keybd_event(0x11,0,0,UIntPtr.Zero); keybd_event(0x53,0,0,UIntPtr.Zero); System.Threading.Thread.Sleep(60); keybd_event(0x53,0,2,UIntPtr.Zero); keybd_event(0x11,0,2,UIntPtr.Zero); }
  [DllImport("user32.dll")] public static extern bool EnumChildWindows(IntPtr p, EnumProc f, IntPtr l);
  [DllImport("user32.dll")] public static extern int GetDlgCtrlID(IntPtr h);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern IntPtr SendMessage(IntPtr h, uint m, IntPtr w, string l);
  [DllImport("user32.dll")] public static extern IntPtr SendMessage(IntPtr h, uint m, IntPtr w, IntPtr l);
  public static IntPtr Child(IntPtr dlg, int id, string cls) { IntPtr found = IntPtr.Zero;
    EnumChildWindows(dlg, (h, l) => { var c = new StringBuilder(64); GetClassName(h, c, 64);
      if ((id <= 0 || GetDlgCtrlID(h) == id) && (cls == null || c.ToString() == cls)) { found = h; return false; } return true; }, IntPtr.Zero);
    return found; }
  // 저장 창: 파일 이름 칸(Edit, 1001 또는 ComboBox 안 Edit)에 경로 넣고 [저장](1) 누르기 — 마우스·키보드 없이 즉시
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern IntPtr SendMessage(IntPtr h, uint m, IntPtr w, StringBuilder l);
  static string TextOf(IntPtr h) { var b = new StringBuilder(1024); SendMessage(h, 0x000D, (IntPtr)1024, b); return b.ToString(); }   // WM_GETTEXT
  // 저장 창: [파일 이름] 칸에 전체 경로를 넣고 들어갔는지 확인한 뒤 [저장](1) 누르기
  // 파일 이름 칸은 FileNameControlHost(1148) 안의 Edit(1001) — 다른 칸에 잘못 넣지 않도록 이것부터 찾음
  public static bool SaveAs(IntPtr dlg, string path) {
    IntPtr edit = IntPtr.Zero;
    IntPtr host = Child(dlg, 1148, null);
    if (host != IntPtr.Zero) { edit = Child(host, 1001, "Edit"); if (edit == IntPtr.Zero) edit = Child(host, 0, "Edit"); }
    if (edit == IntPtr.Zero) edit = Child(dlg, 1001, "Edit");
    if (edit == IntPtr.Zero) return false;
    SendMessage(edit, 0x000C, IntPtr.Zero, path);            // WM_SETTEXT
    System.Threading.Thread.Sleep(120);
    if (TextOf(edit) != path) return false;
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
$script:dbg = @()
function Save { $result.debug = $script:dbg; $result | ConvertTo-Json -Depth 4 | Out-File $ResultFile -Encoding utf8 }
function Done { Save; exit }
function Stopped { return ($StopFile -and (Test-Path $StopFile)) }

$rooms = Get-Content $RoomsFile -Raw -Encoding UTF8 | ConvertFrom-Json
$kakao = Get-Process KakaoTalk -ErrorAction SilentlyContinue
if (-not $kakao) { $result.errors += @{ room = ""; msg = "카카오톡 PC가 켜져 있지 않아요" }; Done }
$pids = @($kakao | ForEach-Object { $_.Id })
function KWins { [W32]::List() | Where-Object { $pids -contains [int]$_[1] -and $_[4] -eq "1" } }
function FindRoom($name) {
  $ws = @(KWins | Where-Object { $_[3] -ne "#32770" -and $_[2] -ne "카카오톡" -and $_[2] -ne "통합검색" -and $_[2] })
  $hit = $ws | Where-Object { $_[2] -eq $name } | Select-Object -First 1
  if (-not $hit) { $hit = $ws | Where-Object { $_[2].Contains($name) } | Select-Object -First 1 }
  if ($hit) { return ,$hit }
}
# 저장된 파일 찾기: 정한 이름이 있으면 그것, 없으면 저장 폴더에서 이번에 새로 생긴 txt
function FindOut($p, $since) {
  if (Test-Path -LiteralPath $p) { return (Get-Item -LiteralPath $p) }
  $f = Get-ChildItem -LiteralPath $OutDir -Filter *.txt -ErrorAction SilentlyContinue | Where-Object { $_.LastWriteTime -ge $since.AddSeconds(-5) } | Sort-Object LastWriteTime -Descending | Select-Object -First 1
  if ($f) { return $f }
  # 카톡이 다른 폴더(문서·다운로드·바탕화면 등)에 저장했으면 찾아서 저장 폴더로 옮김
  $dirs = @([Environment]::GetFolderPath("MyDocuments"), [Environment]::GetFolderPath("Desktop"), (Join-Path $env:USERPROFILE "Downloads"), (Join-Path $env:USERPROFILE "Documents"))
  if ($env:OneDrive) { $dirs += @((Join-Path $env:OneDrive "Documents"), (Join-Path $env:OneDrive "문서"), (Join-Path $env:OneDrive "Desktop"), (Join-Path $env:OneDrive "바탕 화면")) }
  foreach ($d in ($dirs | Select-Object -Unique)) {
    if (-not $d -or -not (Test-Path -LiteralPath $d)) { continue }
    foreach ($sub in @($d, (Join-Path $d "카카오톡 받은 파일"), (Join-Path $d "KakaoTalk Downloads"))) {
      if (-not (Test-Path -LiteralPath $sub)) { continue }
      $g = Get-ChildItem -LiteralPath $sub -Filter "KakaoTalk*.txt" -ErrorAction SilentlyContinue | Where-Object { $_.LastWriteTime -ge $since.AddSeconds(-5) } | Sort-Object LastWriteTime -Descending | Select-Object -First 1
      if ($g) {
        $dest = Join-Path $OutDir $g.Name
        try { Move-Item -LiteralPath $g.FullName -Destination $dest -Force; $script:dbg += "다른 폴더에서 찾아 옮김: " + $g.FullName; return (Get-Item -LiteralPath $dest) } catch { return $g }
      }
    }
  }
  return $null
}
# 완료 창의 [확인] 버튼이 노란색으로 바뀌었는지 화면 색으로 확인 → 노란 버튼 가운데 좌표를 돌려줌
function YellowOk($wh) {
  $r = New-Object W32+RECT; [W32]::GetWindowRect([IntPtr][long]$wh, [ref]$r) | Out-Null
  $w = $r.R - $r.L; $hh = $r.B - $r.T; if ($w -lt 40 -or $hh -lt 40) { return $null }
  $y0 = [int]($hh * 0.62); $bh = $hh - $y0
  try {
    $bmp = New-Object System.Drawing.Bitmap $w, $bh
    $g = [System.Drawing.Graphics]::FromImage($bmp); $g.CopyFromScreen($r.L, $r.T + $y0, 0, 0, $bmp.Size); $g.Dispose()
    $n = 0; $sx = 0; $sy = 0
    for ($y = 0; $y -lt $bh; $y += 2) { for ($x = [int]($w * 0.45); $x -lt $w; $x += 2) {
      $c = $bmp.GetPixel($x, $y); if ($c.R -gt 225 -and $c.G -gt 190 -and $c.B -lt 90) { $n++; $sx += $x; $sy += $y } } }
    $bmp.Dispose()
    if ($n -ge 30) { return @([int]($r.L + $sx / $n), [int]($r.T + $y0 + $sy / $n)) }
  } catch {}
  return $null
}
function Focus($h) { [W32]::Fg($h); Start-Sleep -Milliseconds 200 }
# 주의: 카톡 메인 창에서 Ctrl+A는 '친구 추가'라서 쓰지 않음 (End → Shift+Home 으로 지우기)
function Paste($text) { [System.Windows.Forms.Clipboard]::SetText($text); [System.Windows.Forms.SendKeys]::SendWait("{END}+{HOME}{BACKSPACE}"); Start-Sleep -Milliseconds 80; [System.Windows.Forms.SendKeys]::SendWait("^v") }

# 방이 안 열려 있으면 (카톡 PC에서 직접 확인한 순서)
#  1) 메인 창(숨어 있으면 꺼내기) → 왼쪽 채팅 아이콘
#  2) Ctrl+F(검색칸 열고 커서) → 방 이름 붙여넣기
#  3) 검색칸의 [통합검색] → [채팅] 탭(일반+오픈채팅 모두 나옴) → 첫 결과 더블클릭
# 좌표는 100% 배율 기준, DPI 인식 상태에서 창 위치(실제 픽셀) × 배율로 계산
[W32]::SetProcessDPIAware() | Out-Null
function MainWin {
  $all = @([W32]::List() | Where-Object { $pids -contains [int]$_[1] -and $_[2] -eq "카카오톡" -and $_[3] -like "EVA_Window*" })
  $v = $all | Where-Object { $_[4] -eq "1" } | Select-Object -First 1
  if ($v) { return $v }; return ($all | Select-Object -First 1)
}
function MainFocus {
  $m = MainWin; if (-not $m) { return $null }
  $h = [IntPtr][long]$m[0]; [W32]::ShowWindow($h, 9) | Out-Null; Start-Sleep -Milliseconds 150; Focus $h
  if ([W32]::GetForegroundWindow() -ne $h) { return $null }; return $h
}
# 링크 경고("주의") 같은 작은 안내창이 뜨면 [취소](ESC)로 닫기
function ClosePopups($before, $keep) {
  $n = 0
  foreach ($w in @(KWins | Where-Object { $before -notcontains $_[0] -and $_[0] -ne $keep -and $_[3] -like "EVA_Window*" })) {
    $r = New-Object W32+RECT; [W32]::GetWindowRect([IntPtr][long]$w[0], [ref]$r) | Out-Null
    if (($r.R - $r.L) -lt 700 -and ($r.B - $r.T) -lt 500) { Focus ([IntPtr][long]$w[0]); [System.Windows.Forms.SendKeys]::SendWait("{ESC}"); Start-Sleep -Milliseconds 250; $n++ }
  }
  if ($n) { $script:dbg += "안내창 닫음 $n" }
}
function Scale($h) { $s = [W32]::GetDpiForWindow($h) / 96.0; if ($s -le 0) { $s = 1 }; return $s }
function ClickIn($h, $rx, $ry, [switch]$FromRight, [switch]$Double) {
  $r = New-Object W32+RECT; [W32]::GetWindowRect($h, [ref]$r) | Out-Null; $s = Scale $h
  $x = if ($FromRight) { [int]($r.R - $rx * $s) } else { [int]($r.L + $rx * $s) }; $y = [int]($r.T + $ry * $s)
  $script:dbg += ("click {0},{1} -> {2},{3} (창 {4},{5},{6},{7} 배율 {8})" -f $rx, $ry, $x, $y, $r.L, $r.T, $r.R, $r.B, $s)
  if ($x -le $r.L -or $x -ge $r.R -or $y -le $r.T -or $y -ge $r.B) { return $false }
  if ($Double) { [W32]::DClick($x, $y) } else { [W32]::Click($x, $y) }
  Start-Sleep -Milliseconds 350; return $true
}
function ClickFrac($h, $fx, $fy, [switch]$Double) {
  $r = New-Object W32+RECT; [W32]::GetWindowRect($h, [ref]$r) | Out-Null
  $x = [int]($r.L + ($r.R - $r.L) * $fx); $y = [int]($r.T + ($r.B - $r.T) * $fy)
  $script:dbg += ("frac {0},{1} -> {2},{3}" -f $fx, $fy, $x, $y)
  if ($Double) { [W32]::DClick($x, $y) } else { [W32]::Click($x, $y) }
  Start-Sleep -Milliseconds 400
}
# 방 창이 뜰 때까지 기다리기 — 제목에 방 이름이 들어 있는 창만 인정 (다른 방·개인톡은 절대 저장 안 함)
function WaitRoom($name, $n = 24) {
  for ($i = 0; $i -lt $n; $i++) {
    Start-Sleep -Milliseconds 250
    $w = FindRoom $name; if ($w) { $script:dbg += "방 찾음: " + $w[2]; return ,$w }
  }
  return $null
}
# 엉뚱하게 열린 창(다른 방, 친구 추가 등)은 닫기
function CloseStray($known, $name, $keep) {
  foreach ($w in @(KWins | Where-Object { $known -notcontains $_[0] -and $_[2] -ne "카카오톡" -and $_[0] -ne $keep -and -not ($_[2] -and $_[2].Contains($name)) })) {
    [W32]::PostMessage([IntPtr][long]$w[0], 0x0010, [IntPtr]::Zero, [IntPtr]::Zero) | Out-Null }
}
function TryOpen($name) {
  $known = @(KWins | ForEach-Object { $_[0] })
  $h = MainFocus; if (-not $h) { return $null }
  ClickIn $h 38 118 | Out-Null                          # 왼쪽 말풍선(채팅) 아이콘
  if (-not (MainFocus)) { return $null }
  [System.Windows.Forms.SendKeys]::SendWait("^f"); Start-Sleep -Milliseconds 700   # Ctrl+F: 검색칸 열고 커서
  Paste $name; Start-Sleep -Milliseconds 500
  # 통합검색 (검색칸 오른쪽 끝 버튼)
  $h = MainFocus; if (-not $h) { return $null }
  $before = @(KWins | ForEach-Object { $_[0] })
  ClickIn $h 96 108 -FromRight | Out-Null
  $sw = $null
  for ($i = 0; $i -lt 12 -and -not $sw; $i++) { Start-Sleep -Milliseconds 250; $sw = KWins | Where-Object { $before -notcontains $_[0] -and $_[3] -ne "#32770" } | Select-Object -First 1 }
  if (-not $sw) { $script:dbg += "통합검색 창이 안 열림"; return $null }
  $sh = [IntPtr][long]$sw[0]; Focus $sh; Start-Sleep -Milliseconds 900
  ClickFrac $sh 0.216 0.232                             # [채팅] 탭
  Start-Sleep -Milliseconds 700
  ClickFrac $sh 0.29 0.373 -Double                      # 첫 결과
  $known2 = @($known) + @($sw[0])
  $w = WaitRoom $name 24
  [W32]::PostMessage($sh, 0x0010, [IntPtr]::Zero, [IntPtr]::Zero) | Out-Null   # 통합검색 창 닫기
  if ($w) { return ,$w }
  CloseStray $known $name ""
  return $null
}
function ClearSearch { }

foreach ($room in $rooms) {
  $name = [string]$room
  if (-not $name.Trim()) { continue }
  if (Stopped) { $result.errors += @{ room = ""; msg = "중단했어요" }; break }
  try {
    $hit = FindRoom $name; $openedByMe = $false
    if (-not $hit) {
      $hit = TryOpen $name
      ClearSearch
      if (-not $hit) { $result.errors += @{ room = $name; msg = "카톡에서 이 방을 못 찾았어요 — 설정에 적은 방 이름이 맞는지 확인해 주세요" }; continue }
      $openedByMe = $true
      Start-Sleep -Milliseconds 1200   # 방이 다 열릴 때까지
    }
    $h = [IntPtr][long]$hit[0]; Focus $h
    $before = @(KWins | ForEach-Object { $_[0] })
    $r = New-Object W32+RECT; [W32]::GetWindowRect($h, [ref]$r) | Out-Null
    # 대화 내용(링크)은 누르지 않도록: 먼저 클릭 없이 Ctrl+S, 안 되면 창 맨 위 빈 줄만 클릭
    $topX = [int]($r.L + ($r.R - $r.L) * 0.4); $topY = [int]($r.T + 6 * (Scale $h))
    [W32]::CtrlS()
    $dlg = $null
    for ($i = 0; $i -lt 60 -and -not $dlg; $i++) {
      Start-Sleep -Milliseconds 100
      $d = KWins | Where-Object { $_[3] -eq "#32770" } | Select-Object -First 1
      if ($d) { $dlg = $AE::FromHandle([IntPtr][long]$d[0]) }
    }
    if (-not $dlg) {   # 한 번 더 시도 (안내창이 떠 있으면 닫고, 창 맨 위 빈 곳만 클릭)
      ClosePopups $before $hit[0]
      Focus $h; [W32]::Click($topX, $topY); Start-Sleep -Milliseconds 300; [W32]::CtrlS()
      for ($i = 0; $i -lt 50 -and -not $dlg; $i++) { Start-Sleep -Milliseconds 100; $d = KWins | Where-Object { $_[3] -eq "#32770" } | Select-Object -First 1; if ($d) { $dlg = $AE::FromHandle([IntPtr][long]$d[0]) } }
    }
    if (-not $dlg) { ClosePopups $before $hit[0]; $result.errors += @{ room = $name; msg = "카톡 저장 창이 안 떠서 건너뛰었어요" }; $script:dbg += "저장 창 없음: " + $hit[2]; continue }
    $safe = ($name -replace '[\\/:*?"<>|]', '_')
    $path = Join-Path $OutDir ("KakaoTalk_{0}_{1}.txt" -f $safe, (Get-Date -Format "yyyyMMdd_HHmmss"))
    $dh = [IntPtr]$dlg.Current.NativeWindowHandle
    if (-not [W32]::SaveAs($dh, $path)) {
      $script:dbg += "저장 창 이름칸 직접 입력 실패 → 키보드로 입력"
      Focus $dh
      [System.Windows.Forms.SendKeys]::SendWait("%n"); Start-Sleep -Milliseconds 200   # Alt+N = 파일 이름 칸
      [System.Windows.Forms.Clipboard]::SetText($path)
      [System.Windows.Forms.SendKeys]::SendWait("^a{DEL}^v"); Start-Sleep -Milliseconds 250
      [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
    }
    # 내보내기 끝날 때까지(완료 창 또는 파일 크기 멈춤) 최대 7분
    $last = -1; $same = 0; $t0 = Get-Date; $popped = $false
    while (((Get-Date) - $t0).TotalSeconds -lt 420) {
      Start-Sleep -Milliseconds 250
      if (Stopped) { break }
      $pop = @(KWins | Where-Object { $before -notcontains $_[0] -and $_[3] -eq "EVA_Window_Dblclk" })
      $f = FindOut $path $t0
      $size = if ($f) { $f.Length } else { -1 }
      if ($size -gt 0 -and $size -eq $last) { $same++ } else { $same = 0 }
      $last = $size
      $ok = $null; foreach ($pw in $pop) { $ok = YellowOk $pw[0]; if ($ok) { break } }
      if ($ok) {   # 노란 [확인] = 내보내기 끝 → 바로 누름
        Start-Sleep -Milliseconds 200; [W32]::Click($ok[0], $ok[1]); $popped = $true; $script:dbg += "노란 확인 클릭"
        for ($k = 0; $k -lt 20 -and -not (FindOut $path $t0); $k++) { Start-Sleep -Milliseconds 150 }
        break
      }
      if ($pop.Count -and $size -gt 0 -and $same -ge 4) { $popped = $true; break }
      if ($same -ge 8) { break }
    }
    Start-Sleep -Milliseconds 150
    # 완료 창 [확인] (아직 남아 있으면)
    $pop = @(KWins | Where-Object { $before -notcontains $_[0] -and $_[3] -eq "EVA_Window_Dblclk" })
    if ($pop.Count) { foreach ($w in $pop) { Focus ([IntPtr][long]$w[0]); [System.Windows.Forms.SendKeys]::SendWait("{ENTER}") } }
    elseif (-not $popped -and (FindOut $path $t0)) { Focus $h; [System.Windows.Forms.SendKeys]::SendWait("{ENTER}") }
    Start-Sleep -Milliseconds 400
    # 남은 저장·덮어쓰기 창은 취소
    foreach ($w in @(KWins | Where-Object { $_[3] -eq "#32770" })) { Focus ([IntPtr][long]$w[0]); [System.Windows.Forms.SendKeys]::SendWait("{ESC}"); Start-Sleep -Milliseconds 300 }
    $f = FindOut $path $t0
    if ($f) { $result.saved += @{ room = $name; path = $f.FullName } }
    elseif ($popped) { $result.errors += @{ room = $name; msg = "카톡은 저장했는데 파일을 못 찾았어요 — 저장 폴더를 확인하거나 [다시]를 눌러 주세요" } }
    else { $result.errors += @{ room = $name; msg = "저장이 7분 안에 안 끝났어요 — [다시]를 눌러 주세요" } }
    [W32]::PostMessage($h, 0x0010, [IntPtr]::Zero, [IntPtr]::Zero) | Out-Null   # 카톡방 닫기
    Start-Sleep -Milliseconds 400
    Save
  } catch { $result.errors += @{ room = $name; msg = $_.Exception.Message } }
}
Done
