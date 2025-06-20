@echo off
echo Fixing git history to remove secrets...

REM Set git path
set GIT_PATH="C:\Program Files\Git\bin\git.exe"

REM Abort any existing rebase
%GIT_PATH% rebase --abort 2>nul

REM Remove rebase directory if it exists
if exist ".git\rebase-merge" (
    rmdir /s /q ".git\rebase-merge"
)

REM Create a new branch without the problematic commit
%GIT_PATH% checkout --orphan temp_branch

REM Add all files
%GIT_PATH% add .

REM Create a new clean commit
%GIT_PATH% commit -m "Initial commit: GlitchHaven Discord Bot with moderation, games, and welcome features"

REM Delete the old main branch and rename temp to main
%GIT_PATH% branch -D main
%GIT_PATH% branch -m main

REM Force push to GitHub
echo Pushing to GitHub...
%GIT_PATH% push -f origin main

echo Done! Your repository should now be clean and pushed to GitHub.
pause 