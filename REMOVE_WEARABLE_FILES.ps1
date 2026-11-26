# Run from Project Exodus root AFTER extracting the rollback ZIP
Remove-Item -LiteralPath 'src/client/exodusOutfit.ts' -ErrorAction SilentlyContinue
# Optional: remove wearable model copies only if no longer needed:
# Remove-Item -LiteralPath 'assets/Models/ExodusSoldier' -Recurse -Force -ErrorAction SilentlyContinue
Write-Host 'Wearable integration module removed. Restart Creator Hub.'
