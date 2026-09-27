---
name: GitHub publishing
description: Publishing repository commits when the workspace Git remote rejects shell authentication.
---

When the workspace Git remote rejects HTTPS authentication but an authorized GitHub integration is available, publish through the connector's authenticated Git API instead of requesting credentials or changing the remote.

**Why:** Shell Git credentials and the Replit-managed GitHub connection can have different authorization states; asking for a token would bypass the managed integration.

**How to apply:** Verify the remote branch head and expected parent first, create the blob/tree/commit through the GitHub API, and update the branch ref with `force: false`. Confirm the resulting remote ref before reporting success.