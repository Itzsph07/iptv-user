@echo off
echo Cleaning...
cd android
call gradlew clean
call gradlew cleanBuildCache
rmdir /s /q .gradle
cd ..
rmdir /s /q node_modules
del package-lock.json

echo Reinstalling...
call npm install

echo Prebuilding...
call npx expo prebuild --clean

echo Building...
cd android
call gradlew assembleDebug
echo Done!