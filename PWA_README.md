# StockHub PWA Setup Guide

This document explains how to set up StockHub as a Progressive Web App (PWA) on your iPhone.

## For Users: Installing StockHub on your iPhone

1. Open Safari on your iPhone
2. Navigate to the StockHub website URL
3. Tap the Share button at the bottom of the screen (square with an arrow pointing up)
4. Scroll down and tap "Add to Home Screen"
5. Choose a name for the app or keep the suggested "StockHub"
6. Tap "Add" in the top-right corner

The app will now be installed on your home screen and will operate like a native app:
- Full-screen without Safari UI
- Offline capability
- Fast loading times

## For Developers: Deployment Instructions

To ensure the PWA works properly, follow these deployment guidelines:

1. Always build the app with the PWA service worker:
   ```
   npm run build
   ```

2. Deploy the app to a hosting service that supports HTTPS (required for PWAs):
   - Netlify
   - Vercel
   - Firebase Hosting
   - GitHub Pages

3. Make sure the following files are properly served:
   - manifest.json
   - service-worker.js 
   - All icon files

4. Test your PWA using:
   - Chrome DevTools Lighthouse audit
   - Safari on iOS
   - PWA validation tools like https://www.pwabuilder.com/

5. For local testing, you can use:
   ```
   npx serve -s build
   ```

## PWA Features Implemented

- Full offline support
- Installable on iOS home screen
- Custom icons and splash screens
- iOS UI optimizations
- No browser chrome when running as installed app

## Troubleshooting

If the PWA isn't working properly:

1. Make sure you're using HTTPS
2. Clear your browser cache
3. Check the console for service worker errors
4. Verify manifest.json is being served correctly
5. Ensure all icons are available at the specified paths 