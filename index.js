const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');

puppeteer.use(StealthPlugin());

async function main() {
    const args = process.argv.slice(2);
    const startUrl = args[0] || 'https://www.b144.co.il/';
    const maxPages = parseInt(args[1]) || 5; // Default scrape 5 pages

    console.log(`Starting Local Auto-Scraper`);
    console.log(`Target URL: ${startUrl}`);
    console.log(`Max pages to scrape: ${maxPages}`);
    console.log("Launching browser to bypass Cloudflare...");

    const browser = await puppeteer.launch({ 
        headless: false, // Must be false to bypass bot protection visually
        defaultViewport: null,
        args: ['--start-maximized']
    });

    const page = await browser.newPage();
    let allLeads = [];

    await page.goto(startUrl, { waitUntil: 'domcontentloaded' });
    
    // If user started at home page, wait for them to search
    if (startUrl === 'https://www.b144.co.il/') {
        console.log("======================================================");
        console.log("ACTION REQUIRED: Search for a niche and city in the browser!");
        console.log("Waiting 20 seconds for you to navigate to the results page...");
        console.log("======================================================");
        await new Promise(r => setTimeout(r, 20000));
    }

    for (let currentPage = 1; currentPage <= maxPages; currentPage++) {
        console.log(`\n--- Scraping Page ${currentPage} ---`);
        
        // 1. Scroll to load lazy elements
        console.log("Scrolling page to load all businesses...");
        for(let i=0; i<5; i++) {
            await page.evaluate(() => window.scrollBy(0, 800));
            await new Promise(r => setTimeout(r, 500));
        }

        // 2. Click all Reveal buttons
        console.log("Auto-clicking 'Reveal Phone' buttons...");
        await page.evaluate(async () => {
            const buttons = Array.from(document.querySelectorAll('button'));
            for (const btn of buttons) {
                if (btn.innerText && (btn.innerText.includes('הצגת מספר') || btn.innerText.includes('טלפון'))) {
                    btn.click();
                    await new Promise(r => setTimeout(r, 600)); // wait for network
                }
            }
        });

        console.log("Waiting 3 seconds for numbers to render...");
        await new Promise(r => setTimeout(r, 3000));

        // 3. Extract numbers
        const pageLeads = await page.evaluate(() => {
            const results = [];
            const mobileRegex = /05\d[-]*\d{7}/g;
            
            // Try to extract from tel links
            document.querySelectorAll('a[href^="tel:"]').forEach(a => {
                const match = a.href.match(mobileRegex);
                if (match) {
                    // Try to find the closest business name
                    let name = "Unknown";
                    let card = a.closest('a, div.bg-white'); // standard card classes
                    if(card) {
                        const heading = card.querySelector('h2, h3');
                        if (heading) name = heading.innerText.trim();
                    }
                    results.push({ name, phone: match[0].replace('-', '') });
                }
            });

            // Fallback for raw text
            const textMatches = document.body.innerText.match(mobileRegex) || [];
            textMatches.forEach(m => {
                results.push({ name: "Extracted from text", phone: m.replace('-', '') });
            });

            return results;
        });

        // Deduplicate within the page
        const uniquePageLeads = [];
        const seen = new Set();
        for (const lead of pageLeads) {
            if (!seen.has(lead.phone)) {
                seen.add(lead.phone);
                uniquePageLeads.push(lead);
            }
        }

        console.log(`Extracted ${uniquePageLeads.length} unique leads from this page.`);
        allLeads = allLeads.concat(uniquePageLeads);

        // 4. Try to go to next page
        const hasNext = await page.evaluate(async () => {
            // Looking for Next button (usually an arrow icon or 'הבא')
            const links = Array.from(document.querySelectorAll('a'));
            const nextBtn = links.find(el => el.innerText.includes('הבא') || el.getAttribute('aria-label') === 'הבא' || el.getAttribute('aria-label') === 'Next');
            
            if (nextBtn) {
                nextBtn.click();
                return true;
            }
            return false;
        });

        if (hasNext && currentPage < maxPages) {
            console.log("Moving to Next Page...");
            await new Promise(r => setTimeout(r, 4000)); // wait for load
        } else {
            console.log("No more pages found or max pages reached.");
            break;
        }
    }

    // Deduplicate global
    const finalLeads = [];
    const finalSeen = new Set();
    for (const lead of allLeads) {
        if (!finalSeen.has(lead.phone)) {
            finalSeen.add(lead.phone);
            finalLeads.push(lead);
        }
    }

    console.log(`\n=== SCRAPE COMPLETE ===`);
    console.log(`Total Unique Mobile Leads: ${finalLeads.length}`);
    
    // Save to CSV
    let csvContent = "Name,Phone\n" + finalLeads.map(e => `"${e.name}","${e.phone}"`).join("\n");
    fs.writeFileSync('leads.csv', csvContent, 'utf8');
    
    // Save to JSON
    fs.writeFileSync('leads.json', JSON.stringify(finalLeads, null, 2), 'utf8');

    console.log("Saved to leads.csv and leads.json!");
    console.log("You can safely close the browser window now.");
    await browser.close();
}

main().catch(console.error);
