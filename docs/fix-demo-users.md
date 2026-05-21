# Fix demo data build error and family user names

This patch updates the allowed family usernames to:
- kameron
- mike
- quentin

Also remove the old lib/demoData.ts file from the project after applying this patch. That file is no longer used in ready mode and can fail TypeScript builds because it does not match the new Profile type.
