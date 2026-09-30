require('dotenv').config();
const fs = require('fs');

// Use the API key from the environment variable
const API_KEY = process.env.GOOGLE_MAPS_API_KEY;

if (!API_KEY) {
    console.error("ERROR: GOOGLE_MAPS_API_KEY is not set in the .env file.");
    process.exit(1);
}

async function delay(ms) {
    return new Promise(r => setTimeout(r, ms));
}

async function scrapeGoogleMaps(query) {
    console.log(`Searching Google Maps for: "${query}"...`);
    let results = [];
    let nextPageToken = null;
    let requestCount = 0; // Hardcoded safety limit
    
    do {
        if (requestCount >= 50) {
            console.log("SAFETY LIMIT REACHED: Stopping at 50 requests to prevent billing.");
            break;
        }

        let url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${API_KEY}&language=iw`;
        if (nextPageToken) {
            url = `https://maps.googleapis.com/maps/api/place/textsearch/json?pagetoken=${nextPageToken}&key=${API_KEY}&language=iw`;
        }
        
        try {
            requestCount++;
            const res = await fetch(url);
            const data = await res.json();
            
            if (data.status === 'OK' || data.status === 'ZERO_RESULTS') {
                if (data.results) {
                    results = results.concat(data.results);
                }
                nextPageToken = data.next_page_token;
                if (nextPageToken) {
                    await delay(2500); // Google requires a delay
                }
            } else {
                console.error("Error from Text Search API:", data.status, data.error_message);
                break;
            }
        } catch (e) {
            console.error("Fetch error:", e.message);
            break;
        }
    } while (nextPageToken);
    
    console.log(`Found ${results.length} total businesses. Fetching details to check websites...`);
    
    const leads = [];
    const chunkSize = 5;
    for (let i = 0; i < results.length; i += chunkSize) {
        if (requestCount >= 50) break;

        const chunk = results.slice(i, i + chunkSize);
        const chunkPromises = chunk.map(async (place) => {
            const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=name,formatted_phone_number,website,formatted_address&key=${API_KEY}&language=iw`;
            try {
                requestCount++;
                const detRes = await fetch(detailsUrl);
                const detData = await detRes.json();
                if (detData.status === 'OK') {
                    const details = detData.result;
                    if (details.formatted_phone_number && !details.website) {
                        return {
                            name: details.name,
                            phone: details.formatted_phone_number,
                            address: details.formatted_address || "Unknown"
                        };
                    }
                }
            } catch (e) { }
            return null;
        });
        
        const chunkResults = await Promise.all(chunkPromises);
        chunkResults.forEach(lead => {
            if (lead) leads.push(lead);
        });
    }
    
    console.log("\n=== QUALIFIED LEADS (No Website) ===");
    console.table(leads);
    fs.writeFileSync('leads.json', JSON.stringify(leads, null, 2));
    console.log(`Saved ${leads.length} leads to leads.json`);
    console.log(`Total API requests used this run: ${requestCount}`);
}

const query = process.argv[2] || "אינסטלטור באר שבע";
scrapeGoogleMaps(query);
