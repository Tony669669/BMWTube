# Premium session diagnostic

Open Settings → Kiểm tra Premium trong player, or `premium-check.html` on the same deployed origin. It uses the official youtube.com IFrame player with native controls, manual playback, and no YouTube Data API requests. Supply a video URL or enter from the currently selected BMWTube video.

The sign-in link opens YouTube in the same browsing tab. Use APTV Back after signing in. Video ID and whole-second playback position are stored in the current history URL before leaving. A sessionStorage marker reloads a restored back-forward-cache page once; normal navigation reconstructs the player from the URL. Explicit Reload also preserves position. Return to BMWTube transfers the diagnostic video and position. No OAuth tokens, passwords, or YouTube cookies are read or stored.

Manual acceptance on APTV is still required:
- Open a known embeddable video, play with native controls, record any account prompt or error code.
- Sign in to the Premium account in the same APTV browser, return, and play again.
- Compare the native diagnostic and the normal BMWTube player.
- Check return position, reload, APTV restart, driver/passenger placement and 1422 × 456 viewport.
- Record whether ads or a YouTube account indicator appear. No ads alone is not proof of Premium.

The page cannot request third-party storage access on YouTube's behalf or inspect the cross-origin player account. No Premium-connected badge is inferred from playback. If APTV does not expose the session to the embedded player, this feature does not solve that limitation. Backend/OAuth is not added.
