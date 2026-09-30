const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

async function main() {
    console.log("Starting Local Scraper...");
    console.log("Launching a real Chrome browser on your PC to bypass Cloudflare/Bot protection...");
    
    const browser = await puppeteer.launch({ 
        headless: false, // Opens an actual window on your PC
        defaultViewport: null,
        args: ['--start-maximized']
    });

    const page = await browser.newPage();
    
    // --- B144 EXAMPLE ---
    console.log("Navigating to B144...");
    await page.goto('https://www.b144.co.il/', { waitUntil: 'domcontentloaded' });
    
    console.log("======================================================");
    console.log("ACTION REQUIRED: Search for a niche and city in the browser!");
    console.log("Waiting 20 seconds for you to navigate to the results page...");
    console.log("======================================================");
    await new Promise(r => setTimeout(r, 20000));

    console.log("Auto-clicking all 'Reveal Phone' (הצגת מספר) buttons...");
    await page.evaluate(async () => {
        window.scrollBy(0, 1000); // Scroll down to load lazy elements
        const buttons = Array.from(document.querySelectorAll('button'));
        for (const btn of buttons) {
            if (btn.innerText && btn.innerText.includes('הצגת מספר')) {
                btn.click();
                await new Promise(r => setTimeout(r, 800)); // wait for API to fetch real number
            }
        }
    });

    console.log("Waiting 3 seconds for the real numbers to load in the DOM...");
    await new Promise(r => setTimeout(r, 3000));

    // Extract real 05 mobile numbers
    const leads = await page.evaluate(() => {
        const results = [];
        const mobileRegex = /05\d[-]*\d{7}/g;
        
        // Method 1: Check Tel links (often updated after clicking reveal)
        document.querySelectorAll('a[href^="tel:"]').forEach(a => {
            if (a.href.match(mobileRegex)) results.push(a.href.replace('tel:', ''));
        });

        // Method 2: Fallback text extraction across the whole page
        const textMatches = document.body.innerText.match(mobileRegex) || [];
        textMatches.forEach(m => results.push(m.replace('-', '')));

        // Deduplicate
        return [...new Set(results)];
    });

    console.log("\n=== REAL MOBILE NUMBERS EXTRACTED ===");
    console.log(leads);
    console.log("=====================================\n");
    console.log("Script finished. You can now close the browser.");
    
    // Optionally: Here is where we will add the Notion API code later 
    // to push these numbers straight into your Notion CRM!
}

main().catch(console.error);
