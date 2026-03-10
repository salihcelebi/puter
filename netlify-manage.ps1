Set-Location "C:\Users\salih\Desktop\puter\netfly"
& "$env:APPDATA\npm\netlify.cmd" link
& "$env:APPDATA\npm\netlify.cmd" deploy --prod --dir=dist