$ErrorActionPreference = 'Stop'

$stage = 'target'
$failureCode = 'RELEASE_TARGET_MISMATCH'
$resultCode = 0
$frontendRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$expectedRoot = [IO.Path]::GetFullPath('C:\Users\khale\Desktop\ianalyze-academy\.worktrees\production-release-98ad199-20261121\frontend')
$privateNames = @('SUPABASE_ACCESS_TOKEN', 'ACADEMY_LEADER_USER_ID', 'CLOUDFLARE_API_TOKEN')
$originalEnvironment = @{}
$environmentNames = @(
    'SUPABASE_PROJECT_ID',
    'PRODUCTION_ORIGIN',
    'VITE_SUPABASE_URL',
    'VITE_SUPABASE_PUBLISHABLE_KEY',
    'ACADEMY_REGISTRATION_APPROVED',
    'ACADEMY_NOTEBOOK_SUBMISSIONS_APPROVED',
    'ACADEMY_LEADERBOARD_APPROVED',
    'CLOUDFLARE_ACCOUNT_ID',
    'CLOUDFLARE_PAGES_PROJECT',
    'CLOUDFLARE_PRODUCTION_BRANCH'
) + $privateNames

foreach ($name in $environmentNames) {
    $originalEnvironment[$name] = [Environment]::GetEnvironmentVariable($name, 'Process')
}

function Get-GitOutput([string[]]$Arguments) {
    $output = & git -C $frontendRoot @Arguments 2>$null
    if ($LASTEXITCODE -ne 0) { throw 'git' }
    return ($output -join "`n").Trim()
}

