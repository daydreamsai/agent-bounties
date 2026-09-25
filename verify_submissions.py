#!/usr/bin/env python3
"""Validate bounty submission markdown files."""
import os
import sys
from pathlib import Path

REQUIRED_SECTIONS = [
    "# ",           # Title
    "## Agent Description",
    "## Live Deployment",
    "## Bounty",
    "## Acceptance Criteria",
    "## Solana Wallet",
]

SUBMISSIONS_DIR = Path(__file__).parent / "submissions"


def validate_submission(filepath: Path) -> list[str]:
    errors = []
    text = filepath.read_text(encoding="utf-8", errors="ignore")

    for section in REQUIRED_SECTIONS:
        if section not in text:
            errors.append(f"  Missing section: {section}")

    if "example.com" not in text:
        errors.append("  Deployment URL should contain example.com placeholder")

    return errors


def main() -> int:
    failed = 0
    total = 0

    # Check required files exist
    for name in ["readme.md", ".github/PULL_REQUEST_TEMPLATE.md", "submissions/README.md"]:
        path = Path(__file__).parent / name
        if not path.exists():
            print(f"FAIL: Missing required file: {name}")
            failed += 1

    # Validate each submission
    submission_files = sorted(SUBMISSIONS_DIR.glob("*.md"))
    submission_files = [f for f in submission_files if f.name != "README.md"]

    if not submission_files:
        print("FAIL: No submission files found in submissions/")
        return 1

    for filepath in submission_files:
        total += 1
        errors = validate_submission(filepath)
        if errors:
            print(f"FAIL: {filepath.name}")
            for err in errors:
                print(err)
            failed += 1
        else:
            print(f"OK: {filepath.name}")

    print(f"\n{total - failed}/{total} submissions valid")
    if failed:
        print(f"FAIL: {failed} submission(s) failed validation")
        return 1
    print("PASS")
    return 0


if __name__ == "__main__":
    sys.exit(main())
