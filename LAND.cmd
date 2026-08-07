@echo off
REM ============================================================================
REM  LAND.cmd - the ZIGVERSE LANDING STEP
REM
REM  Double-click this after dropping new files into the Zigverse folder.
REM  It commits everything and pushes it to GitHub so Glyph can read it.
REM
REM  Keep this file in C:\Users\billy\Zigverse  (the repo root).
REM ============================================================================

cd /d "%~dp0"

echo.
echo   ZIGVERSE - landing changes
echo   ==========================
echo.

git rev-parse --is-inside-work-tree >nul 2>&1
if errorlevel 1 (
  echo   ERROR: this folder is not a git repository.
  echo   LAND.cmd must sit in C:\Users\billy\Zigverse
  echo.
  pause
  exit /b 1
)

echo   What changed:
echo.
git status --short
echo.

git diff --quiet && git diff --cached --quiet
if not errorlevel 1 (
  git status --porcelain | findstr /r "." >nul
  if errorlevel 1 (
    echo   Nothing to land - already up to date.
    echo.
    pause
    exit /b 0
  )
)

set /p MSG=  Describe it in a few words (or press Enter): 
if "%MSG%"=="" set MSG=Session update

echo.
echo   Committing...
git add -A
git commit -m "%MSG%"

echo.
echo   Pushing to GitHub...
git push

if errorlevel 1 (
  echo.
  echo   PUSH FAILED. You may need to sign in to GitHub in your browser,
  echo   then double-click LAND.cmd again.
) else (
  echo.
  echo   DONE. Glyph can now read this.
)

echo.
pause