try {
    if ($frontendRoot -ine $expectedRoot) { throw 'path' }

    $branch = Get-GitOutput @('branch', '--show-current')
    if ($branch -cne 'fix/database-security-owner-transition-20261121') { throw 'branch' }
    $remote = Get-GitOutput @('remote', 'get-url', 'origin')
    if ($remote -cne 'https://github.com/khaled-amireh/ianalyze-academy.git') { throw 'remote' }
    $head = Get-GitOutput @('rev-parse', 'HEAD')
    if ($head -cne '98ad19916269f45c32e689f9226f6b1185bc99b3') { throw 'head' }
    $mainLine = Get-GitOutput @('ls-remote', 'origin', 'refs/heads/main')
    $mainSha = ($mainLine -split '\s+')[0]
    if ($mainSha -cne $head) { throw 'main' }
    & git -C $frontendRoot diff --cached --quiet 2>$null
    if ($LASTEXITCODE -ne 0) { throw 'index' }

    $stage = 'github-auth'
    $failureCode = 'GITHUB_IDENTITY_OR_ACCESS_UNAVAILABLE'
    $login = & gh api user --jq '.login' 2>$null
    if ($LASTEXITCODE -ne 0 -or (($login -join '').Trim() -cne 'khaled-amireh')) { throw 'github-auth' }

    $stage = 'repository-variables'
    $failureCode = 'GITHUB_VARIABLES_UNAVAILABLE_OR_MISMATCHED'
    $rows = & gh variable list --repo khaled-amireh/ianalyze-academy --json name,value --jq '.[] | [.name, .value] | @tsv' 2>$null
    if ($LASTEXITCODE -ne 0) { throw 'variables' }
    $variables = @{}
    foreach ($row in $rows) {
        $cells = [string]$row -split "`t", 2
        if ($cells.Count -ne 2 -or [string]::IsNullOrWhiteSpace($cells[0])) { throw 'variable-format' }
        $variables[$cells[0]] = $cells[1]
    }

    $expected = @{
        ACADEMY_REGISTRATION_APPROVED = 'true'
        ACADEMY_NOTEBOOK_SUBMISSIONS_APPROVED = 'true'
        ACADEMY_LEADERBOARD_APPROVED = 'true'
        SUPABASE_PROJECT_ID = 'ocihwiqtgqplwgyhpwjv'
        PRODUCTION_ORIGIN = 'https://ianalyze-academy.pages.dev'
        VITE_SUPABASE_URL = 'https://ocihwiqtgqplwgyhpwjv.supabase.co'
        CLOUDFLARE_ACCOUNT_ID = 'f25401b10b1826c747cd11739a9410bc'
        CLOUDFLARE_PAGES_PROJECT = 'ianalyze-academy'
        CLOUDFLARE_PRODUCTION_BRANCH = 'main'
    }
    foreach ($name in $expected.Keys) {
        if (-not $variables.ContainsKey($name) -or $variables[$name] -cne $expected[$name]) {
            $failureCode = "REPOSITORY_VARIABLE_MISMATCH:$name"
            throw 'variable-value'
        }
    }
    $publishableKey = $variables['VITE_SUPABASE_PUBLISHABLE_KEY']
    if ([string]::IsNullOrWhiteSpace($publishableKey) -or $publishableKey -cnotmatch '^sb_publishable_[A-Za-z0-9_-]+$') {
        $failureCode = 'BROWSER_PUBLISHABLE_KEY_MISSING_OR_INVALID'
        throw 'publishable-key'
    }
    $expected['VITE_SUPABASE_PUBLISHABLE_KEY'] = $publishableKey

    foreach ($name in $expected.Keys) {
        $current = [Environment]::GetEnvironmentVariable($name, 'Process')
        if ($current -and $current -cne $expected[$name]) {
            $failureCode = "PROCESS_CONFIGURATION_MISMATCH:$name"
            throw 'process-value'
        }
        [Environment]::SetEnvironmentVariable($name, $expected[$name], 'Process')
    }

    $stage = 'private-readiness-inputs'
    $failureCode = 'PRIVATE_READINESS_INPUT_MISSING_OR_INVALID'
    foreach ($name in @('SUPABASE_ACCESS_TOKEN', 'ACADEMY_LEADER_USER_ID')) {
        if (-not [Environment]::GetEnvironmentVariable($name, 'Process')) {
            $secure = Read-Host "Existing approved $name (masked; process only)" -AsSecureString
            $pointer = [IntPtr]::Zero
            try {
                $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
                $value = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
                [Environment]::SetEnvironmentVariable($name, $value, 'Process')
            } finally {
                if ($pointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
                $secure.Dispose()
                Remove-Variable -Name value -ErrorAction SilentlyContinue
            }
        }
        if (-not [Environment]::GetEnvironmentVariable($name, 'Process')) { throw 'private-input' }
    }
    if ([Environment]::GetEnvironmentVariable('ACADEMY_LEADER_USER_ID', 'Process') -notmatch '^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$') {
        throw 'leader-id'
    }

    $stage = 'registration-readiness'
    $failureCode = 'READ_ONLY_REGISTRATION_PROOF_FAILED'
    & node (Join-Path $frontendRoot 'scripts/check-registration-readiness.mjs')
    if ($LASTEXITCODE -ne 0) { throw 'registration-proof' }

    # Private Management API inputs are needed only for the SELECT-only proof.
    # Do not pass them into npm, tests, or the production build.
    foreach ($name in $privateNames) {
        [Environment]::SetEnvironmentVariable($name, $null, 'Process')
    }

    $stage = 'release-check'
    $failureCode = 'LOCAL_RELEASE_CHECK_FAILED'
    $npmExitCode = 1
    Push-Location -LiteralPath $frontendRoot
    try {
        & npm.cmd run release:check
        $npmExitCode = $LASTEXITCODE
    } finally {
        Pop-Location
    }
    if ($npmExitCode -ne 0) { throw 'release-check' }

    $stage = 'configured-artifact'
    $failureCode = 'CONFIGURED_PAGES_ARTIFACT_METADATA_INVALID'
    $metadataPath = Join-Path $frontendRoot 'artifacts/configured-build.json'
    $metadata = Get-Content -LiteralPath $metadataPath -Raw | ConvertFrom-Json
    if (
        $metadata.project -cne 'ocihwiqtgqplwgyhpwjv' -or
        $metadata.registration -ne $true -or
        $metadata.submissions -ne $true -or
        $metadata.leaderboard -ne $true -or
        $metadata.privacyApproved -ne $true -or
        $metadata.developmentPreviews -ne $false
    ) { throw 'artifact-metadata' }

    Write-Output 'Configured artifact metadata: registration=true, submissions=true, leaderboard=true, privacyApproved=true, developmentPreviews=false.'
    Write-Output 'PASS: registration readiness, release:check, and configured Pages artifact verification.'
} catch {
    $resultCode = 1
    Write-Output ("FAIL [{0}]: {1}" -f $stage, $failureCode)
} finally {
    foreach ($name in $environmentNames) {
        [Environment]::SetEnvironmentVariable($name, $originalEnvironment[$name], 'Process')
    }
}

if ($resultCode -ne 0) { throw 'Configured release check stopped; use the sanitized failure code above.' }
