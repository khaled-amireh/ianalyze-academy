import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(
  new URL('../scripts/run-configured-release-check.ps1', import.meta.url),
  'utf8',
);

test('PowerShell handoff parses GitHub variables as TSV rows, not a nested JSON array', () => {
  assert.match(source, /--json name,value --jq '\.\[\] \| \[\.name, \.value\] \| @tsv'/);
  assert.match(source, /\[string\]\$row -split "`t", 2/);
  assert.doesNotMatch(source, /@\(\$\w+\s*\|\s*ConvertFrom-Json\)/);
});

test('PowerShell handoff pins the exact candidate, remote, baseline, and approved configuration', () => {
  for (const value of [
    'production-release-98ad199-20261121\\frontend',
    'fix/database-security-owner-transition-20261121',
    'https://github.com/khaled-amireh/ianalyze-academy.git',
    '98ad19916269f45c32e689f9226f6b1185bc99b3',
    'ocihwiqtgqplwgyhpwjv',
    'https://ianalyze-academy.pages.dev',
    'ACADEMY_REGISTRATION_APPROVED',
    'ACADEMY_NOTEBOOK_SUBMISSIONS_APPROVED',
    'ACADEMY_LEADERBOARD_APPROVED',
  ])
    assert.ok(source.includes(value), `Missing release preflight guard: ${value}`);
  assert.ok(source.includes("'^sb_publishable_[A-Za-z0-9_-]+$'"));
});

test('PowerShell handoff prompts privately, clears management credentials before npm, and restores process state', () => {
  assert.match(source, /Read-Host .* -AsSecureString/);
  assert.match(source, /SecureStringToBSTR/);
  assert.match(source, /ZeroFreeBSTR/);
  assert.match(source, /Remove-Variable -Name value -ErrorAction SilentlyContinue/);
  const proof = source.indexOf("'scripts/check-registration-readiness.mjs'");
  const clear = source.indexOf('foreach ($name in $privateNames)', proof);
  const release = source.indexOf('& npm.cmd', clear);
  assert.ok(proof >= 0 && clear > proof && release > clear);
  assert.match(source, /finally\s*\{[\s\S]*originalEnvironment\[\$name\]/);
});

test('PowerShell handoff stops on native failures and verifies configured artifact gates', () => {
  assert.match(source, /if \(\$LASTEXITCODE -ne 0\) \{ throw 'registration-proof' \}/);
  assert.match(
    source,
    /\$npmExitCode = \$LASTEXITCODE[\s\S]*?finally \{\s*Pop-Location\s*\}[\s\S]*?if \(\$npmExitCode -ne 0\) \{ throw 'release-check' \}/,
  );
  assert.match(source, /metadata\.registration -ne \$true/);
  assert.match(source, /metadata\.submissions -ne \$true/);
  assert.match(source, /metadata\.leaderboard -ne \$true/);
  assert.match(source, /metadata\.developmentPreviews -ne \$false/);
  assert.match(source, /Write-Output \("FAIL \[\{0\}\]: \{1\}" -f \$stage, \$failureCode\)/);
  assert.doesNotMatch(
    source,
    /Write-Output[^\r\n]*(?:\$value|\$publishableKey|ACCESS_TOKEN|LEADER_USER_ID)/,
  );
});
