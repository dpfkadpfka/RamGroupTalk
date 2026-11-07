; 설치·업데이트 뒤 윈도우 아이콘 캐시 새로 고침 (예전 기본 아이콘이 남아 보이는 문제)
!macro customInstall
  nsExec::Exec '"$WINDIR\System32\ie4uinit.exe" -show'
!macroend
