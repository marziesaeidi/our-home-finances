$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
$token = Read-Host 'Paste only your ngrok authtoken (input is hidden)' -AsSecureString
$tokenPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($token)
try {
    $plainToken = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($tokenPointer)
    & ./data/ngrok/ngrok.exe config add-authtoken $plainToken --config ./data/ngrok/ngrok.yml
    if ($LASTEXITCODE -ne 0) { throw 'ngrok authentication configuration failed' }
} finally {
    $plainToken = $null
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($tokenPointer)
    $token.Dispose()
}
Write-Host 'ngrok authentication is configured. You can return to the chat.'
