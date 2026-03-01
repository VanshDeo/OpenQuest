const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security']
    });
    const page = await browser.newPage();

    page.on('console', msg => console.log('BROWSER LOG:', msg.type(), msg.text()));
    page.on('pageerror', error => console.error('BROWSER ERROR:', error.message));
    page.on('requestfailed', request =>
        console.log(`REQUEST FAILED: ${request.url()} - ${request.failure()?.errorText}`)
    );

    console.log("Navigating to http://localhost:3000/analyze ...");
    try {
        await page.goto('http://localhost:3000/analyze', { waitUntil: 'networkidle0', timeout: 15000 });
        console.log("Page loaded. Waiting a few seconds for 3D to render...");
        await new Promise(r => setTimeout(r, 5000));
    } catch (e) {
        console.error("Navigation failed:", e);
    }

    await browser.close();
})();
