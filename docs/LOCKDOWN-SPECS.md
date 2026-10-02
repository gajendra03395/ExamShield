# Desktop kiosk behavior and limits

The Windows WPF kiosk uses a borderless topmost window, a low-level keyboard hook, taskbar hiding, WebView2 restrictions, screen-count checks, process-start monitoring, USB notifications, and focus monitoring. Exams run in the kiosk window and use the same authenticated API as the web panel. The desktop checks API health during the exam, queues security reports locally during outages, and retries them after reconnection.

The kiosk blocks common app-switching and clipboard keyboard shortcuts, including Alt+Tab, Alt+F4, Windows, Print Screen, Ctrl+Esc, Ctrl+C/V/X, and insert-key copy/paste shortcuts. It detects configured prohibited process launches and sends a violation to the server; it deliberately does not kill other applications or erase the Windows clipboard because doing so can destroy unsaved user work.

This application is a deterrent and monitoring client, not an operating-system security boundary. It cannot block the secure attention sequence (Ctrl+Alt+Delete), protect against a local administrator, prevent all virtual-machine or screen-capture methods, or guarantee kiosk integrity if the student can access Windows settings or another account. Colleges requiring stronger guarantees should deploy managed exam accounts and Windows kiosk/AppLocker policies, restrict removable media and display changes centrally, and test their endpoint-security configuration before exams.

The taskbar is restored when lockdown ends and during normal application exit. A forced process termination or power loss can still prevent application cleanup; managed Windows kiosk policy should remain the recovery mechanism.
