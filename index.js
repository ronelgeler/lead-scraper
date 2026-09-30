const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

async function scrapeLeads(searchQuery) {
    console.log(`Starting scraper for: ${searchQuery}`);
    
    // Launch browser (will use the PC's local Chrome)
    const browser = await puppeteer.launch({ 
        headless: false, // Set to false so you can see it working and bypass captchas if needed
        defaultViewport: null
    });
    
    const page = await browser.newPage();
    
    // Go to B144, Easy.co.il, or Google Maps
    // For this example, we'll do a generic Google Maps search
    console.log("Navigating to Google Maps...");
    await page.goto(`https://www.google.com/maps/search/${encodeURIComponent(searchQuery)}`, {
        waitUntil: 'networkidle2'
    });
    
    console.log("Waiting for results to load...");
    await page.waitForTimeout(5000); // Wait for the local pack to render
    
    // Scroll the results panel to load more
    await page.evaluate(async () => {
        const wrapper = document.querySelector('div[role="feed"]');
        if (wrapper) {
            wrapper.scrollBy(0, 1000);
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    });

    const leads = await page.evaluate(() => {
        const results = [];
        // Google Maps business cards usually have role="article" or are nested in the feed
        const cards = Array.from(document.querySelectorAll('div[role="feed"] > div > div'));
        
        cards.forEach(card => {
            const text = card.innerText || "";
            if (text.includes("05")) {
                const lines = text.split('\n').map(l => l.trim()).filter(l => l);
                // Name is usually the first line
                const name = lines[0];
                // Find phone
                const phoneMatch = text.match(/05\d[-]*\d{7}/);
                // Check if website exists
                const hasWebsite = text.includes("אתר") || text.toLowerCase().includes("website");
                
                if (phoneMatch && !hasWebsite) {
                    results.push({
                        name: name,
                        phone: phoneMatch[0],
                        rawText: lines.slice(0, 4).join(" | ")
                    });
                }
            }
        });
        
        // Deduplicate
        const uniqueLeads = [];
        const seen = new Set();
        for (const lead of results) {
            if (!seen.has(lead.phone)) {
                seen.add(lead.phone);
                uniqueLeads.push(lead);
            }
        }
        return uniqueLeads;
    });

    console.log("=== SCRAPE COMPLETE ===");
    console.log(`Found ${leads.length} leads without websites:`);
    console.table(leads);
    
    await browser.close();
    return leads;
}

// Run the script
scrapeLeads("קבלן שיפוצים באר שבע");
