#!/usr/bin/env bash
# Builds RecruitmentOperations_<version>.zip, the importable Dataverse solution.
# Needs python3 and the Power Platform CLI (`pac`, from the NuGet package
# Microsoft.PowerApps.CLI.Tool). Optional: pass the `src` folder of a real
# exported solution (for example the CoE Starter Kit's
# CenterofExcellenceCoreComponents/SolutionPackage/src) to compare every
# column's XML against Dataverse's own output.
set -euo pipefail
cd "$(dirname "$0")"
python3 build.py
python3 verify.py "$@"
version=$(sed -n 's:.*<Version>\(.*\)</Version>.*:\1:p' src/Other/Solution.xml | tr . _)
zip="RecruitmentOperations_${version}.zip"
rm -f "$zip"
pac solution pack --zipfile "$zip" --folder src --packagetype Unmanaged >/dev/null
echo "Packed $zip"
