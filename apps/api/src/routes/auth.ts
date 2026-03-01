import { Router } from "express";
import passport from "../config/passport";
import { config } from "../config/env";

export const authRouter = Router();

// Initiate GitHub OAuth flow
authRouter.get(
    "/github",
    passport.authenticate("github", { scope: ["user:email", "read:user"] })
);

// GitHub OAuth callback
authRouter.get(
    "/github/callback",
    passport.authenticate("github", {
        failureRedirect: `${config.FRONTEND_URL}?error=auth_failed`,
    }),
    (req, res) => {
        // Successful authentication → explicitly save session before redirect
        req.session.save((err) => {
            if (err) {
                console.error("Session save error:", err);
                return res.redirect(`${config.FRONTEND_URL}?error=session_error`);
            }
            const redirectUrl = new URL('/projects', config.FRONTEND_URL);
            redirectUrl.searchParams.set('login', 'success');
            res.redirect(redirectUrl.toString());
        });
    }
);

// Check authentication status
authRouter.get("/status", (req, res) => {
    if (req.isAuthenticated && req.isAuthenticated()) {
        const user = req.user as any;
        res.json({
            authenticated: true,
            user: {
                id: user.id,
                username: user.username,
                name: user.name,
                avatarUrl: user.avatarUrl,
                email: user.email,
                skillProfile: user.skillProfile
                    ? {
                        overallLevel: user.skillProfile.overallLevel,
                        totalRepos: user.skillProfile.totalRepos,
                        totalStars: user.skillProfile.totalStars,
                        contributionCount: user.skillProfile.contributionCount,
                        accountAgeYears: user.skillProfile.accountAgeYears,
                        languageStats: user.skillProfile.languageStats,
                    }
                    : null,
                preferences: user.preferences
                    ? {
                        experienceLevel: user.preferences.experienceLevel,
                        preferredLanguages: user.preferences.preferredLanguages,
                        contributionTypes: user.preferences.contributionTypes,
                        goal: user.preferences.goal,
                    }
                    : null,
            },
        });
    } else {
        res.json({ authenticated: false });
    }
});

// Logout
authRouter.post("/logout", (req, res) => {
    req.logout((err: any) => {
        if (err) {
            return res.status(500).json({ error: "Logout failed" });
        }
        res.json({ success: true });
    });
});
